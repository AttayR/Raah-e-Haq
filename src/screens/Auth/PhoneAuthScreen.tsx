import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { RootState } from '../../store';
import { clearError } from '../../store/slices/authSlice';
import {
  sendVerificationCodeThunk,
  verifyCodeThunk,
} from '../../store/thunks/authThunks';
import ThemedTextInput from '../../components/ThemedTextInput';
import BrandButton from '../../components/BrandButton';
import Toast from '../../components/Toast';
import { useNavigation } from '@react-navigation/native';

type AuthStep = 'phone' | 'verification';

export default function PhoneAuthScreen() {
  const { theme } = useAppTheme();
  const navigation = useNavigation<any>();
  const dispatch = useDispatch<any>();

  const { status, error, phoneNumber } = useSelector(
    (state: RootState) => state.auth
  );

  // Debug logging for state changes
  useEffect(() => {
    console.log('PhoneAuthScreen - Auth state changed:', { status, error, phoneNumber });
  }, [status, error, phoneNumber]);

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
      Alert.alert('Error', 'Please enter a phone number');
      return;
    }

    try {
      await dispatch(sendVerificationCodeThunk(phoneInput.trim()));
      setCurrentStep('verification');
      setCountdown(60); // 60 seconds countdown
    } catch (error: any) {
      // Error is handled in the thunk
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      Alert.alert('Error', 'Please enter the verification code');
      return;
    }

    try {
      // Verify the code without setting a role
      await dispatch(verifyCodeThunk(verificationCode.trim()));
      
      // Show success toast
      setShowSuccessToast(true);
      
      // Navigate to role selection after a short delay
      setTimeout(() => {
        navigation.navigate('RoleSelection');
      }, 2000);
      
    } catch (error: any) {
      // Error is handled in the thunk
    }
  };

  const handleResendCode = async () => {
    try {
      await dispatch(sendVerificationCodeThunk(phoneInput.trim()));
      setCountdown(60);
      setVerificationCode('');
    } catch (error: any) {
      // Error is handled in the thunk
    }
  };

  const handleBackToPhone = () => {
    setCurrentStep('phone');
    setVerificationCode('');
    dispatch(clearError());
  };

  const renderPhoneStep = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.title, { color: theme.colors.text }]}>
        Enter your phone number
      </Text>
      <Text style={[styles.subtitle, { color: theme.colors.mutedText }]}>
        We'll send you a verification code
      </Text>

      <ThemedTextInput
        placeholder="Phone number (e.g., +923486716994)"
        value={phoneInput}
        onChangeText={setPhoneInput}
        keyboardType="phone-pad"
        autoFocus
      />

      <BrandButton
        title={status === 'loading' ? 'Sending...' : 'Send Code'}
        onPress={handleSendCode}
        variant="primary"
        disabled={status === 'loading'}
      />

      {error && (
        <Text style={[styles.errorText, { color: theme.colors.warning }]}>
          {error}
        </Text>
      )}
    </View>
  );

  const renderVerificationStep = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.title, { color: theme.colors.text }]}>
        Enter verification code
      </Text>
      <Text style={[styles.subtitle, { color: theme.colors.mutedText }]}>
        We sent a code to {phoneNumber}
      </Text>
      <Text style={[styles.testInfo, { color: theme.colors.primary }]}>
        Test Code: 123456
      </Text>

      <ThemedTextInput
        placeholder="6-digit code"
        value={verificationCode}
        onChangeText={setVerificationCode}
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
      />

      <BrandButton
        title={status === 'verifying' ? 'Verifying...' : 'Verify Code'}
        onPress={handleVerifyCode}
        variant="primary"
        disabled={status === 'verifying'}
      />

      <View style={styles.resendContainer}>
        {countdown > 0 ? (
          <Text style={[styles.resendText, { color: theme.colors.mutedText }]}>
            Resend code in {countdown}s
          </Text>
        ) : (
          <BrandButton
            title="Resend Code"
            onPress={handleResendCode}
            variant="secondary"
            style={styles.resendButton}
          />
        )}
      </View>

      <BrandButton
        title="Change Phone Number"
        onPress={handleBackToPhone}
        variant="secondary"
        style={styles.backButton}
      />

      {error && (
        <Text style={[styles.errorText, { color: theme.colors.warning }]}>
          {error}
        </Text>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {currentStep === 'phone' && renderPhoneStep()}
        {currentStep === 'verification' && renderVerificationStep()}
      </ScrollView>

      <Toast
        message="Phone number verified successfully! Redirecting to role selection..."
        type="success"
        visible={showSuccessToast}
        onHide={() => setShowSuccessToast(false)}
        duration={3000}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  stepContainer: {
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  testInfo: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '600',
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  resendText: {
    fontSize: 14,
  },
  resendButton: {
    minWidth: 120,
  },
  backButton: {
    marginTop: 8,
  },
  errorText: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
  },
});
