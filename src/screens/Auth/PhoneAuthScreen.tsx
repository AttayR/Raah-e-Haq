import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StatusBar,
  ImageBackground,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useApiAuth } from '../../hooks/useApiAuth';
import { useOtpTimers } from '../../hooks/useOtpTimers';
import ThemedTextInput from '../../components/ThemedTextInput';
import BrandButton from '../../components/BrandButton';
import { errorToastMessage, toast } from '../../core/toast';
import { BrandColors } from '../../theme/colors';
import OtpService, { OTP_LENGTH, formatCountdown, sanitizeOtpInput } from '../../services/otpService';
import { sendOtp, verifyOtp } from '../../store/thunks/apiThunks';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { logger } from '../../core/logging/logger';
import { rejectionMessage } from '../../core/api/errors';
import { accountRefusalParts, REFUSAL_TOAST_DURATION_MS } from '../../core/auth/accountRefusal';
import { routesHome } from '../../core/auth/normalizeUser';
import { classifyOtpRefusal } from '../../features/auth/otpRefusal';
import { PHONE_AUTH_COPY as COPY } from '../../features/auth/copy/phoneAuth';
import type { AuthStackParamList } from '../../app/navigation/stacks/AuthStack';
import { styles } from './PhoneAuthScreen.styles';

type AuthStep = 'phone' | 'verification';

export default function PhoneAuthScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { sendOtpToPhone, verifyOtpCode, error, isLoading, isOtpSent, isOtpVerified, clearAuthError } = useApiAuth();
  const { resendIn, expiresIn, isExpired, codeSent, blockResend, expireCode, clearCode } = useOtpTimers();

  // Debug logging for state changes
  useEffect(() => {
    logger.debug('📱 PhoneAuthScreen - Auth state changed:', { isLoading, error, isOtpSent, isOtpVerified });
  }, [isLoading, error, isOtpSent, isOtpVerified]);

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
  // The server's resend cooldown is per phone, so only that number is held back.
  const [cooldownPhone, setCooldownPhone] = useState('');
  const sendBlocked = resendIn > 0 && phoneInput.trim() === cooldownPhone;
  // One send/verify at a time: a second tap lands before isLoading re-renders the button.
  const inFlight = useRef(false);

  // The auth error is shared with Login: leaving this screen must not carry it over (T-107).
  useEffect(() => () => clearAuthError(), [clearAuthError]);

  /**
   * Sends (or resends) a code. Expiry comes from the server's expires_in. A refusal shows
   * the server's message; what else happens is decided by its BE-28 `code` (T-111):
   * cooldown, send limit and 503 sms_unavailable/busy hold resending for retry_after, and an
   * IP limit also suggests email sign-in. The code itself is never read from the response
   * (AUTH-02).
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
      logger.debug('📨 PhoneAuthScreen - Send OTP result:', result.type);

      if (sendOtp.fulfilled.match(result)) {
        codeSent(result.payload.expires_in);
        setCooldownPhone(phone);
        setCurrentStep('verification');
        setVerificationCode('');
        setCodeBurned(false);
        setSuggestEmail(false);
        setPhoneError('');
        setOtpError('');
        toast.success(isResend ? COPY.toasts.resent : COPY.toasts.sent);
        return;
      }

      const rejection = sendOtp.rejected.match(result) ? result.payload : undefined;
      const action = classifyOtpRefusal(rejection);
      if (action !== 'other') {
        blockResend(rejection?.retryAfter);
        setCooldownPhone(phone);
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
    logger.debug('📱 PhoneAuthScreen - Starting send OTP process');
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
    logger.debug('📱 PhoneAuthScreen - Starting verify OTP process');
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
      logger.debug('📨 PhoneAuthScreen - Verify OTP result:', result.type);

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
        blockResend(rejection?.retryAfter);
      } else if (action === 'unavailable') {
        blockResend(rejection?.retryAfter);
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
    logger.debug('📱 PhoneAuthScreen - Starting resend OTP process');
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

  const renderEmailFallback = () =>
    suggestEmail ? (
      <View style={styles.emailFallback}>
        <Text style={styles.emailFallbackText}>{COPY.emailFallback.hint}</Text>
        <BrandButton
          title={COPY.emailFallback.action}
          onPress={() => navigation.navigate('Login')}
          variant="secondary"
          style={styles.resendButton}
          textStyle={styles.buttonText}
        />
      </View>
    ) : null;

  const renderPhoneStep = () => (
    <View style={styles.formCard}>
      <View style={styles.phoneIconContainer}>
        <Icon name="smartphone" size={48} color={BrandColors.primary} />
      </View>
      <Text style={styles.sectionTitle}>{COPY.phoneStep.title}</Text>
      <Text style={styles.sectionSubtitle}>{COPY.phoneStep.subtitle}</Text>

      <View style={styles.inputContainer}>
        <ThemedTextInput
          placeholder={COPY.phoneStep.placeholder}
          value={phoneInput}
          onChangeText={(text) => {
            // Enforce +92 prefix and allow up to 10 digits after it
            const digits = text.replace(/\D/g, '');
            let next = text;
            if (text.startsWith('+92')) {
              // Keep only up to 10 digits after +92
              const after = text.slice(3).replace(/\D/g, '').slice(0, 10);
              next = `+92${after}`;
            } else if (/^03\d{0,9}$/.test(digits)) {
              // 03XXXXXXXXX -> +92XXXXXXXXXX (partial as user types)
              const after = digits.slice(1, 11);
              next = `+92${after}`;
            } else if (/^92\d{0,10}$/.test(digits)) {
              next = `+${digits.slice(0, 12)}`;
            } else {
              // Fallback: always ensure +92 prefix
              const after = digits.replace(/^92/, '').replace(/^0/, '').slice(0, 10);
              next = `+92${after}`;
            }
            setPhoneInput(next);
            setPhoneError('');
          }}
          keyboardType="phone-pad"
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
      <View style={styles.verificationIconContainer}>
        <Icon name="verified-user" size={48} color={BrandColors.primary} />
      </View>
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
      <StatusBar
        barStyle="light-content"
        backgroundColor={BrandColors.primary}
        translucent={false}
      />
      <ImageBackground
        source={require('../../assets/images/background_raahe_haq.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        {/* Fixed Header */}
        <View style={styles.fixedHeader}>
          {/* Decorative Circles */}
          <View style={styles.decorativeCircle1} />
          <View style={styles.decorativeCircle2} />
          <View style={styles.decorativeCircle3} />
          <View style={styles.decorativeCircle4} />
          <View style={styles.decorativeCircle5} />

          <View style={styles.logoContainer}>
            <View style={styles.logoWrapper}>
              <Image
                source={require('../../assets/images/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.title}>
              {currentStep === 'phone' ? COPY.header.phoneTitle : COPY.header.codeTitle}
            </Text>
            <Text style={styles.subtitle}>
              {currentStep === 'phone' ? COPY.header.phoneSubtitle : COPY.header.codeSubtitle}
            </Text>
          </View>
        </View>

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
    </SafeAreaView>
  );
}
