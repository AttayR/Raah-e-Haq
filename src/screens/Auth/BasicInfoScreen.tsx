import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  SafeAreaView, 
  StatusBar, 
  ImageBackground, 
  TouchableOpacity,
  Image,
  Dimensions,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { setProfileCompleted, setUserProfile } from '../../store/slices/authSlice';
import BrandButton from '../../components/BrandButton';
import ThemedTextInput from '../../components/ThemedTextInput';
import { saveUserBasicInfo } from '../../services/userService';
import { showToast } from '../../components/ToastProvider';
import { BrandColors } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface BasicInfoParams {
  role: 'driver' | 'passenger';
}

interface FormData {
  fullName: string;
  email: string;
  cnic: string;
  address: string;
}

interface FormErrors {
  fullName?: string;
  email?: string;
  cnic?: string;
  address?: string;
}

const { width: screenWidth } = Dimensions.get('window');
const isSmallScreen = screenWidth < 375;

export default function BasicInfoScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const dispatch = useDispatch();
  
  const { role } = route.params as BasicInfoParams;
  const { phoneNumber, uid } = useSelector((state: RootState) => state.auth);
  
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    email: '',
    cnic: '',
    address: '',
  });
  
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Enhanced validation functions
  const validateFullName = (name: string): string | undefined => {
    if (!name.trim()) {
      return 'Full name is required';
    }
    if (name.trim().length < 2) {
      return 'Full name must be at least 2 characters';
    }
    if (name.trim().length > 50) {
      return 'Full name must be less than 50 characters';
    }
    if (!/^[a-zA-Z\s]+$/.test(name.trim())) {
      return 'Full name can only contain letters and spaces';
    }
    return undefined;
  };

  const validateEmail = (email: string): string | undefined => {
    if (!email.trim()) {
      return 'Email is required';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return 'Please enter a valid email address';
    }
    return undefined;
  };

  const validateCNIC = (cnic: string): string | undefined => {
    if (!cnic.trim()) {
      return 'CNIC is required';
    }
    const cnicRegex = /^\d{5}-\d{7}-\d$/;
    if (!cnicRegex.test(cnic.trim())) {
      return 'Please enter CNIC in format: 00000-0000000-0';
    }
    return undefined;
  };

  const validateAddress = (address: string): string | undefined => {
    if (!address.trim()) {
      return 'Address is required';
    }
    if (address.trim().length < 10) {
      return 'Address must be at least 10 characters';
    }
    if (address.trim().length > 200) {
      return 'Address must be less than 200 characters';
    }
    return undefined;
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    newErrors.fullName = validateFullName(formData.fullName);
    newErrors.email = validateEmail(formData.email);
    newErrors.cnic = validateCNIC(formData.cnic);
    newErrors.address = validateAddress(formData.address);

    // Remove undefined errors
    const filteredErrors = Object.fromEntries(
      Object.entries(newErrors).filter(([_, value]) => value !== undefined)
    ) as FormErrors;

    setErrors(filteredErrors);
    return Object.keys(filteredErrors).length === 0;
  };

  const formatCNIC = (value: string): string => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // Format as 00000-0000000-0
    if (digits.length <= 5) {
      return digits;
    } else if (digits.length <= 12) {
      return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    } else {
      return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12, 13)}`;
    }
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    let processedValue = value;
    
    // Special handling for CNIC formatting
    if (field === 'cnic') {
      processedValue = formatCNIC(value);
    }
    
    setFormData(prev => ({ ...prev, [field]: processedValue }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async () => {
    try {
      if (!validateForm()) {
        return;
      }

      if (!phoneNumber) {
        Alert.alert('Error', 'Phone number not found. Please try signing in again.');
        return;
      }

      if (!uid) {
        Alert.alert('Error', 'User ID not found. Please try signing in again.');
        console.error('BasicInfoScreen - UID is undefined in auth state');
        return;
      }

      setIsSubmitting(true);
      
      console.log('BasicInfoScreen - Calling saveUserBasicInfo with uid:', uid);
      
      // Save user basic information
      const savedUserProfile = await saveUserBasicInfo({
        ...formData,
        role,
        phoneNumber,
      }, uid);

      console.log('BasicInfoScreen - User profile saved successfully:', savedUserProfile);

      // Update auth state with the userProfile
      dispatch(setUserProfile(savedUserProfile));

      // Show success toast
      showToast(
        'success',
        'Your information has been saved successfully.'
      );

      // Dispatch setProfileCompleted immediately after showing toast
      console.log('BasicInfoScreen - Dispatching setProfileCompleted immediately...');
      dispatch(setProfileCompleted());
      console.log('BasicInfoScreen - setProfileCompleted dispatched');
    } catch (error: any) {
      console.error('BasicInfoScreen - Error saving user info:', error);
      Alert.alert('Error', error.message || 'Failed to save information. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    try {
      navigation.goBack();
    } catch (err) {
      console.error('Navigation error:', err);
      Alert.alert('Error', 'Unable to go back. Please try again.');
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
                source={require('../../assets/images/Logo.png')} 
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.title}>Complete Your Profile</Text>
            <Text style={styles.subtitle}>
              Please provide your basic information to continue as {role}
            </Text>
          </View>
        </View>

        {/* Scrollable Content */}
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.container}>
            {/* Form Card */}
            <View style={styles.formCard}>
              <View style={styles.roleIndicator}>
                <Icon 
                  name={role === 'driver' ? 'local-taxi' : 'person'} 
                  size={24} 
                  color={BrandColors.primary} 
                />
                <Text style={styles.roleText}>
                  {role === 'driver' ? 'Driver Account' : 'Passenger Account'}
                </Text>
              </View>

              <View style={styles.formContainer}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Full Name *</Text>
                  <ThemedTextInput
                    placeholder="Enter your full name"
                    value={formData.fullName}
                    onChangeText={(value) => handleInputChange('fullName', value)}
                    autoCapitalize="words"
                    style={styles.input}
                  />
                  {errors.fullName && (
                    <View style={styles.errorContainer}>
                      <Icon name="error" size={16} color="#ef4444" />
                      <Text style={styles.errorText}>{errors.fullName}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email Address *</Text>
                  <ThemedTextInput
                    placeholder="Enter your email address"
                    value={formData.email}
                    onChangeText={(value) => handleInputChange('email', value)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={styles.input}
                  />
                  {errors.email && (
                    <View style={styles.errorContainer}>
                      <Icon name="error" size={16} color="#ef4444" />
                      <Text style={styles.errorText}>{errors.email}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>CNIC Number *</Text>
                  <ThemedTextInput
                    placeholder="00000-0000000-0"
                    value={formData.cnic}
                    onChangeText={(value) => handleInputChange('cnic', value)}
                    keyboardType="numeric"
                    maxLength={15}
                    style={styles.input}
                  />
                  {errors.cnic && (
                    <View style={styles.errorContainer}>
                      <Icon name="error" size={16} color="#ef4444" />
                      <Text style={styles.errorText}>{errors.cnic}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Full Address *</Text>
                  <ThemedTextInput
                    placeholder="Enter your complete address"
                    value={formData.address}
                    onChangeText={(value) => handleInputChange('address', value)}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    style={[styles.input, styles.textArea]}
                  />
                  {errors.address && (
                    <View style={styles.errorContainer}>
                      <Icon name="error" size={16} color="#ef4444" />
                      <Text style={styles.errorText}>{errors.address}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              <BrandButton
                title={isSubmitting ? 'Saving...' : 'Save & Continue'}
                onPress={handleSubmit}
                variant="primary"
                disabled={isSubmitting}
                style={styles.submitButton}
                textStyle={styles.buttonText}
              />

              <BrandButton
                title="Go Back"
                onPress={handleBack}
                variant="secondary"
                style={styles.backButton}
                disabled={isSubmitting}
                textStyle={styles.buttonText}
              />
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
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    position: 'relative',
    overflow: 'hidden',
    zIndex: 10,
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
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
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
    width: 60,
    height: 60,
  },
  title: {
    color: '#ffffff',
    fontSize: isSmallScreen ? 28 : 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: isSmallScreen ? 14 : 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  scrollView: {
    flex: 1,
    marginTop: -20,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  container: {
    flex: 1,
    paddingHorizontal: isSmallScreen ? 16 : 20,
    paddingTop: 20,
    maxWidth: 500,
    alignSelf: 'center',
    width: '100%',
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
  roleIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  roleText: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '600',
    color: BrandColors.primary,
    marginLeft: 8,
  },
  formContainer: {
    gap: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    marginBottom: 4,
  },
  textArea: {
    minHeight: 80,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    padding: 8,
    borderRadius: 6,
    marginTop: 4,
    gap: 6,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    flex: 1,
    textAlign: 'left',
  },
  buttonContainer: {
    gap: 16,
  },
  submitButton: {
    width: '100%',
    minHeight: isSmallScreen ? 48 : 50,
  },
  backButton: {
    width: '100%',
    minHeight: isSmallScreen ? 48 : 50,
  },
  buttonText: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
});
