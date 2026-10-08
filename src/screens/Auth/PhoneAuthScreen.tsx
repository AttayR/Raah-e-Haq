import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StatusBar,
  ImageBackground,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useApiAuth } from '../../hooks/useApiAuth';
import { useOtpTimers } from '../../hooks/useOtpTimers';
import { useKeyboardVisible } from '../../hooks/useKeyboardVisible';
import ThemedTextInput from '../../components/ThemedTextInput';
import BrandButton from '../../components/BrandButton';
import { errorToastMessage, toast } from '../../core/toast';
import { BrandColors } from '../../theme/colors';
import OtpService, { OTP_LENGTH, formatCountdown, formatPkPhoneInput, sanitizeOtpInput } from '../../services/otpService';
import { sendOtp, verifyOtp } from '../../store/thunks/apiThunks';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { logger } from '../../core/logging/logger';
import { rejectionMessage } from '../../core/api/errors';
import { accountRefusalParts, REFUSAL_TOAST_DURATION_MS } from '../../core/auth/accountRefusal';
import { routesHome } from '../../core/auth/normalizeUser';
import { classifyOtpRefusal, isGlobalOtpRefusal, type OtpRefusalLike } from '../../features/auth/otpRefusal';
import { PHONE_AUTH_COPY as COPY } from '../../features/auth/copy/phoneAuth';
import type { AuthStackParamList } from '../../app/navigation/stacks/AuthStack';
import { styles } from './PhoneAuthScreen.styles';
import { EmailFallback, KEYBOARD_DONE_ID, KeyboardDoneBar, PhoneAuthHeader } from './PhoneAuthParts';

type AuthStep = 'phone' | 'verification';

