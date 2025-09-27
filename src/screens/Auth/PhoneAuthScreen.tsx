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
import Icon from 'react-native-vector-icons/MaterialIcons';

type AuthStep = 'phone' | 'verification';

const { width: screenWidth } = Dimensions.get('window');
const isSmallScreen = screenWidth < 375;

export default function PhoneAuthScreen() {
  const { sendOtpToPhone, verifyOtpCode, error, isLoading, isOtpSent, isOtpVerified } = useApiAuth();

  // Debug logging for state changes
  useEffect(() => {
    console.log('PhoneAuthScreen - Auth state changed:', { isLoading, error, isOtpSent, isOtpVerified });
  }, [isLoading, error, isOtpSent, isOtpVerified]);

  const [currentStep, setCurrentStep] = useState<AuthStep>('phone');
  const [phoneInput, setPhoneInput] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

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
    if (!phoneInput.trim()) {
      showToast('error', 'Please enter a phone number');
      return;
    }

    try {
      const result = await sendOtpToPhone(phoneInput.trim());
      if (result.type.endsWith('/fulfilled')) {
        setCurrentStep('verification');
        setCountdown(60); // 60 seconds countdown
        showToast('success', 'OTP sent successfully');
      } else {
        showToast('error', (result.payload as string) || 'Failed to send OTP');
      }
    } catch (err: any) {
      console.error('Error sending verification code:', err);
      showToast('error', 'Failed to send OTP');
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      showToast('error', 'Please enter the verification code');
      return;
    }

    try {
      const result = await verifyOtpCode({
        phone: phoneInput.trim(),
        otp_code: verificationCode.trim()
      });
      
      if (result.type.endsWith('/fulfilled')) {
        // Show success toast
        setShowSuccessToast(true);
        showToast('success', 'Phone number verified successfully!');
        
        // Navigation will be handled by AuthFlow component based on auth state
        console.log('PhoneAuthScreen - Phone verified successfully');
      } else {
        showToast('error', (result.payload as string) || 'Invalid verification code');
      }
      
    } catch (err: any) {
      console.error('Error verifying code:', err);
      showToast('error', 'Failed to verify code');
    }
  };

  const handleResendCode = async () => {
    try {
      const result = await sendOtpToPhone(phoneInput.trim());
      if (result.type.endsWith('/fulfilled')) {
        setCountdown(60);
        setVerificationCode('');
        showToast('success', 'Verification code sent again');
      } else {
        showToast('error', (result.payload as string) || 'Failed to resend code');
      }
    } catch (err: any) {
      console.error('Error resending code:', err);
      showToast('error', 'Failed to resend code');
    }
  };

  const handleBackToPhone = () => {
    setCurrentStep('phone');
    setVerificationCode('');
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
          placeholder="Phone number (e.g., +923486716994)"
          value={phoneInput}
          onChangeText={setPhoneInput}
          keyboardType="phone-pad"
          autoFocus
          style={styles.input}
        />
      </View>

      <View style={styles.buttonContainer}>
        <BrandButton
          title={isLoading ? 'Sending...' : 'Send Code'}
          onPress={handleSendCode}
          variant="primary"
          disabled={isLoading}
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
      <Text style={styles.testInfo}>
        Test Code: 123456
      </Text>

      <View style={styles.inputContainer}>
        <ThemedTextInput
          placeholder="6-digit code"
          value={verificationCode}
          onChangeText={setVerificationCode}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          style={styles.input}
        />
      </View>

      <View style={styles.buttonContainer}>
        <BrandButton
          title={isLoading ? 'Verifying...' : 'Verify Code'}
          onPress={handleVerifyCode}
          variant="primary"
          disabled={isLoading}
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
            title="Resend Code"
            onPress={handleResendCode}
            variant="secondary"
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
  inputContainer: {
    marginBottom: 16,
    width: '100%',
  },
  input: {
    marginBottom: 4,
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
