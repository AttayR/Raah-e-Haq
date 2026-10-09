import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppDispatch } from '../../../store';
import {
  resendPhoneCode,
  verifyPhone,
  type PendingPhoneVerification,
} from '../../../store/thunks/apiThunks';
import type { ThunkRejection } from '../../../core/api/errors';
import { accountRefusalMessage } from '../../../core/auth/accountRefusal';
import { routesHome } from '../../../core/auth/normalizeUser';
import { useOtpTimers } from '../../../hooks/useOtpTimers';
import { OTP_LENGTH, sanitizeOtpInput } from '../../../services/otpService';
import { toast } from '../../../core/toast';
import { SUPPORT_EMAIL } from '../../../config/support';
import { classifyOtpRefusal } from '../otpRefusal';
import { PHONE_AUTH_COPY } from '../copy/phoneAuth';
import { REGISTRATION_COPY as COPY } from '../copy/registration';

/**
 * - code          entering the SMS code (verify / resend)
 * - done          verified, but no session: a driver pending approval (token null, BE-38)
 * - token_invalid 422 verification_token_invalid: this step is over; the server's message
 *                 points to the emailed link or a password reset, then /profile/phone
 * - needs_review  409 phone_needs_review: support must assign the number
 * A verified account with a token needs no state here: AuthFlow routes on the new session.
 */
export type RegistrationPhoneStatus = 'code' | 'done' | 'token_invalid' | 'needs_review';

/**
 * The registration phone step (T-201, BE-35/BE-38 contract): verify the SMS code with the
 * registration's verification_token, resend it, and react to the server's refusal `code`.
 * The token stays in this hook's memory; it is never stored or logged. A wrong code is a 422
 * here, never a sign-out.
 */
export function useRegistrationPhoneVerify(pending: PendingPhoneVerification, role: 'driver' | 'passenger' | null) {
  const dispatch = useAppDispatch();
  const timers = useOtpTimers();
  const { codeSent, blockResend, expireCode } = timers;
  const token = useRef(pending.verificationToken);
  const inFlight = useRef(false);

  const [code, setCodeState] = useState('');
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');
  const [burned, setBurned] = useState(false);
  // False while register's send was refused (code_sent: false) and no resend succeeded yet.
  const [hasCode, setHasCode] = useState(pending.codeSent);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [status, setStatus] = useState<RegistrationPhoneStatus>('code');
  const [doneMessage, setDoneMessage] = useState('');

  // Registration's send: start the code's expiry, or (code_sent: false) wait for retry_after.
  useEffect(() => {
    if (pending.codeSent) {
      codeSent(pending.expiresIn);
    } else {
      blockResend(pending.refusal?.retryAfter);
      setError(pending.refusal?.message || COPY.verify.notSentYet);
    }
  }, [pending, codeSent, blockResend]);

  const setCode = useCallback((text: string) => {
    setCodeState(sanitizeOtpInput(text));
    setError('');
  }, []);

  /** Refusals both endpoints share: the step is over, or a BE-28 limit/cooldown applies. */
  const handleRefusal = useCallback(
    (rejection: ThunkRejection | undefined, fallback: string) => {
      const message = accountRefusalMessage(rejection, fallback);
      if (rejection?.code === 'verification_token_invalid') {
        setStatus('token_invalid');
        setError(message);
        setHint(role === 'driver' ? COPY.verify.driverApprovalHint : '');
        return;
      }
      if (rejection?.code === 'phone_needs_review') {
        setStatus('needs_review');
        setError(message);
        setHint(COPY.verify.supportHint(SUPPORT_EMAIL));
        return;
      }
      const action = classifyOtpRefusal(rejection);
      if (action === 'burned') {
        // code_exhausted: the code is spent. Clear it; Resend after retry_after.
        setCodeState('');
        setBurned(true);
        expireCode();
      }
      if (action !== 'other') {
        blockResend(rejection?.retryAfter);
      }
      setHint(action === 'limit' ? COPY.verify.limitHint : '');
      setError(message);
    },
    [role, blockResend, expireCode],
  );

  const verify = useCallback(async () => {
    if (inFlight.current || !hasCode || burned || status !== 'code' || code.length !== OTP_LENGTH) {
      return;
    }
    if (timers.isExpired) {
      setError(PHONE_AUTH_COPY.codeStep.expired);
      return;
    }
    inFlight.current = true;
    setVerifying(true);
    setError('');
    try {
      const result = await dispatch(verifyPhone({ verification_token: token.current, otp_code: code }));
      if (verifyPhone.fulfilled.match(result)) {
        timers.clearCode();
        if (result.payload.signedIn) {
          // AuthFlow now routes on the new session (home, or account status when pending).
          if (routesHome(result.payload.user)) {
            toast.success(PHONE_AUTH_COPY.toasts.verified);
          }
          return;
        }
        setStatus('done');
        setDoneMessage(COPY.verify.pendingApproval);
        return;
      }
      const rejection = verifyPhone.rejected.match(result) ? result.payload : undefined;
      if (rejection?.kind === 'cancelled') {
        return;
      }
      handleRefusal(rejection, COPY.fallbacks.verify);
    } finally {
      inFlight.current = false;
      setVerifying(false);
    }
  }, [hasCode, burned, status, code, timers, dispatch, handleRefusal]);

  const resend = useCallback(async () => {
    if (inFlight.current || status !== 'code' || timers.resendIn > 0) {
      return;
    }
    inFlight.current = true;
    setResending(true);
    try {
      const result = await dispatch(resendPhoneCode({ verification_token: token.current }));
      if (resendPhoneCode.fulfilled.match(result)) {
        codeSent(result.payload.expires_in);
        setHasCode(true);
        setCodeState('');
        setBurned(false);
        setError('');
        setHint('');
        toast.success(COPY.verify.resent);
        return;
      }
      const rejection = resendPhoneCode.rejected.match(result) ? result.payload : undefined;
      // Shown inline only (one message, no toast on top).
      handleRefusal(rejection, COPY.fallbacks.resend);
    } finally {
      inFlight.current = false;
      setResending(false);
    }
  }, [status, timers.resendIn, dispatch, codeSent, handleRefusal]);

  return {
    phone: pending.phone,
    code,
    setCode,
    error,
    hint,
    burned,
    status,
    doneMessage,
    verifying,
    resending,
    resendIn: timers.resendIn,
    expiresIn: timers.expiresIn,
    isExpired: timers.isExpired,
    /** A code is out and usable: the Verify button may be pressed once 6 digits are typed. */
    canVerify: status === 'code' && hasCode && !burned && !timers.isExpired,
    verify,
    resend,
  };
}
