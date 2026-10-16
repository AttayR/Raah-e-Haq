import { useCallback, useRef, useState } from 'react';
import { useAppDispatch } from '../../store';
import {
  cancelPhoneChange,
  isStaleSessionRejection,
  requestPhoneChange,
  verifyPhoneChange,
} from '../../store/thunks/apiThunks';
import { firstFieldMessages, rejectionMessage, type ThunkRejection } from '../../core/api/errors';
import { confirm } from '../../core/dialog';
import { toast } from '../../core/toast';
import { useOtpTimers } from '../../hooks/useOtpTimers';
import { OTP_LENGTH, sanitizeOtpInput } from '../../services/otpService';
import { classifyOtpRefusal } from '../auth/otpRefusal';
import type { User } from '../../services/api';
import { t } from '../../i18n';

export type ChangePhoneStep = 'number' | 'code';

/** A Pakistani mobile as the kit phone field holds it: 10 national digits starting with 3. */
const PK_MOBILE = /^3\d{9}$/;

/**
 * Change (or first verify) the account's number (T-504b, BE-35). The new number gets a code
 * (POST /profile/phone); the account keeps its number until the code is verified
 * (POST /profile/phone/verify); "Cancel change" drops the pending one (DELETE). A number already
 * waiting opens on the code step. Every refusal is shown here: a wrong code is a 422, the daily
 * cap (429 `otp_send_limit`, 10 codes per account) and the cooldown hold Resend for
 * `retry_after`; none of them signs out. `onDone` runs after a verify or a cancel.
 */
export function useChangePhone(user: User | null, onDone: () => void) {
  const dispatch = useAppDispatch();
  const timers = useOtpTimers();
  const { codeSent, blockResend, expireCode, clearCode } = timers;
  const inFlight = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const [step, setStep] = useState<ChangePhoneStep>(user?.pending_phone ? 'code' : 'number');
  const [pendingPhone, setPendingPhone] = useState<string | null>(user?.pending_phone ?? null);
  const [digits, setDigitsState] = useState('');
  const [code, setCodeState] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [burned, setBurned] = useState(false);
  const [busy, setBusy] = useState<'send' | 'verify' | 'cancel' | null>(null);

  const setDigits = useCallback((text: string) => {
    setDigitsState(text);
    setPhoneError(null);
    setError(null);
  }, []);

  const setCode = useCallback((text: string) => {
    setCodeState(sanitizeOtpInput(text));
    setError(null);
  }, []);

  /** BE-28 refusals both sends and verifies share: a spent code, a cooldown, a cap, no SMS. */
  const handleRefusal = useCallback(
    (rejection: ThunkRejection | undefined, fallback: string) => {
      const action = classifyOtpRefusal(rejection);
      if (action === 'burned') {
        setCodeState('');
        setBurned(true);
        expireCode();
      }
      if (action !== 'other') blockResend(rejection?.retryAfter);
      setError(rejectionMessage(rejection, fallback));
    },
    [blockResend, expireCode],
  );

  const run = useCallback(
    async <T>(kind: 'send' | 'verify' | 'cancel', task: () => Promise<T>): Promise<T | null> => {
      if (inFlight.current) return null;
      inFlight.current = true;
      setBusy(kind);
      try {
        return await task();
      } finally {
        inFlight.current = false;
        setBusy(null);
      }
    },
    [],
  );

  /** Texts a code to `phone` (E.164): the typed number, or the pending one again (Resend). */
  const sendTo = useCallback(
    (phone: string, fromNumberStep: boolean) =>
      run('send', async () => {
        const result = await dispatch(requestPhoneChange(phone));
        if (requestPhoneChange.fulfilled.match(result)) {
          if (!result.payload.codeSent) {
            // Already this account's verified number: nothing is pending any more.
            toast.success(result.payload.message ?? t('phoneChange.alreadyVerified'));
            onDoneRef.current();
            return;
          }
          codeSent(result.payload.expiresIn);
          setPendingPhone(result.payload.phone);
          setStep('code');
          setCodeState('');
          setBurned(false);
          setError(null);
          return;
        }
        const rejection = result.payload;
        if (isStaleSessionRejection(rejection)) return;
        const fieldMessage = firstFieldMessages(rejection?.fieldErrors).phone;
        if (fieldMessage && fromNumberStep) {
          setPhoneError(fieldMessage);
          return;
        }
        handleRefusal(rejection, t('phoneChange.sendFailed'));
      }),
    [run, dispatch, codeSent, handleRefusal],
  );

  const send = useCallback(() => {
    if (!digits) {
      setPhoneError(t('phoneChange.phoneRequired'));
      return;
    }
    if (!PK_MOBILE.test(digits)) {
      setPhoneError(t('phoneChange.phoneInvalid'));
      return;
    }
    if (timers.resendIn > 0) return;
    sendTo(`+92${digits}`, true);
  }, [digits, timers.resendIn, sendTo]);

  const resend = useCallback(() => {
    if (pendingPhone && timers.resendIn === 0) sendTo(pendingPhone, false);
  }, [pendingPhone, timers.resendIn, sendTo]);

  const verify = useCallback(
    (entered: string = code) =>
      run('verify', async () => {
        if (entered.length !== OTP_LENGTH) {
          setError(t('phoneChange.codeIncomplete'));
          return;
        }
        if (timers.isExpired) {
          setError(t('phoneChange.expired'));
          return;
        }
        const result = await dispatch(verifyPhoneChange(entered));
        if (verifyPhoneChange.fulfilled.match(result)) {
          clearCode();
          toast.success(t('phoneChange.verified'));
          onDoneRef.current();
          return;
        }
        const rejection = result.payload;
        if (isStaleSessionRejection(rejection)) return;
        if (rejection?.code === 'no_pending_phone') {
          // Cancelled or verified elsewhere: start again from the number.
          setPendingPhone(null);
          setStep('number');
        } else if (rejection?.status === 422) {
          // A wrong code: empty the boxes so the next try starts fresh (T-545); the message stays.
          setCodeState('');
        }
        handleRefusal(rejection, t('phoneChange.verifyFailed'));
      }),
    [run, code, timers.isExpired, dispatch, clearCode, handleRefusal],
  );

  const cancel = useCallback(async () => {
    const ok = await confirm({
      title: t('phoneChange.cancelTitle'),
      body: t('phoneChange.cancelBody'),
      confirmLabel: t('phoneChange.cancelConfirm'),
      cancelLabel: t('phoneChange.cancelKeep'),
      destructive: true,
    });
    if (!ok) return;
    await run('cancel', async () => {
      const result = await dispatch(cancelPhoneChange());
      if (cancelPhoneChange.fulfilled.match(result)) {
        toast.success(t('phoneChange.cancelled'));
        onDoneRef.current();
        return;
      }
      if (isStaleSessionRejection(result.payload)) return;
      setError(rejectionMessage(result.payload, t('phoneChange.cancelFailed')));
    });
  }, [run, dispatch]);

  /** Back to the number field; the pending number stays until another one is sent or it is cancelled. */
  const chooseAnotherNumber = useCallback(() => {
    setStep('number');
    setCodeState('');
    setError(null);
  }, []);

  return {
    step,
    pendingPhone,
    digits,
    setDigits,
    code,
    setCode,
    phoneError,
    error,
    burned,
    busy,
    resendIn: timers.resendIn,
    expiresIn: timers.expiresIn,
    isExpired: timers.isExpired,
    canVerify: !burned && !timers.isExpired,
    send,
    resend,
    verify,
    cancel,
    chooseAnotherNumber,
  };
}
