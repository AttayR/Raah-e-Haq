import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { Button, Header, KeyboardAwareScrollView, Screen, formatNationalPhone } from '../../components/ui';
import { useApiAuth } from '../../hooks/useApiAuth';
import { OTP_RESEND_COOLDOWN_SECONDS, useOtpTimers } from '../../hooks/useOtpTimers';
import { errorToastMessage, toast } from '../../core/toast';
import { haptics } from '../../core/haptics';
import OtpService, { OTP_LENGTH, formatCountdown, sanitizeOtpInput } from '../../services/otpService';
import { sendOtp, verifyOtp } from '../../store/thunks/apiThunks';
import { logger } from '../../core/logging/logger';
import { rejectionMessage } from '../../core/api/errors';
import { accountRefusalParts, isAdminUsePanelRefusal, REFUSAL_TOAST_DURATION_MS } from '../../core/auth/accountRefusal';
import { refusedAccountStatus, routesHome } from '../../core/auth/normalizeUser';
import { classifyOtpRefusal, isGlobalOtpRefusal, type OtpRefusalLike } from '../../features/auth/otpRefusal';
import { activeOtpSendHold, rememberOtpSendHold, resetOtpSendHold } from '../../features/auth/otpSendHold';
import { PHONE_AUTH_COPY as COPY } from '../../features/auth/copy/phoneAuth';
import AuthIntro from '../../features/auth/components/AuthIntro';
import type { AuthStackParamList } from '../../app/navigation/stacks/AuthStack';
import { layout, space } from '../../theme';
import { EmailFallback, PhoneCodeStep, PhoneNumberStep } from './PhoneAuthParts';

type AuthStep = 'phone' | 'verification';

const toE164 = (digits: string) => `+92${digits}`;

/**
 * Phone sign-in (UI-R6, spec auth-phone-otp; behaviour T-101/T-111/T-113/T-553/T-556). Form
 * archetype on the theme background: back header, title, the kit phone field (+92 prefix) or
 * the code field, and the one primary action (Send / Verify) in a sticky footer that rides
 * above the keyboard. Refusals show once, under the field (T-603); a 403 account refusal is a
 * toast with its reason (T-106). The code the local backend echoes is never shown (AUTH-02).
 */
