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
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useApiAuth } from '../../hooks/useApiAuth';
import { BrandColors } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialIcons';
import PersonalInfoStep from './steps/PersonalInfoStep';
import VehicleInfoStep from './steps/VehicleInfoStep';
import DocumentsStep from './steps/DocumentsStep';
import ReviewStep from './steps/ReviewStep';
import { showToast } from '../../components/ToastProvider';

const { width: screenWidth } = Dimensions.get('window');
const isSmallScreen = screenWidth < 375;

type RegistrationStep = 'personal' | 'vehicle' | 'documents' | 'review';

interface RegistrationData {
  // Personal Info
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  cnic: string;
  address: string;
  phoneNumber: string;
  // Emergency Contact (per passenger/driver forms)
  emergencyContactNumber: string;
  emergencyContactName: string;
  emergencyRelationship: string; // e.g., Father, Mother, Spouse, Friend
  
  // Vehicle Info (for drivers)
  vehicleType: string;
  vehicleNumber: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: string;
  vehicleColor: string;
  
  // Documents
  driverPicture: string;
  cnicPicture: string;
  licenseFrontPicture: string; // For drivers
  licenseBackPicture: string;  // For drivers
  cnicFrontPicture: string; // For passengers
  cnicBackPicture: string;  // For passengers
  profilePicture: string;    // For passengers (and optional for drivers)
  vehiclePictures: string[];
  
  // Role
  role: 'driver' | 'passenger';
  // Preferences
  preferredPayment: 'cash' | 'card' | 'wallet' | '';
}

