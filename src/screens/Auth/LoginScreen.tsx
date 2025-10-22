 import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  StatusBar, 
  ImageBackground, 
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import BrandButton from '../../components/BrandButton';
import ThemedTextInput from '../../components/ThemedTextInput';
import { useNavigation } from '@react-navigation/native';
import { useApiAuth } from '../../hooks/useApiAuth';
import { BrandColors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { showToast } from '../../components/ToastProvider';

type LoginMethod = 'phone' | 'email';

const { width: screenWidth } = Dimensions.get('window');
const isSmallScreen = screenWidth < 375;

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const { login, error, isLoading, clearAuthError, forgotPasswordRequest } = useApiAuth();
  
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('phone');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});

  // Validation functions
  const validateEmail = (emailValue: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailValue);
  };

  const validatePassword = (passwordValue: string): boolean => {
    return passwordValue.length >= 6;
  };

  const clearValidationErrors = () => {
    setValidationErrors({});
  };

  const handlePhoneSignIn = () => {
    try {
      clearValidationErrors();
      navigation.navigate('PhoneAuth');
    } catch (err) {
      console.error('Navigation error:', err);
      showToast('error', 'Unable to navigate to phone authentication');
    }
  };

  const handleCreateAccount = () => {
    try {
      clearValidationErrors();
      navigation.navigate('Signup');
    } catch (err) {
      console.error('Navigation error:', err);
      showToast('error', 'Unable to navigate to signup');
    }
  };

  const handleEmailSignIn = async () => {
    try {
      clearValidationErrors();
      clearAuthError();

      // Validation
      const errors: {[key: string]: string} = {};
      
      if (!email.trim()) {
        errors.email = 'Email is required';
      } else if (!validateEmail(email.trim())) {
        errors.email = 'Please enter a valid email address';
      }
      
      if (!password.trim()) {
        errors.password = 'Password is required';
      } else if (!validatePassword(password.trim())) {
        errors.password = 'Password must be at least 6 characters';
      }

      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        return;
      }

      console.log('🔐 Starting login process...');
      console.log('📧 Email:', email.trim());
      
      const result = await login({ email: email.trim(), password: password.trim() });
      
      console.log('📨 Login result received:', result);
      console.log('🔍 Result type:', result.type);
      console.log('📊 Result payload:', result.payload);
      
      if (result.type.endsWith('/fulfilled')) {
        console.log('✅ Login successful!');
        console.log('👤 User data:', result.payload);
        showToast('success', 'Login successful!');
        // Navigation will be handled by the auth state change
      } else {
        console.log('❌ Login failed');
        console.log('🚨 Error details:', result.payload);
        showToast('error', (result.payload as string) || 'Login failed. Please try again.');
      }
    } catch (err: any) {
      console.error('Email sign in error:', err);
      showToast('error', 'An unexpected error occurred. Please try again.');
    }
  };

  const handleForgotPassword = async () => {
    try {
      clearValidationErrors();
      clearAuthError();
      
      if (!email.trim()) {
        setValidationErrors({ email: 'Please enter your email first' });
        return;
      }

      if (!validateEmail(email.trim())) {
        setValidationErrors({ email: 'Please enter a valid email address' });
        return;
      }

      const result = await forgotPasswordRequest(email.trim());
      
      if (result.type.endsWith('/fulfilled')) {
        showToast('success', 'Password reset email sent! Please check your inbox.');
      } else {
        showToast('error', (result.payload as string) || 'Failed to send password reset email. Please try again.');
      }
    } catch (err: any) {
      console.error('Password reset error:', err);
      showToast('error', 'Failed to send password reset email. Please try again.');
    }
  };

  const handleLoginMethodChange = (method: LoginMethod) => {
    try {
      clearValidationErrors();
      setLoginMethod(method);
    } catch (err) {
      console.error('Login method change error:', err);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      clearValidationErrors();
      showToast('info', 'Google Sign-In is not available with API authentication. Please use email or phone authentication.');
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      showToast('error', 'Google Sign-In is not available. Please use email or phone authentication.');
    }
  };

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
            <Text style={styles.title}>Welcome to RaaH-E-Haq</Text>
            <Text style={styles.subtitle}>
              Sign in to your account or create a new one
            </Text>
          </View>
        </View>

        {/* Scrollable Content */}
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            {/* Login Form Card */}
            <View style={styles.formCard}>
              {/* Login Method Toggle */}
              <View style={styles.toggleContainer}>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    loginMethod === 'phone' ? styles.toggleButtonActive : styles.toggleButtonInactive
                  ]}
                  onPress={() => handleLoginMethodChange('phone')}
                  activeOpacity={0.7}
                >
                  <Icon 
                    name="phone" 
                    size={20} 
                    color={loginMethod === 'phone' ? '#ffffff' : BrandColors.primary} 
                  />
                  <Text style={[
                    styles.toggleButtonText,
                    loginMethod === 'phone' ? styles.toggleButtonTextActive : styles.toggleButtonTextInactive
                  ]} numberOfLines={1}>
                    Phone
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    loginMethod === 'email' ? styles.toggleButtonActive : styles.toggleButtonInactive
                  ]}
                  onPress={() => handleLoginMethodChange('email')}
                  activeOpacity={0.7}
                >
                  <Icon 
                    name="email" 
                    size={20} 
                    color={loginMethod === 'email' ? '#ffffff' : BrandColors.primary} 
                  />
                  <Text style={[
                    styles.toggleButtonText,
                    loginMethod === 'email' ? styles.toggleButtonTextActive : styles.toggleButtonTextInactive
                  ]} numberOfLines={1}>
                    Email
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Phone Login */}
              {loginMethod === 'phone' && (
                <View style={styles.phoneSection}>
                  <View style={styles.phoneIconContainer}>
                    <Icon name="smartphone" size={48} color={BrandColors.primary} />
                  </View>
                  <Text style={styles.sectionTitle}>Sign in with Phone</Text>
                  <Text style={styles.sectionSubtitle}>
                    We'll send you a verification code
                  </Text>
                  <View style={styles.buttonContainer}>
                    <BrandButton
                      title="Sign in with Phone"
                      onPress={handlePhoneSignIn}
                      variant="primary"
                      style={styles.primaryButton}
                      disabled={isLoading}
                      textStyle={styles.buttonText}
                    />
                  </View>
                </View>
              )}

              {/* Email Login */}
              {loginMethod === 'email' && (
                <View style={styles.emailSection}>
                  <View style={styles.emailIconContainer}>
                    <Icon name="email" size={48} color={BrandColors.primary} />
                  </View>
                  <Text style={styles.sectionTitle}>Sign in with Email</Text>
                  <Text style={styles.sectionSubtitle}>
                    Enter your email and password
                  </Text>
                  
                  <View style={styles.inputContainer}>
                    <ThemedTextInput
                      placeholder="Email"
                      value={email}
                      onChangeText={(text) => {
                        setEmail(text);
                        if (validationErrors.email) {
                          setValidationErrors(prev => ({ ...prev, email: '' }));
                        }
                      }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      style={styles.input}
                    />
                    {validationErrors.email && (
                      <Text style={styles.errorText}>{validationErrors.email}</Text>
                    )}
                  </View>
                  
                  <View style={styles.inputContainer}>
                    <ThemedTextInput
                      placeholder="Password"
                      value={password}
                      onChangeText={(text) => {
                        setPassword(text);
                        if (validationErrors.password) {
                          setValidationErrors(prev => ({ ...prev, password: '' }));
                        }
                      }}
                      secureTextEntry
                      style={styles.input}
                    />
                    {validationErrors.password && (
                      <Text style={styles.errorText}>{validationErrors.password}</Text>
                    )}
                  </View>
                  
                  <View style={styles.buttonContainer}>
                    <BrandButton
                      title={isLoading ? 'Signing in...' : 'Sign in with Email'}
                      onPress={handleEmailSignIn}
                      variant="primary"
                      disabled={isLoading}
                      style={styles.primaryButton}
                      textStyle={styles.buttonText}
                    />
                  </View>

                  {/* Divider */}
                  <View style={styles.dividerContainer}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>OR</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  {/* Google Sign-In Button */}
                  <View style={styles.buttonContainer}>
                    <TouchableOpacity
                      style={styles.googleButton}
                      onPress={handleGoogleSignIn}
                      disabled={isLoading}
                      activeOpacity={0.7}
                    >
                      <View style={styles.googleLogoContainer}>
                        <View style={styles.googleLogo}>
                          <View style={styles.googleLogoInner}>
                            <Text style={styles.googleG}>G</Text>
                          </View>
                        </View>
                      </View>
                      <Text style={styles.googleButtonText}>
                        {isLoading ? 'Signing in...' : 'Continue with Google'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  
                  <TouchableOpacity
                    onPress={handleForgotPassword}
                    style={styles.forgotPasswordContainer}
                    disabled={isLoading}
                  >
                    <Text style={[styles.forgotPasswordText, isLoading && styles.disabledText]}>
                      Forgot Password?
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {error && (
                <View style={styles.errorContainer}>
                  <Icon name="error" size={20} color="#ef4444" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
            </View>

            {/* Create Account Section */}
            <View style={styles.createAccountCard}>
              <Text style={styles.createAccountTitle}>New to RaaH-E-Haq?</Text>
              <Text style={styles.createAccountSubtitle}>
                Create an account to get started
              </Text>
              <View style={styles.buttonContainer}>
                <BrandButton
                  title="Create New Account"
                  onPress={handleCreateAccount}
                  variant="secondary"
                  style={styles.createAccountButton}
                  disabled={isLoading}
                  textStyle={styles.buttonText}
                />
              </View>
            </View>
          </View>
        </ScrollView>
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
  scrollView: {
    flex: 1,
    marginTop: -8, // Light overlap to keep separation
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
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 15,
    padding: 6,
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: isSmallScreen ? 12 : 14,
    paddingHorizontal: isSmallScreen ? 16 : 20,
    borderRadius: 12,
    gap: isSmallScreen ? 8 : 10,
    minHeight: 44,
  },
  toggleButtonActive: {
    backgroundColor: BrandColors.primary,
  },
  toggleButtonInactive: {
    backgroundColor: 'transparent',
  },
  toggleButtonText: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '600',
    flexShrink: 1,
  },
  toggleButtonTextActive: {
    color: '#ffffff',
  },
  toggleButtonTextInactive: {
    color: BrandColors.primary,
  },
  phoneSection: {
    alignItems: 'center',
  },
  emailSection: {
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
  emailIconContainer: {
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
  forgotPasswordContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  forgotPasswordText: {
    ...Typography.body,
    color: BrandColors.primary,
  },
  disabledText: {
    color: '#9ca3af',
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
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    ...Typography.body,
    color: '#6b7280',
    marginHorizontal: 16,
    fontSize: 14,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  googleLogoContainer: {
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleLogo: {
    width: 20,
    height: 20,
    borderRadius: 2,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 0.5,
    borderColor: '#e5e7eb',
  },
  googleLogoInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleG: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'Roboto',
    textAlign: 'center',
  },
  googleButtonText: {
    ...Typography.body,
    color: '#374151',
    fontWeight: '600',
  },
  createAccountCard: {
    backgroundColor: '#ffffff',
    borderRadius: 25,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  createAccountTitle: {
    ...Typography.title,
    color: '#1f2937',
    marginBottom: 6,
  },
  createAccountSubtitle: {
    ...Typography.subtitle,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  createAccountButton: {
    width: '100%',
    minHeight: isSmallScreen ? 48 : 50,
  },
});