export default function PhoneAuthScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { sendOtpToPhone, verifyOtpCode, isLoading, clearAuthError } = useApiAuth();
  const { resendIn, expiresIn, isExpired, codeSent, blockResend, expireCode, clearCode } = useOtpTimers();
  const keyboardUp = useKeyboardVisible();

  const [currentStep, setCurrentStep] = useState<AuthStep>('phone');
  const [phoneInput, setPhoneInput] = useState('+92');
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
  const [sendHold, setSendHold] = useState({ phone: '', global: false });
  const sendBlocked = resendIn > 0 && (sendHold.global || phoneInput.trim() === sendHold.phone);
  // One send/verify at a time: a second tap lands before isLoading re-renders the button.
  const inFlight = useRef(false);

  // The auth error is shared with Login: leaving this screen must not carry it over (T-107).
  useEffect(() => () => clearAuthError(), [clearAuthError]);

  // A code that ran out makes the last "Invalid or expired" refusal stale: the expiry line
  // says what to do now. A burned code keeps its message (AUTH-18).
  useEffect(() => {
    if (isExpired && !codeBurned) {
      setOtpError('');
    }
  }, [isExpired, codeBurned]);

  /** Holds sending for retry_after: this number only, or every number for a global refusal. */
  const holdSending = (phone: string, refusal?: OtpRefusalLike & { retryAfter?: number }) => {
    blockResend(refusal?.retryAfter);
    setSendHold({ phone, global: isGlobalOtpRefusal(refusal) });
  };

  /**
   * Sends (or resends) a code; expiry comes from expires_in, never the code itself (AUTH-02).
   * A refusal shows the server's message; its BE-28 `code` decides the rest (T-111, T-113):
   * hold sending for retry_after (globally for sms_unavailable/busy/otp_ip_limit), suggest email.
   */
  const requestCode = async (isResend: boolean) => {
    const fallback = isResend ? COPY.fallbacks.resend : COPY.fallbacks.send;
    const showError = isResend ? setOtpError : setPhoneError;
    const phone = phoneInput.trim();
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    try {
      const result = await sendOtpToPhone(phone);

      if (sendOtp.fulfilled.match(result)) {
        codeSent(result.payload.expires_in);
        setSendHold({ phone, global: false });
        setCurrentStep('verification');
        setVerificationCode('');
        setCodeBurned(false);
        setSuggestEmail(false);
        setPhoneError('');
        setOtpError('');
        // The server's message (the same for every number); never our own "code sent" claim.
        toast.success(result.payload.message || (isResend ? COPY.toasts.resent : COPY.toasts.sent));
        return;
      }

      const rejection = sendOtp.rejected.match(result) ? result.payload : undefined;
      const action = classifyOtpRefusal(rejection);
      if (action !== 'other') {
        holdSending(phone, rejection);
      }
      setSuggestEmail(action === 'limit');
      const errorMessage = rejectionMessage(rejection, fallback);
      logger.debug('❌ PhoneAuthScreen - OTP send failed:', { kind: rejection?.kind, code: rejection?.code });
      showError(errorMessage);
      toast.error(errorMessage);
    } catch (err: unknown) {
      logger.error('💥 PhoneAuthScreen - Error sending verification code:', err);
      showError(errorToastMessage(err, fallback) ?? fallback);
      toast.fromError(err, fallback);
    } finally {
      inFlight.current = false;
    }
  };

  const handleSendCode = async () => {
    setPhoneError('');

    const validation = OtpService.validatePhoneNumber(phoneInput.trim());
    if (!validation.isValid) {
      logger.debug('❌ PhoneAuthScreen - Phone validation failed:', validation.error);
      setPhoneError(validation.error || COPY.phoneStep.invalidPhone);
      toast.error(validation.error || COPY.phoneStep.invalidPhone);
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

    const otpData = {
      phone: phoneInput.trim(),
      otp_code: sanitizeOtpInput(verificationCode),
    };

    const validation = OtpService.validateOtpData(otpData);
    if (!validation.isValid) {
      logger.debug('❌ PhoneAuthScreen - OTP validation failed:', validation.error);
      setOtpError(validation.error || COPY.codeStep.invalidCode);
      toast.error(validation.error || COPY.codeStep.invalidCode);
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
      // 403 ACCOUNT_*: the server's message, plus the rejection reason when there is one (T-106).
      const { message: refusalText, reason } = accountRefusalParts(rejection, COPY.fallbacks.invalidCode);
      logger.debug('❌ PhoneAuthScreen - OTP verification failed:', { kind: rejection?.kind, status: rejection?.status, code: rejection?.code });
      // Inline: both lines. Toast: the reason as its second line, so the title limit never cuts it.
      setOtpError(reason ? `${refusalText}\n${reason}` : refusalText);
      toast.error(refusalText, reason ?? undefined, reason ? { duration: REFUSAL_TOAST_DURATION_MS } : undefined);
    } catch (err: unknown) {
      logger.error('💥 PhoneAuthScreen - Error verifying code:', err);
      setOtpError(errorToastMessage(err, COPY.fallbacks.verify) ?? COPY.fallbacks.verify);
      toast.fromError(err, COPY.fallbacks.verify);
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
    setVerificationCode('');
    setOtpError('');
    setCodeBurned(false);
    setSuggestEmail(false);
    clearCode();
  };

  // Back to Login on its Email tab (AUTH-18), not a new Login on the Phone tab.
  const renderEmailFallback = () =>
    suggestEmail ? <EmailFallback onPress={() => navigation.popTo('Login', { method: 'email' })} /> : null;

  const renderPhoneStep = () => (
    <View style={styles.formCard}>
      {keyboardUp ? null : (
        <View style={styles.phoneIconContainer}>
          <Icon name="smartphone" size={48} color={BrandColors.primary} />
        </View>
      )}
      <Text style={styles.sectionTitle}>{COPY.phoneStep.title}</Text>
      <Text style={styles.sectionSubtitle}>{COPY.phoneStep.subtitle}</Text>

      <View style={styles.inputContainer}>
        <ThemedTextInput
          placeholder={COPY.phoneStep.placeholder}
          value={phoneInput}
          onChangeText={(text) => {
            setPhoneInput(formatPkPhoneInput(text));
            setPhoneError('');
          }}
          keyboardType="phone-pad"
          returnKeyType="done"
          inputAccessoryViewID={KEYBOARD_DONE_ID}
          autoFocus
          style={[styles.input, phoneError && styles.inputError]}
          maxLength={13}
        />
        {phoneError ? (
          <View style={styles.errorContainer}>
            <Icon name="error" size={16} color="#ef4444" />
            <Text style={styles.errorText}>{phoneError}</Text>
          </View>
        ) : null}
        {renderEmailFallback()}
      </View>

      <View style={styles.buttonContainer}>
        <BrandButton
          title={
            isLoading
              ? COPY.phoneStep.sending
              : sendBlocked
                ? COPY.phoneStep.sendIn(formatCountdown(resendIn))
                : COPY.phoneStep.send
          }
          onPress={handleSendCode}
          variant="primary"
          disabled={isLoading || sendBlocked || !phoneInput.trim()}
          style={styles.primaryButton}
          textStyle={styles.buttonText}
        />
      </View>
    </View>
  );

  const expiryText = codeBurned
    ? COPY.codeStep.burned
    : isExpired
      ? COPY.codeStep.expired
      : COPY.codeStep.expiresIn(formatCountdown(expiresIn));

  const renderVerificationStep = () => (
    <View style={styles.formCard}>
      {keyboardUp ? null : (
        <View style={styles.verificationIconContainer}>
          <Icon name="verified-user" size={48} color={BrandColors.primary} />
        </View>
      )}
      <Text style={styles.sectionTitle}>{COPY.codeStep.title}</Text>
      <Text style={styles.sectionSubtitle}>{COPY.codeStep.subtitle(phoneInput)}</Text>
      <Text style={[styles.expiryHint, (isExpired || codeBurned) && styles.expiryHintExpired]}>
        {expiryText}
      </Text>

      <View style={styles.inputContainer}>
        <ThemedTextInput
          placeholder={COPY.codeStep.placeholder(OTP_LENGTH)}
          value={verificationCode}
          onChangeText={(text) => {
            // Typed, pasted ("123 456") or SMS-autofilled text: digits only, max OTP_LENGTH.
            setVerificationCode(sanitizeOtpInput(text));
            setOtpError(''); // Clear error when user types
          }}
          keyboardType="number-pad"
          returnKeyType="done"
          inputAccessoryViewID={KEYBOARD_DONE_ID}
          textContentType="oneTimeCode"
          autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
          autoFocus
          style={[styles.input, otpError && styles.inputError]}
        />
        {otpError ? (
          <View style={styles.errorContainer}>
            <Icon name="error" size={16} color="#ef4444" />
            <Text style={styles.errorText}>{otpError}</Text>
          </View>
        ) : null}
        {renderEmailFallback()}
      </View>

      <View style={styles.buttonContainer}>
        <BrandButton
          title={isLoading ? COPY.codeStep.verifying : COPY.codeStep.verify}
          onPress={handleVerifyCode}
          variant="primary"
          disabled={isLoading || isExpired || codeBurned || verificationCode.length !== OTP_LENGTH}
          style={styles.primaryButton}
          textStyle={styles.buttonText}
        />
      </View>

      <View style={styles.resendContainer}>
        {resendIn > 0 ? (
          <Text style={styles.resendText}>{COPY.codeStep.resendIn(formatCountdown(resendIn))}</Text>
        ) : (
          <BrandButton
            title={isResending ? COPY.codeStep.resending : COPY.codeStep.resend}
            onPress={handleResendCode}
            variant="secondary"
            disabled={isResending}
            style={styles.resendButton}
            textStyle={styles.buttonText}
          />
        )}
      </View>

      <View style={styles.buttonContainer}>
        <BrandButton
          title={COPY.codeStep.changePhone}
          onPress={handleBackToPhone}
          variant="secondary"
          style={styles.backButton}
          textStyle={styles.buttonText}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={BrandColors.primary} translucent={false} />
      <ImageBackground
        source={require('../../assets/images/background_raahe_haq.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <PhoneAuthHeader
          title={currentStep === 'phone' ? COPY.header.phoneTitle : COPY.header.codeTitle}
          subtitle={currentStep === 'phone' ? COPY.header.phoneSubtitle : COPY.header.codeSubtitle}
          compact={keyboardUp}
        />

        {/* Scrollable Content */}
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.container}>
              {currentStep === 'phone' && renderPhoneStep()}
              {currentStep === 'verification' && renderVerificationStep()}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </ImageBackground>
      <KeyboardDoneBar />
    </SafeAreaView>
  );
}
