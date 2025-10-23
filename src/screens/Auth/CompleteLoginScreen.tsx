import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useApiAuth } from '../../hooks/useApiAuth';
import { BrandColors } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AuthErrorHandler from '../../utils/AuthErrorHandler';
import ValidationUtils from '../../utils/ValidationUtils';

type LoginMethod = 'email' | 'otp';

interface EmailLoginData {
  email: string;
  password: string;
}

interface OtpLoginData {
  phone: string;
  otp_code: string;
}

const CompleteLoginScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { login, sendOtpToPhone, verifyOtpCode, isLoading } = useApiAuth();
  
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('email');
  const [emailData, setEmailData] = useState<EmailLoginData>({
    email: '',
    password: '',
  });
  const [otpData, setOtpData] = useState<OtpLoginData>({
    phone: '',
    otp_code: '',
  });
  const [otpSent, setOtpSent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateEmailLogin = (): boolean => {
    const rules = ValidationUtils.getLoginRules('email');
    const validationResult = ValidationUtils.validateForm(emailData, rules);
    setErrors(validationResult.errors);
    return validationResult.isValid;
  };

  const validateOtpLogin = (): boolean => {
    const rules = ValidationUtils.getLoginRules('otp');
    const validationResult = ValidationUtils.validateForm(otpData, rules);
    setErrors(validationResult.errors);
    return validationResult.isValid;
  };

  const handleEmailLogin = async () => {
    if (!validateEmailLogin()) return;
    
    setIsSubmitting(true);
    try {
      console.log('🚀 Attempting email login:', emailData);
      
      const result = await login(emailData);
      
      if (result.type === 'auth/loginUser/fulfilled') {
        console.log('✅ Login successful');
        AuthErrorHandler.showSuccessMessage('Login Successful', 'Welcome back!');
      } else {
        AuthErrorHandler.showErrorMessage('Login Failed', 'Invalid email or password. Please try again.');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      AuthErrorHandler.handleLoginError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendOtp = async () => {
    if (!validateOtpLogin()) return;
    
    setIsSubmitting(true);
    try {
      console.log('📱 Sending OTP to:', otpData.phone);
      
      const result = await sendOtpToPhone(otpData.phone);
      
      if (result.type === 'auth/sendOtp/fulfilled') {
        setOtpSent(true);
        AuthErrorHandler.showSuccessMessage(
          'OTP Sent',
          `A verification code has been sent to ${otpData.phone}. Please check your messages.`
        );
      } else {
        AuthErrorHandler.showErrorMessage('OTP Failed', 'Failed to send OTP. Please try again.');
      }
    } catch (error: any) {
      console.error('OTP send error:', error);
      AuthErrorHandler.handleOtpError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpLogin = async () => {
    if (!validateOtpLogin()) return;
    
    setIsSubmitting(true);
    try {
      console.log('🔐 Verifying OTP:', otpData);
      
      const result = await verifyOtpCode(otpData);
      
      if (result.type === 'auth/verifyOtp/fulfilled') {
        console.log('✅ OTP verification successful');
        AuthErrorHandler.showSuccessMessage('Login Successful', 'Welcome back!');
      } else {
        AuthErrorHandler.showErrorMessage('Login Failed', 'Invalid OTP code. Please try again.');
      }
    } catch (error: any) {
      console.error('OTP verification error:', error);
      AuthErrorHandler.handleOtpError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateEmailData = (field: keyof EmailLoginData, value: string) => {
    setEmailData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const updateOtpData = (field: keyof OtpLoginData, value: string) => {
    if (field === 'phone') {
      // Auto-format phone number as user types
      const formattedPhone = formatPhoneNumber(value);
      setOtpData(prev => ({ ...prev, [field]: formattedPhone }));
    } else {
      setOtpData(prev => ({ ...prev, [field]: value }));
    }
    
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
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

  const switchLoginMethod = (method: LoginMethod) => {
    setLoginMethod(method);
    setErrors({});
    setOtpSent(false);
    setOtpData({ phone: '', otp_code: '' });
  };

  const renderInput = (
    field: string,
    label: string,
    placeholder: string,
    value: string,
    onChangeText: (text: string) => void,
    keyboardType: 'default' | 'email-address' | 'numeric' | 'phone-pad' = 'default',
    secureTextEntry: boolean = false,
    required: boolean = true
  ) => (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>
        {label} {required && <Text style={styles.required}>*</Text>}
      </Text>
      <TextInput
        style={[styles.input, errors[field] && styles.inputError]}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {errors[field] && <Text style={styles.errorText}>{errors[field]}</Text>}
    </View>
  );

  const renderEmailLogin = () => (
    <View style={styles.loginForm}>
      <Text style={styles.formTitle}>Login with Email</Text>
      
      {renderInput(
        'email',
        'Email',
        'Enter your email',
        emailData.email,
        (value) => updateEmailData('email', value),
        'email-address'
      )}
      
      {renderInput(
        'password',
        'Password',
        'Enter your password',
        emailData.password,
        (value) => updateEmailData('password', value),
        'default',
        true
      )}
      
      <TouchableOpacity
        style={styles.forgotPasswordButton}
        onPress={() => {
          // TODO: Implement forgot password
          Alert.alert('Forgot Password', 'Forgot password functionality will be implemented soon.');
        }}
      >
        <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[
          styles.loginButton,
          (isSubmitting || isLoading) && styles.loginButtonDisabled
        ]}
        onPress={handleEmailLogin}
        disabled={isSubmitting || isLoading}
      >
        {isSubmitting || isLoading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.loginButtonText}>Login</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderOtpLogin = () => (
    <View style={styles.loginForm}>
      <Text style={styles.formTitle}>Login with OTP</Text>
      
      {renderInput(
        'phone',
        'Phone Number',
        '+92-300-1234567',
        otpData.phone,
        (value) => updateOtpData('phone', value),
        'phone-pad'
      )}
      
      {otpSent && renderInput(
        'otp_code',
        'OTP Code',
        'Enter 6-digit code',
        otpData.otp_code,
        (value) => updateOtpData('otp_code', value),
        'numeric'
      )}
      
      <View style={styles.otpButtonContainer}>
        {!otpSent ? (
          <TouchableOpacity
            style={[
              styles.otpButton,
              (isSubmitting || isLoading) && styles.otpButtonDisabled
            ]}
            onPress={handleSendOtp}
            disabled={isSubmitting || isLoading}
          >
            {isSubmitting || isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.otpButtonText}>Send OTP</Text>
            )}
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={[
                styles.otpButton,
                (isSubmitting || isLoading) && styles.otpButtonDisabled
              ]}
              onPress={handleOtpLogin}
              disabled={isSubmitting || isLoading}
            >
              {isSubmitting || isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.otpButtonText}>Verify OTP</Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.resendButton}
              onPress={() => {
                setOtpSent(false);
                setOtpData(prev => ({ ...prev, otp_code: '' }));
              }}
            >
              <Text style={styles.resendButtonText}>Resend OTP</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Login</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView 
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeTitle}>Welcome Back!</Text>
            <Text style={styles.welcomeSubtitle}>
              Sign in to continue to RaaHeHaq
            </Text>
          </View>

          <View style={styles.loginMethodContainer}>
            <Text style={styles.methodTitle}>Choose Login Method</Text>
            <View style={styles.methodButtons}>
              <TouchableOpacity
                style={[
                  styles.methodButton,
                  loginMethod === 'email' && styles.methodButtonActive
                ]}
                onPress={() => switchLoginMethod('email')}
              >
                <Icon 
                  name="email" 
                  size={20} 
                  color={loginMethod === 'email' ? 'white' : BrandColors.primary} 
                />
                <Text style={[
                  styles.methodButtonText,
                  loginMethod === 'email' && styles.methodButtonTextActive
                ]}>
                  Email
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.methodButton,
                  loginMethod === 'otp' && styles.methodButtonActive
                ]}
                onPress={() => switchLoginMethod('otp')}
              >
                <Icon 
                  name="phone" 
                  size={20} 
                  color={loginMethod === 'otp' ? 'white' : BrandColors.primary} 
                />
                <Text style={[
                  styles.methodButtonText,
                  loginMethod === 'otp' && styles.methodButtonTextActive
                ]}>
                  OTP
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {loginMethod === 'email' ? renderEmailLogin() : renderOtpLogin()}

          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>Don't have an account?</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('CompleteRegistration')}
            >
              <Text style={styles.registerLink}>Register Now</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  welcomeContainer: {
    paddingHorizontal: 20,
    paddingVertical: 30,
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  loginMethodContainer: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  methodTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 15,
    textAlign: 'center',
  },
  methodButtons: {
    flexDirection: 'row',
    gap: 15,
  },
  methodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderColor: BrandColors.primary,
    borderRadius: 12,
    backgroundColor: 'white',
  },
  methodButtonActive: {
    backgroundColor: BrandColors.primary,
  },
  methodButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: BrandColors.primary,
    marginLeft: 8,
  },
  methodButtonTextActive: {
    color: 'white',
  },
  loginForm: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  required: {
    color: '#ef4444',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginTop: 5,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: BrandColors.primary,
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: BrandColors.primary,
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
  },
  loginButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  otpButtonContainer: {
    gap: 15,
  },
  otpButton: {
    backgroundColor: BrandColors.primary,
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
  },
  otpButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  otpButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  resendButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  resendButtonText: {
    fontSize: 14,
    color: BrandColors.primary,
    fontWeight: '500',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 5,
  },
  registerText: {
    fontSize: 14,
    color: '#6b7280',
  },
  registerLink: {
    fontSize: 14,
    color: BrandColors.primary,
    fontWeight: '600',
  },
});

export default CompleteLoginScreen;