export default function RegistrationScreen() {
  const navigation = useNavigation<any>();
  const { registerWithImages, isLoading } = useApiAuth();
  
  // NOTE: This is the legacy registration screen. 
  // For a complete registration experience with all required fields,
  // consider using CompleteRegistrationScreen.tsx instead.
  
  const [currentStep, setCurrentStep] = useState<RegistrationStep>('personal');
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<RegistrationData>({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    cnic: '',
    address: '',
    phoneNumber: '',
    emergencyContactNumber: '',
    emergencyContactName: '',
    emergencyRelationship: '',
    vehicleType: '',
    vehicleNumber: '',
    vehicleBrand: '',
    vehicleModel: '',
    vehicleYear: '',
    vehicleColor: '',
    driverPicture: '',
    cnicPicture: '',
    licenseFrontPicture: '',
    licenseBackPicture: '',
    cnicFrontPicture: '',
    cnicBackPicture: '',
    profilePicture: '',
    vehiclePictures: [],
    role: 'passenger',
    preferredPayment: '',
  });

  const steps = [
    { key: 'personal', title: 'Personal Info', icon: 'person' },
    { key: 'vehicle', title: 'Vehicle Info', icon: 'local-taxi' },
    { key: 'documents', title: 'Documents', icon: 'description' },
    { key: 'review', title: 'Review', icon: 'check-circle' },
  ];

  const updateFormData = (patch: Partial<RegistrationData>) => {
    setFormData(prev => ({ ...prev, ...patch }));
  };

  const getCurrentStepIndex = () => {
    return steps.findIndex(step => step.key === currentStep);
  };

  const getProgressPercentage = () => {
    const currentIndex = getCurrentStepIndex();
    return ((currentIndex + 1) / steps.length) * 100;
  };

  const canProceedToNext = (): boolean => {
    switch (currentStep) {
      case 'personal':
        return !!(formData.fullName && formData.email && formData.password && 
                 formData.confirmPassword && formData.cnic && formData.address);
      case 'vehicle':
        return formData.role === 'passenger' || !!(formData.vehicleType && 
                 formData.vehicleNumber && formData.vehicleBrand && 
                 formData.vehicleModel && formData.vehicleYear && formData.vehicleColor);
      case 'documents':
        if (formData.role === 'passenger') {
          // Temporarily skip CNIC image validation for testing
          // TODO: Re-enable when proper image upload is implemented
          return true; // Allow progression without images for now
          // return !!(formData.cnicFrontPicture && formData.cnicFrontPicture.trim() !== '' &&
          //          formData.cnicBackPicture && formData.cnicBackPicture.trim() !== '');
        } else {
          // Drivers need driver picture, CNIC picture, and vehicle pictures
          return !!(formData.driverPicture && 
                   formData.cnicPicture && 
                   formData.vehiclePictures.length >= 4);
        }
      case 'review':
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (!canProceedToNext()) {
      showToast('error', 'Please fill all required fields before proceeding');
      return;
    }

    const currentIndex = getCurrentStepIndex();
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1].key as RegistrationStep);
    }
  };

  const handlePrevious = () => {
    const currentIndex = getCurrentStepIndex();
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1].key as RegistrationStep);
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      console.log('🚀 Starting account creation process...');
      console.log('📝 Form data:', {
        fullName: formData.fullName,
        email: formData.email,
        role: formData.role,
        phone: formData.phoneNumber,
        cnic: formData.cnic,
        address: formData.address,
        vehicleType: formData.vehicleType,
        vehicleNumber: formData.vehicleNumber
      });

      // Test network connectivity first
      console.log('🌐 Testing network connectivity...');
      const { apiService } = await import('../../services/api');
      const isConnected = await apiService.testNetworkConnectivity();
      if (!isConnected) {
        showToast('error', 'Network connection failed. Please check your internet connection.');
        return;
      }

      // Ensure phone number is properly formatted
      const formattedPhone = formData.phoneNumber.startsWith('+') 
        ? formData.phoneNumber 
        : `+${formData.phoneNumber}`;

      // Validate password strength
      if (formData.password.length < 8) {
        showToast('error', 'Password must be at least 8 characters long');
        return;
      }

      // Temporarily skip CNIC image validation for testing
      // TODO: Re-enable when proper image upload is implemented
      // if (formData.role === 'passenger' && 
      //     (!formData.cnicFrontPicture || formData.cnicFrontPicture.trim() === '' ||
      //      !formData.cnicBackPicture || formData.cnicBackPicture.trim() === '')) {
      //   showToast('error', 'CNIC front and back images are required for passenger registration. Please complete the document upload step.');
      //   return;
      // }

      // Prepare registration data for API
      const registrationData = {
        name: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        password_confirmation: formData.confirmPassword,
        user_type: formData.role,
        phone: formattedPhone,
        cnic: formData.cnic.trim(),
        address: formData.address.trim(),
        // Add required fields with default values for now
        date_of_birth: '1990-01-01', // Default date - should be collected from user
        gender: 'male', // Default gender - should be collected from user
        emergency_contact_name: formData.emergencyContactName || 'Emergency Contact',
        emergency_contact_relation: formData.emergencyRelationship || 'friend',
        languages: 'urdu,english', // Default languages
        bio: 'User registered via mobile app', // Default bio
        // Add CNIC images for passengers
        ...(formData.role === 'passenger' && {
          passenger_cnic_front_image: formData.cnicFrontPicture,
          passenger_cnic_back_image: formData.cnicBackPicture,
          passenger_profile_image: formData.profilePicture,
          passenger_emergency_contact: formData.emergencyContactNumber || formattedPhone,
          passenger_emergency_contact_name: formData.emergencyContactName,
          passenger_emergency_contact_relation: formData.emergencyRelationship,
          passenger_preferred_payment: formData.preferredPayment || 'cash',
        }),
        ...(formData.role === 'driver' && {
          vehicle_type: formData.vehicleType || 'car',
          license_number: formData.vehicleNumber || 'LIC-2024-001', // Using vehicle number as license number for now
          license_type: 'LTV', // Default license type
          license_expiry_date: '2029-12-31', // Default expiry date
          driving_experience: '2 years', // Default experience
          bank_account_number: '1234567890123456', // Default bank account
          bank_name: 'Default Bank', // Default bank name
          bank_branch: 'Default Branch', // Default branch
          vehicle_make: 'Toyota', // Default make
          vehicle_model: 'Corolla', // Default model
          vehicle_year: '2020', // Default year
          vehicle_color: 'White', // Default color
          license_plate: 'ABC-1234', // Default plate
          registration_number: 'REG-2020-001', // Default registration
          preferred_payment: formData.preferredPayment || 'cash',
        }),
      };
      
      console.log('📤 Sending registration request to API...');
      console.log('📋 Registration payload:', registrationData);
      
      // Use the new registration method with images
      const result = await registerWithImages(registrationData);
      
      console.log('📨 API Response received:', result);
      console.log('🔍 Result type:', result.type);
      console.log('📊 Result payload:', result.payload);
      
      // Log detailed error information if registration failed
      if (result.type.endsWith('/rejected')) {
        console.log('❌ Registration failed with details:', {
          payload: result.payload,
          error: 'error' in result ? result.error : 'Unknown error',
          meta: result.meta
        });
      }
      
      if (result.type.endsWith('/fulfilled')) {
        console.log('✅ Account created successfully!');
        console.log('👤 User data:', result.payload);
        showToast('success', 'Your account has been created successfully! Please wait for admin approval.');
        // Navigate to login or phone verification
        navigation.navigate('Login');
      } else {
        console.log('❌ Registration failed');
        console.log('🚨 Error details:', result.payload);
        showToast('error', (result.payload as string) || 'Registration failed');
      }
      
    } catch (registrationError: any) {
      console.error('💥 Registration error caught:', registrationError);
      console.error('🔍 Error details:', {
        message: registrationError.message,
        stack: registrationError.stack,
        response: registrationError.response?.data
      });
      showToast('error', registrationError.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStepContent = () => {
    // Safety check for undefined formData
    if (!formData) {
      return (
        <View style={styles.container}>
          <Text style={styles.errorText}>Loading...</Text>
        </View>
      );
    }

    switch (currentStep) {
      case 'personal':
        return (
          <PersonalInfoStep
            data={formData}
            onDataChange={updateFormData}
            errors={{}}
          />
        );
      case 'vehicle':
        return (
          <VehicleInfoStep
            data={formData}
            onDataChange={updateFormData}
            errors={{}}
          />
        );
      case 'documents':
        return (
          <DocumentsStep
            data={formData}
            onDataChange={updateFormData}
            errors={{}}
          />
        );
      case 'review':
        return (
          <ReviewStep
            data={formData}
            onDataChange={updateFormData}
          />
        );
      default:
        return null;
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
        {/* Compact Header */}
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
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              Join RaaH-e-Haq as {formData.role === 'driver' ? 'Driver' : 'Passenger'}
            </Text>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${getProgressPercentage()}%` }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              Step {getCurrentStepIndex() + 1} of {steps.length}
            </Text>
          </View>

          {/* Step Indicators */}
          <View style={styles.stepIndicators}>
            {steps.map((step, index) => {
              const isActive = step.key === currentStep;
              const isCompleted = index < getCurrentStepIndex();
              return (
                <View key={step.key} style={styles.stepIndicator}>
                  <View style={[
                    styles.stepCircle,
                    isActive && styles.stepCircleActive,
                    isCompleted && styles.stepCircleCompleted
                  ]}>
                    <Icon 
                      name={isCompleted ? 'check' : step.icon} 
                      size={16} 
                      color={isCompleted || isActive ? '#ffffff' : '#9ca3af'} 
                    />
                  </View>
                  <Text style={[
                    styles.stepTitle,
                    isActive && styles.stepTitleActive
                  ]}>
                    {step.title}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Scrollable Content */}
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            {renderStepContent()}
            {/* Buttons moved inside scrollable content */}
            <View style={styles.buttonContainerScrollable}>
              {getCurrentStepIndex() > 0 && (
                <TouchableOpacity
                  style={styles.previousButton}
                  onPress={handlePrevious}
                  disabled={isLoading}
                >
                  <Icon name="arrow-back" size={20} color={BrandColors.primary} />
                  <Text style={styles.previousButtonText}>Previous</Text>
                </TouchableOpacity>
              )}
              {currentStep === 'review' ? (
                <TouchableOpacity
                  style={[styles.submitButton, !canProceedToNext() && styles.submitButtonDisabled]}
                  onPress={handleSubmit}
                  disabled={!canProceedToNext() || isLoading || submitting}
                >
                  {submitting || isLoading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator color="#ffffff" />
                      <Text style={styles.submitButtonText}>Creating Account...</Text>
                    </View>
                  ) : (
                    <Text style={styles.submitButtonText}>Create Account</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.nextButton, !canProceedToNext() && styles.nextButtonDisabled]}
                  onPress={handleNext}
                  disabled={!canProceedToNext() || isLoading || submitting}
                >
                  <Text style={styles.nextButtonText}>Next</Text>
                  <Icon name="arrow-forward" size={20} color="#ffffff" />
                </TouchableOpacity>
              )}
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
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
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
    marginBottom: 12,
  },
  logoWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.6)',
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
    width: 44,
    height: 44,
  },
  title: {
    color: '#ffffff',
    fontSize: isSmallScreen ? 20 : 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: isSmallScreen ? 12 : 14,
    textAlign: 'center',
    lineHeight: 18,
  },
  progressContainer: {
    marginTop: 8,
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 2,
  },
  progressText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  stepIndicators: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  stepIndicator: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepCircleActive: {
    backgroundColor: '#ffffff',
  },
  stepCircleCompleted: {
    backgroundColor: '#10b981',
  },
  stepTitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    textAlign: 'center',
    fontWeight: '500',
  },
  stepTitleActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    marginTop: -6,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  container: {
    flex: 1,
    paddingHorizontal: isSmallScreen ? 16 : 20,
    paddingTop: 20,
    maxWidth: 500,
    alignSelf: 'center',
    width: '100%',
  },
  buttonContainerScrollable: {
    paddingHorizontal: isSmallScreen ? 16 : 20,
    paddingVertical: 16,
    gap: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  previousButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BrandColors.primary,
    gap: 8,
  },
  previousButtonText: {
    color: BrandColors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  nextButtonContainer: {
    flex: 1,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  nextButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
