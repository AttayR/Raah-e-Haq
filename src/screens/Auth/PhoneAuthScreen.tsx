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
import { useDispatch, useSelector } from 'react-redux';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { RootState } from '../../store';
import {
  sendVerificationCodeThunk,
  verifyCodeThunk,
  setUserRole,
  clearError,
} from '../../store/thunks/authThunks';
import ThemedTextInput from '../../components/ThemedTextInput';
import BrandButton from '../../components/BrandButton';
import { useNavigation } from '@react-navigation/native';

type AuthStep = 'phone' | 'verification' | 'profile';

export default function PhoneAuthScreen() {
  const { theme } = useAppTheme();
  const navigation = useNavigation();
  const dispatch = useDispatch<any>();
  
  const { status, error, phoneNumber, verificationId, role } = useSelector(
    (state: RootState) => state.auth
  );

  const [currentStep, setCurrentStep] = useState<AuthStep>('phone');
  const [phoneInput, setPhoneInput] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<'driver' | 'passenger'>('passenger');
  const [countdown, setCountdown] = useState(0);

  // Countdown timer for resend code
  useEffect(() => {
    let interval: NodeJS.Timeout;
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
      await dispatch(verifyCodeThunk(verificationCode.trim(), selectedRole, displayName, email));
      // If successful, the auth listener will handle the state change
      // and redirect to the main app
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

  const handleBackToVerification = () => {
    setCurrentStep('verification');
    dispatch(clearError());
  };

  const renderPhoneStep = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.title, { color: theme.colors.text }]}>
        Enter your phone number
      </Text>
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
        We'll send you a verification code
      </Text>

      <ThemedTextInput
        placeholder="Phone number (e.g., +1234567890)"
        value={phoneInput}
        onChangeText={setPhoneInput}
        keyboardType="phone-pad"
        autoFocus
      />

      <View style={styles.roleContainer}>
        <Text style={[styles.roleLabel, { color: theme.colors.text }]}>
          I am a:
        </Text>
        <View style={styles.roleButtons}>
          <BrandButton
            title={selectedRole === 'passenger' ? 'Passenger ✓' : 'Passenger'}
            variant={selectedRole === 'passenger' ? 'primary' : 'secondary'}
            onPress={() => setSelectedRole('passenger')}
            style={styles.roleButton}
          />
          <BrandButton
            title={selectedRole === 'driver' ? 'Driver ✓' : 'Driver'}
            variant={selectedRole === 'driver' ? 'success' : 'secondary'}
            onPress={() => setSelectedRole('driver')}
            style={styles.roleButton}
          />
        </View>
      </View>

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
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
        We sent a code to {phoneNumber}
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
          <Text style={[styles.resendText, { color: theme.colors.textSecondary }]}>
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

  const renderProfileStep = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.title, { color: theme.colors.text }]}>
        Complete your profile
      </Text>
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
        Add some details to personalize your experience
      </Text>

      <ThemedTextInput
        placeholder="Display Name (optional)"
        value={displayName}
        onChangeText={setDisplayName}
        autoCapitalize="words"
      />

      <ThemedTextInput
        placeholder="Email (optional)"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <View style={styles.roleContainer}>
        <Text style={[styles.roleLabel, { color: theme.colors.text }]}>
          I am a:
        </Text>
        <View style={styles.roleButtons}>
          <BrandButton
            title={selectedRole === 'passenger' ? 'Passenger ✓' : 'Passenger'}
            variant={selectedRole === 'passenger' ? 'primary' : 'secondary'}
            onPress={() => setSelectedRole('passenger')}
            style={styles.roleButton}
          />
          <BrandButton
            title={selectedRole === 'driver' ? 'Driver ✓' : 'Driver'}
            variant={selectedRole === 'driver' ? 'success' : 'secondary'}
            onPress={() => setSelectedRole('driver')}
            style={styles.roleButton}
          />
        </View>
      </View>

      <BrandButton
        title="Continue"
        onPress={() => setCurrentStep('verification')}
        variant="primary"
      />

      <BrandButton
        title="Back to Verification"
        onPress={handleBackToVerification}
        variant="secondary"
        style={styles.backButton}
      />
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
        {currentStep === 'profile' && renderProfileStep()}
      </ScrollView>
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
  roleContainer: {
    gap: 12,
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  roleButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  roleButton: {
    flex: 1,
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