export default function PhoneAuthScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { sendOtpToPhone, verifyOtpCode, isLoading, clearAuthError } = useApiAuth();
  const { resendIn, expiresIn, isExpired, codeSent, blockResend, expireCode, clearCode } = useOtpTimers();

  // T-570: a send hold from an earlier visit (inside the cooldown) comes back, so Send shows its
  // countdown instead of an enabled button whose first tap only earns a 429. A per-number hold
  // brings its number back; a global one (every number held) leaves the field empty.
  const [initialHold] = useState(() => activeOtpSendHold());
  const prefill = initialHold && !initialHold.global ? initialHold.phone : null;
  const [currentStep, setCurrentStep] = useState<AuthStep>('phone');
  const [digits, setDigits] = useState(() => (prefill ? prefill.slice(3) : ''));
  // T-553 (QA: "Phone must be in +92… format" on a fast first Send code): the handlers read the
  // latest typed number here, not a render's possibly stale state.
  const phoneRef = useRef(prefill ?? '+92');
  const [verificationCode, setVerificationCode] = useState('');
  const [phoneError, setPhoneError] = useState<string>('');
  const [otpError, setOtpError] = useState<string>('');
  const [isResending, setIsResending] = useState(false);
  // BE-28 code_exhausted: the server burned this code; only a new one can be verified.
  const [codeBurned, setCodeBurned] = useState(false);
  // BE-28 otp_ip_limit / otp_verify_limit: phone sign-in is capped, so email is offered.
  const [suggestEmail, setSuggestEmail] = useState(false);
  // The resend cooldown is per phone, so only that number is held back; a global refusal
  // (sms_unavailable, busy, otp_ip_limit) holds every number until retry_after (AUTH-18).
  const [sendHold, setSendHold] = useState(() =>
    initialHold ? { phone: initialHold.phone, global: initialHold.global } : { phone: '', global: false },
  );
  // T-570: the server's "code sent" message, inline above the code field (a toast covered the title).
  const [sentNotice, setSentNotice] = useState('');
  const sendBlocked = resendIn > 0 && (sendHold.global || toE164(digits) === sendHold.phone);
  // One send/verify at a time: a second tap lands before isLoading re-renders the button.
  const inFlight = useRef(false);
  // Verify (the button, and T-594 the keyboard's Done/Enter) needs the whole, live code.
  const canVerify = !isResending && !isExpired && !codeBurned && verificationCode.length === OTP_LENGTH;

  // The auth error is shared with Login: leaving this screen must not carry it over (T-107).
  useEffect(() => () => clearAuthError(), [clearAuthError]);

  // T-570: restart the remembered hold's countdown on this screen's timers.
  useEffect(() => {
    if (initialHold) blockResend(initialHold.seconds);
  }, [initialHold, blockResend]);

  // A code that ran out makes the last "Invalid or expired" refusal stale: the expiry line
  // says what to do now. A burned code keeps its message (AUTH-18).
  useEffect(() => {
    if (isExpired && !codeBurned) {
      setOtpError('');
    }
  }, [isExpired, codeBurned]);

  /** Holds sending for retry_after: this number only, or every number for a global refusal. */
  const holdSending = (phone: string, refusal?: OtpRefusalLike & { retryAfter?: number }) => {
    const global = isGlobalOtpRefusal(refusal);
    // The same seconds the countdown uses (60 s when retry_after is missing, 0 or negative).
    const seconds = blockResend(refusal?.retryAfter);
    setSendHold({ phone, global });
    rememberOtpSendHold(phone, global, seconds);
  };

  /**
   * Sends (or resends) a code; expiry comes from expires_in, never the code itself (AUTH-02).
   * A refusal shows the server's message; its BE-28 `code` decides the rest (T-111, T-113):
   * hold sending for retry_after (globally for sms_unavailable/busy/otp_ip_limit), suggest email.
   */
  const requestCode = async (isResend: boolean) => {
    const fallback = isResend ? COPY.fallbacks.resend : COPY.fallbacks.send;
    const showError = isResend ? setOtpError : setPhoneError;
    const phone = phoneRef.current;
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    try {
      const result = await sendOtpToPhone(phone);

      if (sendOtp.fulfilled.match(result)) {
        codeSent(result.payload.expires_in);
        setSendHold({ phone, global: false });
        rememberOtpSendHold(phone, false, OTP_RESEND_COOLDOWN_SECONDS);
        setCurrentStep('verification');
        setVerificationCode('');
        setCodeBurned(false);
        setSuggestEmail(false);
        setPhoneError('');
        setOtpError('');
        // The server's message (the same for every number); never our own "code sent" claim.
        // T-570: inline on the code step, not a toast over its title (like T-567's banner).
        setSentNotice(result.payload.message || (isResend ? COPY.toasts.resent : COPY.toasts.sent));
        return;
      }

      const rejection = sendOtp.rejected.match(result) ? result.payload : undefined;
      const action = classifyOtpRefusal(rejection);
      if (action !== 'other') {
        holdSending(phone, rejection);
      }
      setSuggestEmail(action === 'limit');
      logger.debug('PhoneAuthScreen - OTP send failed', { kind: rejection?.kind, code: rejection?.code });
      haptics.notificationError();
      showError(rejectionMessage(rejection, fallback));
    } catch (err: unknown) {
      logger.error('PhoneAuthScreen - Error sending verification code:', err);
      showError(errorToastMessage(err, fallback) ?? fallback);
    } finally {
      inFlight.current = false;
    }
  };

  const handleSendCode = async () => {
    setPhoneError('');
    const validation = OtpService.validatePhoneNumber(phoneRef.current);
    if (!validation.isValid) {
      logger.debug('PhoneAuthScreen - Phone validation failed');
      haptics.notificationError();
      setPhoneError(COPY.phoneStep.invalidPhone);
      return;
    }
    await requestCode(false);
  };

  const handleVerifyCode = async () => {
    if (codeBurned) {
      return;
    }
    setOtpError('');

    if (isExpired) {
      setOtpError(COPY.codeStep.expired);
      return;
    }

    const otpData = { phone: phoneRef.current, otp_code: sanitizeOtpInput(verificationCode) };
    const validation = OtpService.validateOtpData(otpData);
    if (!validation.isValid) {
      setOtpError(validation.error || COPY.codeStep.invalidCode);
      return;
    }

    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    try {
      const result = await verifyOtpCode(otpData);

      if (verifyOtp.fulfilled.match(result)) {
        clearCode();
        // Signed in: the send hold has done its job and must not greet the next sign-in.
        resetOtpSendHold();
        // Only when it opens a home screen; account status explains a pending/blocked account (T-106).
        if (routesHome(result.payload.user)) {
          toast.success(COPY.toasts.verified);
        }
        // Navigation is handled by the auth flow based on auth state.
        return;
      }

      const rejection = verifyOtp.rejected.match(result) ? result.payload : undefined;
      const action = classifyOtpRefusal(rejection);
      if (action === 'burned') {
        // code_exhausted: the code is spent. Clear it, stop verifying, Resend after retry_after.
        setVerificationCode('');
        setCodeBurned(true);
        expireCode();
        holdSending(otpData.phone, rejection);
      } else if (action === 'unavailable') {
        holdSending(otpData.phone, rejection);
      }
      setSuggestEmail(action === 'limit');
      haptics.notificationError();
      logger.debug('PhoneAuthScreen - OTP verification failed', { kind: rejection?.kind, status: rejection?.status, code: rejection?.code });
      const { message: refusalText, reason } = accountRefusalParts(rejection, COPY.fallbacks.invalidCode);
      // One message per failure (T-603): a 403 ACCOUNT_* is a toast with the rejection reason as
      // its second line (T-106), like Login; every other refusal shows under the code field.
      // T-714: a 403 ADMIN_USE_PANEL is a toast too (the admin copy), not a code-field error.
      if (rejection && (refusedAccountStatus(rejection) !== null || isAdminUsePanelRefusal(rejection))) {
        toast.error(refusalText, reason ?? undefined, reason ? { duration: REFUSAL_TOAST_DURATION_MS } : undefined);
      } else {
        setOtpError(reason ? `${refusalText}\n${reason}` : refusalText);
      }
    } catch (err: unknown) {
      logger.error('PhoneAuthScreen - Error verifying code:', err);
      setOtpError(errorToastMessage(err, COPY.fallbacks.verify) ?? COPY.fallbacks.verify);
    } finally {
      inFlight.current = false;
    }
  };

  const handleResendCode = async () => {
    setIsResending(true);
    try {
      await requestCode(true);
    } finally {
      setIsResending(false);
    }
  };

  const handleBackToPhone = () => {
    setCurrentStep('phone');
    setSentNotice('');
    setVerificationCode('');
    setOtpError('');
    setCodeBurned(false);
    setSuggestEmail(false);
    clearCode();
  };

  // T-556: the header back: from the code step back to the number, else out of the screen.
  // T-557: on the number step with nowhere to go back to, there is no back button at all.
  const canLeave = navigation.canGoBack();
  const handleHeaderBack = () => {
    if (currentStep === 'verification') {
      handleBackToPhone();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };
  const headerBack = currentStep === 'verification' || canLeave ? handleHeaderBack : undefined;

  // Back to Login on its Email tab (AUTH-18), not a new Login on the Phone tab.
  const emailFallback = suggestEmail ? <EmailFallback onPress={() => navigation.popTo('Login', { method: 'email' })} /> : null;

  const onCodeStep = currentStep === 'verification';
  const expiryText = codeBurned
    ? COPY.codeStep.burned
    : isExpired
      ? COPY.codeStep.expired
      : COPY.codeStep.expiresIn(formatCountdown(expiresIn));

  // Sticky bar: 8 above the home indicator, at least 16 from the edge without one (DS §3.2).
  const footerEdge = {
    paddingBottom: insets.bottom > 0 ? layout.bottomActionOffset : layout.bottomActionMinOffset,
    borderTopWidth: theme.borderWidth.hairline,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  };

  return (
    <Screen keyboardAvoiding edges={['top', 'bottom']} testID="phone-auth-screen">
      <Header tone="background" onBack={headerBack} backLabel={COPY.header.back} testID="phone-auth" />
      <KeyboardAwareScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        testID="phone-auth-scroll"
      >
        <AuthIntro
          title={onCodeStep ? COPY.codeStep.title : COPY.phoneStep.title}
          subtitle={onCodeStep ? COPY.codeStep.subtitle(`+92 ${formatNationalPhone(digits)}`) : COPY.phoneStep.subtitle}
          testID="phone-auth-intro"
          brandBar
        />
        {onCodeStep ? (
          <PhoneCodeStep
            code={verificationCode}
            onChange={(text) => {
              // Typed, pasted ("123 456") or SMS-autofilled text: digits only, max OTP_LENGTH.
              setVerificationCode(sanitizeOtpInput(text));
              setOtpError('');
            }}
            error={otpError}
            notice={sentNotice}
            expiryText={expiryText}
            expiryAlert={isExpired || codeBurned}
            locked={codeBurned}
            resendIn={resendIn > 0 ? formatCountdown(resendIn) : null}
            resending={isResending}
            onResend={handleResendCode}
            onChangeNumber={handleBackToPhone}
            onSubmit={() => {
              if (canVerify) handleVerifyCode();
            }}
            emailFallback={emailFallback}
          />
        ) : (
          <PhoneNumberStep
            digits={digits}
            onChange={(next) => {
              phoneRef.current = toE164(next);
              setDigits(next);
              setPhoneError('');
            }}
            error={phoneError}
            disabled={isLoading}
            onSubmit={handleSendCode}
            emailFallback={emailFallback}
          />
        )}
      </KeyboardAwareScrollView>
      <View style={[styles.footer, footerEdge]} testID="phone-auth-footer">
        {onCodeStep ? (
          <Button
            label={COPY.codeStep.verify}
            size="lg"
            onPress={handleVerifyCode}
            loading={isLoading && !isResending}
            disabled={!canVerify}
            accessibilityLabel={isLoading && !isResending ? COPY.codeStep.verifying : undefined}
            haptic="impactLight"
            testID="phone-auth-verify"
          />
        ) : (
          <Button
            label={sendBlocked ? COPY.phoneStep.sendIn(formatCountdown(resendIn)) : COPY.phoneStep.send}
            size="lg"
            onPress={handleSendCode}
            loading={isLoading}
            // Enabled while the number is incomplete: the tap explains what is missing (T-553:
            // a disabled state from a stale render would swallow a fast first tap).
            disabled={sendBlocked}
            accessibilityLabel={isLoading ? COPY.phoneStep.sending : undefined}
            haptic="impactLight"
            testID="phone-auth-send"
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.gutter,
    paddingTop: space[2],
    // T-570: room under "Change number" so the last action never sits flush on the sticky footer.
    paddingBottom: space[8],
    gap: space[8],
  },
  footer: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.gutter,
    paddingTop: space[4],
  },
});
