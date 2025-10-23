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
import ThemedTextInput from '../../components/ThemedTextInput';
import BrandButton from '../../components/BrandButton';
import Toast from '../../components/Toast';
import { showToast } from '../../components/ToastProvider';
import { BrandColors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import OtpService from '../../services/otpService';
import Icon from 'react-native-vector-icons/MaterialIcons';

type AuthStep = 'phone' | 'verification';

const { width: screenWidth } = Dimensions.get('window');
const isSmallScreen = screenWidth < 375;

export default function PhoneAuthScreen() {
  const { sendOtpToPhone, verifyOtpCode, error, isLoading, isOtpSent, isOtpVerified } = useApiAuth();

  // Debug logging for state changes
  useEffect(() => {
    console.log('📱 PhoneAuthScreen - Auth state changed:', { isLoading, error, isOtpSent, isOtpVerified });
  }, [isLoading, error, isOtpSent, isOtpVerified]);

  const [currentStep, setCurrentStep] = useState<AuthStep>('phone');
  const [phoneInput, setPhoneInput] = useState('+92-');
  const [verificationCode, setVerificationCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [_otpSentAt, setOtpSentAt] = useState<Date | null>(null);
  const [_otpExpiresIn, setOtpExpiresIn] = useState<number>(0);
  const [phoneError, setPhoneError] = useState<string>('');
  const [otpError, setOtpError] = useState<string>('');
  const [isResending, setIsResending] = useState(false);
  const [receivedOtpCode, setReceivedOtpCode] = useState<string>('');

  // Countdown timer for resend code
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [countdown]);

  const handleSendCode = async () => {
    console.log('📱 PhoneAuthScreen - Starting send OTP process');
    console.log('📞 Phone input:', phoneInput);
    
    // Clear previous errors
    setPhoneError('');
    
    // Normalize phone number first
    const normalized = OtpService.normalizePakistanPhone(phoneInput.trim());
    if (!normalized.success) {
      console.log('❌ PhoneAuthScreen - Phone normalization failed:', normalized.error);
      setPhoneError(normalized.error || 'Invalid phone number');
      showToast('error', normalized.error || 'Invalid phone number');
      return;
    }

    // Validate normalized phone number
    const validation = OtpService.validatePhoneNumber(normalized.phone!);
    if (!validation.isValid) {
      console.log('❌ PhoneAuthScreen - Phone validation failed:', validation.error);
      setPhoneError(validation.error || 'Invalid phone number');
      showToast('error', validation.error || 'Invalid phone number');
      return;
    }

    console.log('✅ PhoneAuthScreen - Phone validation passed');

    try {
      const result = await sendOtpToPhone(normalized.phone!);
      console.log('📨 PhoneAuthScreen - Send OTP result:', result.type);
      
      if (result.type.endsWith('/fulfilled')) {
        console.log('✅ PhoneAuthScreen - OTP sent successfully');
        console.log('🔢 PhoneAuthScreen - Received OTP code:', (result.payload as any)?.otp_code);
        
        setCurrentStep('verification');
        setCountdown(60); // 60 seconds countdown
        setOtpSentAt(new Date());
        setOtpExpiresIn(300); // 5 minutes expiration
        setPhoneError('');
        setReceivedOtpCode((result.payload as any)?.otp_code || '');
        showToast('success', 'OTP sent successfully');
      } else {
        const errorMessage = (result.payload as string) || 'Failed to send OTP';
        console.log('❌ PhoneAuthScreen - OTP send failed:', errorMessage);
        setPhoneError(errorMessage);
        showToast('error', errorMessage);
      }
    } catch (err: any) {
      console.error('💥 PhoneAuthScreen - Error sending verification code:', err);
      const errorMessage = err.message || 'Failed to send OTP';
      setPhoneError(errorMessage);
      showToast('error', errorMessage);
    }
  };

  const handleVerifyCode = async () => {
    console.log('📱 PhoneAuthScreen - Starting verify OTP process');
    console.log('🔢 OTP input:', verificationCode);
    
    // Clear previous errors
    setOtpError('');
    
    // Validate OTP data
    const normalized = OtpService.normalizePakistanPhone(phoneInput.trim());
    if (!normalized.success) {
      console.log('❌ PhoneAuthScreen - Phone normalization failed:', normalized.error);
      setOtpError(normalized.error || 'Invalid phone number');
      showToast('error', normalized.error || 'Invalid phone number');
      return;
    }

    const otpData = {
      phone: normalized.phone!,
      otp_code: verificationCode.trim()
    };
    
    const validation = OtpService.validateOtpData(otpData);
    if (!validation.isValid) {
      console.log('❌ PhoneAuthScreen - OTP validation failed:', validation.error);
      setOtpError(validation.error || 'Invalid OTP code');
      showToast('error', validation.error || 'Invalid OTP code');
      return;
    }

    console.log('✅ PhoneAuthScreen - OTP validation passed');

    try {
      const result = await verifyOtpCode(otpData);
      console.log('📨 PhoneAuthScreen - Verify OTP result:', result.type);
      
      if (result.type.endsWith('/fulfilled')) {
        console.log('✅ PhoneAuthScreen - Phone verified successfully');
        // Show success toast
        setShowSuccessToast(true);
        showToast('success', 'Phone number verified successfully!');
        
        // Navigation will be handled by AuthFlow component based on auth state
        console.log('PhoneAuthScreen - Phone verified successfully');
      } else {
        const errorMessage = (result.payload as string) || 'Invalid verification code';
        console.log('❌ PhoneAuthScreen - OTP verification failed:', errorMessage);
        setOtpError(errorMessage);
        showToast('error', errorMessage);
      }
      
    } catch (err: any) {
      console.error('💥 PhoneAuthScreen - Error verifying code:', err);
      const errorMessage = err.message || 'Failed to verify code';
      setOtpError(errorMessage);
      showToast('error', errorMessage);
    }
  };

  const handleResendCode = async () => {
    console.log('📱 PhoneAuthScreen - Starting resend OTP process');
    setIsResending(true);
    
    try {
      // Normalize phone number first
      const normalized = OtpService.normalizePakistanPhone(phoneInput.trim());
      if (!normalized.success) {
        console.log('❌ PhoneAuthScreen - Phone normalization failed:', normalized.error);
        setOtpError(normalized.error || 'Invalid phone number');
        showToast('error', normalized.error || 'Invalid phone number');
        return;
      }

      const result = await sendOtpToPhone(normalized.phone!);
      console.log('📨 PhoneAuthScreen - Resend OTP result:', result.type);
      
      if (result.type.endsWith('/fulfilled')) {
        console.log('✅ PhoneAuthScreen - OTP resent successfully');
        console.log('🔢 PhoneAuthScreen - New OTP code:', (result.payload as any)?.otp_code);
        
        setCountdown(60);
        setVerificationCode('');
        setOtpSentAt(new Date());
        setOtpExpiresIn(300); // 5 minutes expiration
        setOtpError('');
        setReceivedOtpCode((result.payload as any)?.otp_code || '');
        showToast('success', 'Verification code sent again');
      } else {
        const errorMessage = (result.payload as string) || 'Failed to resend code';
        console.log('❌ PhoneAuthScreen - Resend OTP failed:', errorMessage);
        setOtpError(errorMessage);
        showToast('error', errorMessage);
      }
    } catch (err: any) {
      console.error('💥 PhoneAuthScreen - Error resending code:', err);
      const errorMessage = err.message || 'Failed to resend code';
      setOtpError(errorMessage);
      showToast('error', errorMessage);
    } finally {
      setIsResending(false);
    }
  };

  const handleBackToPhone = () => {
    setCurrentStep('phone');
    setVerificationCode('');
    setReceivedOtpCode('');
  };

  const formatPhoneNumber = (phone: string): string => {
    // Remove all non-digit characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');
    
    // If it starts with 92, add +
    if (cleaned.startsWith('92') && !cleaned.startsWith('+92')) {
      cleaned = '+' + cleaned;
    }
    
    // If it starts with 0, replace with +92
    if (cleaned.startsWith('0')) {
      cleaned = '+92' + cleaned.substring(1);
    }
    
    // If it doesn't start with +92, add it
    if (!cleaned.startsWith('+92')) {
      cleaned = '+92' + cleaned;
    }
    
    // Format as +92-XXX-XXXXXXX
    if (cleaned.length >= 4) {
      const countryCode = cleaned.substring(0, 3); // +92
      const areaCode = cleaned.substring(3, 6);    // XXX
      const number = cleaned.substring(6, 13);      // XXXXXXX
      
      let formatted = countryCode;
      if (areaCode) {
        formatted += '-' + areaCode;
      }
      if (number) {
        formatted += '-' + number;
      }
      
      return formatted;
    }
    
    return cleaned;
  };

  const handlePhoneInputChange = (text: string) => {
    const formattedPhone = formatPhoneNumber(text);
    setPhoneInput(formattedPhone);
    setPhoneError('');
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
          placeholder="+92-300-1234567"
          value={phoneInput}
          onChangeText={handlePhoneInputChange}
          keyboardType="phone-pad"
          autoFocus
          style={[styles.input, phoneError && styles.inputError]}
          maxLength={15}
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
          title={isLoading ? 'Sending...' : 'Send Code'}
          onPress={handleSendCode}
          variant="primary"
          disabled={isLoading || !phoneInput.trim()}
          style={styles.primaryButton}
          textStyle={styles.buttonText}
        />
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Icon name="error" size={20} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
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
      {receivedOtpCode ? (
        <View style={styles.otpCodeContainer}>
          <Text style={styles.otpCodeLabel}>Your OTP Code:</Text>
          <Text style={styles.otpCodeValue}>{receivedOtpCode}</Text>
          <BrandButton
            title="Use This OTP"
            onPress={() => {
              setVerificationCode(receivedOtpCode);
              showToast('success', 'OTP code filled in input field');
            }}
            variant="secondary"
            style={styles.copyButton}
            textStyle={styles.copyButtonText}
          />
        </View>
      ) : (
        <Text style={styles.testInfo}>
          Test Code: 123456
        </Text>
      )}

      <View style={styles.inputContainer}>
        <ThemedTextInput
          placeholder="6-digit code"
          value={verificationCode}
          onChangeText={(text) => {
            setVerificationCode(text);
            setOtpError(''); // Clear error when user types
          }}
          keyboardType="number-pad"
          maxLength={6}
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
          disabled={isLoading || !verificationCode.trim()}
          style={styles.primaryButton}
          textStyle={styles.buttonText}
        />
      </View>

      <View style={styles.resendContainer}>
        {countdown > 0 ? (
          <Text style={styles.resendText}>
            Resend code in {countdown}s
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

      {error && (
        <View style={styles.errorContainer}>
          <Icon name="error" size={20} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
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

      <Toast
        message="Phone number verified successfully! Redirecting..."
        type="success"
        visible={showSuccessToast}
        onHide={() => setShowSuccessToast(false)}
        duration={3000}
      />
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
  testInfo: {
    ...Typography.small,
    color: BrandColors.primary,
    textAlign: 'center',
    marginBottom: 12,
  },
  otpCodeContainer: {
    backgroundColor: '#f0f9ff',
    borderColor: BrandColors.primary,
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  otpCodeLabel: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
    fontWeight: '500',
  },
  otpCodeValue: {
    fontSize: 24,
    color: BrandColors.primary,
    fontWeight: 'bold',
    letterSpacing: 4,
    fontFamily: 'monospace',
  },
  copyButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 36,
  },
  copyButtonText: {
    fontSize: 12,
    fontWeight: '500',
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
