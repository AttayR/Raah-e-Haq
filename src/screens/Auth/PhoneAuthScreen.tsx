import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ImageBackground,
  ScrollView,
  Image,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useApiAuth } from '../../hooks/useApiAuth';
import { useOtpTimers } from '../../hooks/useOtpTimers';
import ThemedTextInput from '../../components/ThemedTextInput';
import BrandButton from '../../components/BrandButton';
import { errorToastMessage, toast } from '../../core/toast';
import { BrandColors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import OtpService, { OTP_LENGTH, formatCountdown, sanitizeOtpInput } from '../../services/otpService';
import { sendOtp, verifyOtp } from '../../store/thunks/apiThunks';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { logger } from '../../core/logging/logger';
import { rejectionMessage } from '../../core/api/errors';
import { accountRefusalParts, REFUSAL_TOAST_DURATION_MS } from '../../core/auth/accountRefusal';
import { routesHome } from '../../core/auth/normalizeUser';

type AuthStep = 'phone' | 'verification';

const { width: screenWidth } = Dimensions.get('window');
const isSmallScreen = screenWidth < 375;

export default function PhoneAuthScreen() {
  const { sendOtpToPhone, verifyOtpCode, error, isLoading, isOtpSent, isOtpVerified } = useApiAuth();
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
  // The server's resend cooldown is per phone, so only that number is held back.
  const [cooldownPhone, setCooldownPhone] = useState('');
  const sendBlocked = resendIn > 0 && phoneInput.trim() === cooldownPhone;

  /**
   * Sends (or resends) a code. Expiry comes from the server's expires_in; a 429 shows the
   * server's message and blocks resending for retry_after seconds (BE-16). The code itself
   * is never read from the response (AUTH-02).
   */
  const requestCode = async (isResend: boolean) => {
    const fallback = isResend ? 'Failed to resend code' : 'Failed to send OTP';
    const showError = isResend ? setOtpError : setPhoneError;
    const phone = phoneInput.trim();
    try {
      const result = await sendOtpToPhone(phone);
      logger.debug('📨 PhoneAuthScreen - Send OTP result:', result.type);

      if (sendOtp.fulfilled.match(result)) {
        codeSent(result.payload.expires_in);
        setCooldownPhone(phone);
        setCurrentStep('verification');
        setVerificationCode('');
        setPhoneError('');
        setOtpError('');
        toast.success(isResend ? 'Verification code sent again' : 'OTP sent successfully');
        return;
      }

      const rejection = sendOtp.rejected.match(result) ? result.payload : undefined;
      if (rejection?.kind === 'rate_limited') {
        blockResend(rejection.retryAfter);
        setCooldownPhone(phone);
      }
      const errorMessage = rejectionMessage(rejection, fallback);
      logger.debug('❌ PhoneAuthScreen - OTP send failed:', errorMessage);
      showError(errorMessage);
      toast.error(errorMessage);
    } catch (err: unknown) {
      logger.error('💥 PhoneAuthScreen - Error sending verification code:', err);
      showError(errorToastMessage(err, fallback) ?? fallback);
      toast.fromError(err, fallback);
    }
  };

  const handleSendCode = async () => {
    logger.debug('📱 PhoneAuthScreen - Starting send OTP process');
    setPhoneError('');

    const validation = OtpService.validatePhoneNumber(phoneInput.trim());
    if (!validation.isValid) {
      logger.debug('❌ PhoneAuthScreen - Phone validation failed:', validation.error);
      setPhoneError(validation.error || 'Invalid phone number');
      toast.error(validation.error || 'Invalid phone number');
      return;
    }

    await requestCode(false);
  };

  const handleVerifyCode = async () => {
    logger.debug('📱 PhoneAuthScreen - Starting verify OTP process');
    setOtpError('');

    if (isExpired) {
      setOtpError('This code has expired. Please request a new code.');
      return;
    }

    const otpData = {
      phone: phoneInput.trim(),
      otp_code: sanitizeOtpInput(verificationCode),
    };

    const validation = OtpService.validateOtpData(otpData);
    if (!validation.isValid) {
      logger.debug('❌ PhoneAuthScreen - OTP validation failed:', validation.error);
      setOtpError(validation.error || 'Invalid OTP code');
      toast.error(validation.error || 'Invalid OTP code');
      return;
    }

    try {
      const result = await verifyOtpCode(otpData);
      logger.debug('📨 PhoneAuthScreen - Verify OTP result:', result.type);

      if (verifyOtp.fulfilled.match(result)) {
        clearCode();
        // Only when it opens a home screen; account status explains a pending/blocked account (T-106).
        if (routesHome(result.payload.user)) {
          toast.success('Phone number verified successfully!');
        }
        // Navigation is handled by the auth flow based on auth state.
        return;
      }

      const rejection = verifyOtp.rejected.match(result) ? result.payload : undefined;
      // 429 without retry_after = too many wrong tries; the server has burned this code.
      if (rejection?.kind === 'rate_limited' && !rejection.retryAfter) {
        expireCode();
      }
      // 403 ACCOUNT_*: the server's message, plus the rejection reason when there is one (T-106).
      const { message: refusalText, reason } = accountRefusalParts(rejection, 'Invalid verification code');
      logger.debug('❌ PhoneAuthScreen - OTP verification failed:', { kind: rejection?.kind, status: rejection?.status, code: rejection?.code });
      // Inline: both lines. Toast: the reason as its second line, so the title limit never cuts it.
      setOtpError(reason ? `${refusalText}\n${reason}` : refusalText);
      toast.error(refusalText, reason ?? undefined, reason ? { duration: REFUSAL_TOAST_DURATION_MS } : undefined);
    } catch (err: unknown) {
      logger.error('💥 PhoneAuthScreen - Error verifying code:', err);
      setOtpError(errorToastMessage(err, 'Failed to verify code') ?? 'Failed to verify code');
      toast.fromError(err, 'Failed to verify code');
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
    clearCode();
  };

  const renderPhoneStep = () => (
    <View style={styles.formCard}>
      <View style={styles.phoneIconContainer}>
        <Icon name="smartphone" size={48} color={BrandColors.primary} />
      </View>
      <Text style={styles.sectionTitle}>Enter your phone number</Text>
      <Text style={styles.sectionSubtitle}>
        We'll send you a verification code
      </Text>

      <View style={styles.inputContainer}>
        <ThemedTextInput
          placeholder="Enter phone number"
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
      </View>

      <View style={styles.buttonContainer}>
        <BrandButton
          title={
            isLoading
              ? 'Sending...'
              : sendBlocked
                ? `Send Code (${formatCountdown(resendIn)})`
                : 'Send Code'
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

  const renderVerificationStep = () => (
    <View style={styles.formCard}>
      <View style={styles.verificationIconContainer}>
        <Icon name="verified-user" size={48} color={BrandColors.primary} />
      </View>
      <Text style={styles.sectionTitle}>
        Enter verification code
      </Text>
      <Text style={styles.sectionSubtitle}>
        We sent a code to {phoneInput}. Enter it to verify your phone number.
      </Text>
      <Text style={[styles.expiryHint, isExpired && styles.expiryHintExpired]}>
        {isExpired
          ? 'Code expired. Please request a new code.'
          : `Code expires in ${formatCountdown(expiresIn)}`}
      </Text>

      <View style={styles.inputContainer}>
        <ThemedTextInput
          placeholder={`${OTP_LENGTH}-digit code`}
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
      </View>

      <View style={styles.buttonContainer}>
        <BrandButton
          title={isLoading ? 'Verifying...' : 'Verify Code'}
          onPress={handleVerifyCode}
          variant="primary"
          disabled={isLoading || isExpired || verificationCode.length !== OTP_LENGTH}
          style={styles.primaryButton}
          textStyle={styles.buttonText}
        />
      </View>

      <View style={styles.resendContainer}>
        {resendIn > 0 ? (
          <Text style={styles.resendText}>
            Resend code in {formatCountdown(resendIn)}
          </Text>
        ) : (
          <BrandButton
            title={isResending ? 'Resending...' : 'Resend Code'}
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
          title="Change Phone Number"
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
              {currentStep === 'phone' ? 'Phone Verification' : 'Verify Code'}
            </Text>
            <Text style={styles.subtitle}>
              {currentStep === 'phone' 
                ? 'Enter your phone number to get started'
                : 'Enter the code sent to your phone'
              }
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BrandColors.primary,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  fixedHeader: {
    backgroundColor: BrandColors.primary,
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 28,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    position: 'relative',
    overflow: 'hidden',
    zIndex: 10,
  },
  keyboardView: {
    flex: 1,
    marginTop: -8, // Light overlap to keep separation
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  container: {
    flex: 1,
    paddingHorizontal: isSmallScreen ? 16 : 20,
    paddingTop: 28,
    maxWidth: 500,
    alignSelf: 'center',
    width: '100%',
  },
  decorativeCircle1: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.15)',
    top: -30,
    right: -30,
  },
  decorativeCircle2: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    top: 20,
    left: -20,
  },
  decorativeCircle3: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
    bottom: 10,
    right: 50,
  },
  decorativeCircle4: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
    top: 60,
    right: 80,
  },
  decorativeCircle5: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.08)',
    bottom: -20,
    left: 30,
  },
  logoContainer: {
    alignItems: 'center',
    zIndex: 2,
  },
  logoWrapper: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logoImage: {
    width: 52,
    height: 52,
  },
  title: {
    ...Typography.display,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    ...Typography.subtitle,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: isSmallScreen ? 20 : 25,
    padding: isSmallScreen ? 20 : 28,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    width: '100%',
    alignItems: 'center',
  },
  phoneIconContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    shadowColor: BrandColors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  verificationIconContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(34, 197, 94, 0.2)',
    shadowColor: '#22c55e',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    ...Typography.title,
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 6,
  },
  sectionSubtitle: {
    ...Typography.subtitle,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  welcomeText: {
    ...Typography.body,
    color: BrandColors.primary,
    textAlign: 'center',
    marginBottom: 12,
  },
  expiryHint: {
    ...Typography.small,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 12,
  },
  expiryHintExpired: {
    color: '#ef4444',
  },
  inputContainer: {
    marginBottom: 16,
    width: '100%',
  },
  input: {
    marginBottom: 4,
  },
  inputError: {
    borderColor: '#ef4444',
    borderWidth: 1,
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 16,
  },
  primaryButton: {
    width: '100%',
    minHeight: isSmallScreen ? 48 : 50,
  },
  buttonText: {
    ...Typography.button,
    fontSize: isSmallScreen ? 14 : 16,
    textAlign: 'center',
    flexShrink: 1,
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  resendText: {
    fontSize: 14,
    color: '#6b7280',
  },
  resendButton: {
    minWidth: 120,
  },
  backButton: {
    width: '100%',
    minHeight: isSmallScreen ? 48 : 50,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
    width: '100%',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    flex: 1,
    textAlign: 'left',
  },
});
