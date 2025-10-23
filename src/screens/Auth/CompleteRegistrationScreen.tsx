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
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useApiAuth } from '../../hooks/useApiAuth';
import { BrandColors } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { launchImageLibrary, ImagePickerResponse, MediaType } from 'react-native-image-picker';
import { RegisterWithImagesRequest } from '../../services/api';
import AuthErrorHandler from '../../utils/AuthErrorHandler';
import ValidationUtils from '../../utils/ValidationUtils';

type UserType = 'passenger' | 'driver';

interface FormData {
  // Basic Info
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  user_type: UserType;
  phone: string;
  cnic: string;
  address: string;
  date_of_birth: string;
  gender: 'male' | 'female';
  emergency_contact_name: string;
  emergency_contact_relation: string;
  languages: string;
  bio: string;
  
  // Passenger specific fields
  passenger_preferred_payment?: string;
  passenger_emergency_contact?: string;
  passenger_emergency_contact_name?: string;
  passenger_emergency_contact_relation?: string;
  
  // Driver specific fields
  license_number?: string;
  license_type?: string;
  license_expiry_date?: string;
  driving_experience?: string;
  bank_account_number?: string;
  bank_name?: string;
  bank_branch?: string;
  vehicle_type?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: string;
  vehicle_color?: string;
  license_plate?: string;
  registration_number?: string;
  preferred_payment?: string;
  
  // Images
  passenger_cnic_front_image?: string;
  passenger_cnic_back_image?: string;
  passenger_profile_image?: string;
  cnic_front_image?: string;
  cnic_back_image?: string;
  license_image?: string;
  profile_image?: string;
  vehicle_front_image?: string;
  vehicle_back_image?: string;
  vehicle_left_image?: string;
  vehicle_right_image?: string;
}

const CompleteRegistrationScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { registerWithImages, isLoading } = useApiAuth();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [userType, setUserType] = useState<UserType>('passenger');
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    password: '',
    password_confirmation: '',
    user_type: 'passenger',
    phone: '',
    cnic: '',
    address: '',
    date_of_birth: '',
    gender: 'male',
    emergency_contact_name: '',
    emergency_contact_relation: '',
    languages: '',
    bio: '',
    passenger_preferred_payment: '',
    passenger_emergency_contact: '',
    passenger_emergency_contact_name: '',
    passenger_emergency_contact_relation: '',
    license_number: '',
    license_type: '',
    license_expiry_date: '',
    driving_experience: '',
    bank_account_number: '',
    bank_name: '',
    bank_branch: '',
    vehicle_type: '',
    vehicle_make: '',
    vehicle_model: '',
    vehicle_year: '',
    vehicle_color: '',
    license_plate: '',
    registration_number: '',
    preferred_payment: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalSteps = userType === 'passenger' ? 4 : 5;

  const validateStep = (step: number): boolean => {
    const rules = ValidationUtils.getRegistrationRules(userType);
    const validationResult = ValidationUtils.validateForm(formData, rules);
    
    // Filter errors for current step
    const stepErrors: Record<string, string> = {};
    
    switch (step) {
      case 1: // Basic Info
        const basicFields = ['name', 'email', 'password', 'password_confirmation', 'phone', 'cnic', 'address', 'date_of_birth', 'emergency_contact_name', 'emergency_contact_relation', 'languages', 'bio'];
        basicFields.forEach(field => {
          if (validationResult.errors[field]) {
            stepErrors[field] = validationResult.errors[field];
          }
        });
        break;
        
      case 2: // User Type Specific
        if (userType === 'passenger') {
          const passengerFields = ['passenger_preferred_payment', 'passenger_emergency_contact'];
          passengerFields.forEach(field => {
            if (validationResult.errors[field]) {
              stepErrors[field] = validationResult.errors[field];
            }
          });
        } else {
          const driverFields = ['license_number', 'license_type', 'license_expiry_date', 'driving_experience', 'bank_account_number', 'bank_name', 'bank_branch'];
          driverFields.forEach(field => {
            if (validationResult.errors[field]) {
              stepErrors[field] = validationResult.errors[field];
            }
          });
        }
        break;
        
      case 3: // Vehicle Info (Drivers only)
        if (userType === 'driver') {
          const vehicleFields = ['vehicle_type', 'vehicle_make', 'vehicle_model', 'vehicle_year', 'vehicle_color', 'license_plate', 'registration_number', 'preferred_payment'];
          vehicleFields.forEach(field => {
            if (validationResult.errors[field]) {
              stepErrors[field] = validationResult.errors[field];
            }
          });
        }
        break;
        
      case 4: // Documents
        if (userType === 'passenger') {
          const passengerImageFields = ['passenger_cnic_front_image', 'passenger_cnic_back_image', 'passenger_profile_image'];
          passengerImageFields.forEach(field => {
            if (!formData[field as keyof FormData]) {
              stepErrors[field] = `${field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} is required`;
            }
          });
        } else {
          const driverImageFields = ['cnic_front_image', 'cnic_back_image', 'license_image', 'profile_image', 'vehicle_front_image', 'vehicle_back_image', 'vehicle_left_image', 'vehicle_right_image'];
          driverImageFields.forEach(field => {
            if (!formData[field as keyof FormData]) {
              stepErrors[field] = `${field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} is required`;
            }
          });
        }
        break;
    }
    
    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < totalSteps) {
        setCurrentStep(currentStep + 1);
      } else {
        handleSubmit();
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleImagePicker = useCallback((field: keyof FormData) => {
    const options = {
      mediaType: 'photo' as MediaType,
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
    };

    launchImageLibrary(options, (response: ImagePickerResponse) => {
      if (response.didCancel || response.errorMessage) {
        return;
      }

      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        setFormData(prev => ({
          ...prev,
          [field]: asset.uri || '',
        }));
      }
    });
  }, []);

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    setIsSubmitting(true);
    try {
      const registrationData: RegisterWithImagesRequest = {
        ...formData,
        user_type: userType,
      };

      console.log('🚀 Submitting registration:', registrationData);
      
      const result = await registerWithImages(registrationData);
      
      if (result.type === 'auth/registerUserWithImages/fulfilled') {
        AuthErrorHandler.showSuccessMessage(
          'Registration Successful!',
          'Your account has been created successfully. You can now login.',
          () => navigation.navigate('CompleteLogin')
        );
      } else {
        AuthErrorHandler.showErrorMessage('Registration Failed', 'Please try again.');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      AuthErrorHandler.handleRegistrationError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateFormData = (field: keyof FormData, value: string) => {
    if (field === 'phone' || field === 'passenger_emergency_contact') {
      // Auto-format phone numbers as user types
      const formattedPhone = formatPhoneNumber(value);
      setFormData(prev => ({ ...prev, [field]: formattedPhone }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
    
    // Clear error when user starts typing
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

  const renderImagePicker = (field: keyof FormData, label: string, required: boolean = false) => {
    const imageUri = formData[field] as string;
    
    return (
      <View style={styles.imagePickerContainer}>
        <Text style={styles.imagePickerLabel}>
          {label} {required && <Text style={styles.required}>*</Text>}
        </Text>
        <TouchableOpacity
          style={styles.imagePickerButton}
          onPress={() => handleImagePicker(field)}
        >
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.selectedImage} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Icon name="add-a-photo" size={40} color="#666" />
              <Text style={styles.imagePlaceholderText}>Tap to add image</Text>
            </View>
          )}
        </TouchableOpacity>
        {errors[field] && <Text style={styles.errorText}>{errors[field]}</Text>}
      </View>
    );
  };

  const renderInput = (
    field: keyof FormData,
    label: string,
    placeholder: string,
    required: boolean = false,
    keyboardType: 'default' | 'email-address' | 'numeric' | 'phone-pad' = 'default',
    secureTextEntry: boolean = false
  ) => (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>
        {label} {required && <Text style={styles.required}>*</Text>}
      </Text>
      <TextInput
        style={[styles.input, errors[field] && styles.inputError]}
        placeholder={placeholder}
        value={formData[field] as string}
        onChangeText={(value) => updateFormData(field, value)}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
      />
      {errors[field] && <Text style={styles.errorText}>{errors[field]}</Text>}
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Basic Information</Text>
      
      <View style={styles.userTypeContainer}>
        <Text style={styles.sectionTitle}>I want to register as:</Text>
        <View style={styles.userTypeButtons}>
          <TouchableOpacity
            style={[
              styles.userTypeButton,
              userType === 'passenger' && styles.userTypeButtonActive
            ]}
            onPress={() => {
              setUserType('passenger');
              setFormData(prev => ({ ...prev, user_type: 'passenger' }));
            }}
          >
            <Icon name="person" size={24} color={userType === 'passenger' ? 'white' : BrandColors.primary} />
            <Text style={[
              styles.userTypeButtonText,
              userType === 'passenger' && styles.userTypeButtonTextActive
            ]}>
              Passenger
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.userTypeButton,
              userType === 'driver' && styles.userTypeButtonActive
            ]}
            onPress={() => {
              setUserType('driver');
              setFormData(prev => ({ ...prev, user_type: 'driver' }));
            }}
          >
            <Icon name="drive-eta" size={24} color={userType === 'driver' ? 'white' : BrandColors.primary} />
            <Text style={[
              styles.userTypeButtonText,
              userType === 'driver' && styles.userTypeButtonTextActive
            ]}>
              Driver
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {renderInput('name', 'Full Name', 'Enter your full name', true)}
      {renderInput('email', 'Email', 'Enter your email', true, 'email-address')}
      {renderInput('password', 'Password', 'Enter your password', true, 'default', true)}
      {renderInput('password_confirmation', 'Confirm Password', 'Confirm your password', true, 'default', true)}
      {renderInput('phone', 'Phone Number', '+92-300-1234567', true, 'phone-pad')}
      {renderInput('cnic', 'CNIC', 'Enter your CNIC number', true, 'numeric')}
      {renderInput('address', 'Address', 'Enter your address', true)}
      {renderInput('date_of_birth', 'Date of Birth', 'YYYY-MM-DD', true)}
      
      <View style={styles.genderContainer}>
        <Text style={styles.inputLabel}>Gender <Text style={styles.required}>*</Text></Text>
        <View style={styles.genderButtons}>
          <TouchableOpacity
            style={[
              styles.genderButton,
              formData.gender === 'male' && styles.genderButtonActive
            ]}
            onPress={() => updateFormData('gender', 'male')}
          >
            <Text style={[
              styles.genderButtonText,
              formData.gender === 'male' && styles.genderButtonTextActive
            ]}>
              Male
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.genderButton,
              formData.gender === 'female' && styles.genderButtonActive
            ]}
            onPress={() => updateFormData('gender', 'female')}
          >
            <Text style={[
              styles.genderButtonText,
              formData.gender === 'female' && styles.genderButtonTextActive
            ]}>
              Female
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {renderInput('emergency_contact_name', 'Emergency Contact Name', 'Enter emergency contact name', true)}
      
      <View style={styles.relationContainer}>
        <Text style={styles.inputLabel}>Emergency Contact Relation <Text style={styles.required}>*</Text></Text>
        <View style={styles.relationButtons}>
          {['father', 'mother', 'brother', 'sister', 'spouse', 'friend', 'other'].map((relation) => (
            <TouchableOpacity
              key={relation}
              style={[
                styles.relationButton,
                formData.emergency_contact_relation === relation && styles.relationButtonActive
              ]}
              onPress={() => updateFormData('emergency_contact_relation', relation)}
            >
              <Text style={[
                styles.relationButtonText,
                formData.emergency_contact_relation === relation && styles.relationButtonTextActive
              ]}>
                {relation.charAt(0).toUpperCase() + relation.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {renderInput('languages', 'Languages', 'e.g., urdu,english', true)}
      {renderInput('bio', 'Bio', 'Tell us about yourself', true)}
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>
        {userType === 'passenger' ? 'Passenger Information' : 'Driver Information'}
      </Text>
      
      {userType === 'passenger' ? (
        <>
          <View style={styles.paymentContainer}>
            <Text style={styles.inputLabel}>Preferred Payment Method <Text style={styles.required}>*</Text></Text>
            <View style={styles.paymentButtons}>
              {['mobile_wallet', 'card', 'cash'].map((method) => (
                <TouchableOpacity
                  key={method}
                  style={[
                    styles.paymentButton,
                    formData.passenger_preferred_payment === method && styles.paymentButtonActive
                  ]}
                  onPress={() => updateFormData('passenger_preferred_payment', method)}
                >
                  <Text style={[
                    styles.paymentButtonText,
                    formData.passenger_preferred_payment === method && styles.paymentButtonTextActive
                  ]}>
                    {method.replace('_', ' ').toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          {renderInput('passenger_emergency_contact', 'Emergency Contact Number', '+92-300-1234567', true, 'phone-pad')}
          {renderInput('passenger_emergency_contact_name', 'Emergency Contact Name', 'Enter emergency contact name')}
          
          <View style={styles.relationContainer}>
            <Text style={styles.inputLabel}>Emergency Contact Relation</Text>
            <View style={styles.relationButtons}>
              {['father', 'mother', 'brother', 'sister', 'spouse', 'friend', 'other'].map((relation) => (
                <TouchableOpacity
                  key={relation}
                  style={[
                    styles.relationButton,
                    formData.passenger_emergency_contact_relation === relation && styles.relationButtonActive
                  ]}
                  onPress={() => updateFormData('passenger_emergency_contact_relation', relation)}
                >
                  <Text style={[
                    styles.relationButtonText,
                    formData.passenger_emergency_contact_relation === relation && styles.relationButtonTextActive
                  ]}>
                    {relation.charAt(0).toUpperCase() + relation.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </>
      ) : (
        <>
          {renderInput('license_number', 'License Number', 'Enter your license number', true)}
          {renderInput('license_type', 'License Type', 'e.g., LTV, MC', true)}
          {renderInput('license_expiry_date', 'License Expiry Date', 'YYYY-MM-DD', true)}
          {renderInput('driving_experience', 'Driving Experience', 'e.g., 5 years', true)}
          {renderInput('bank_account_number', 'Bank Account Number', 'Enter your bank account number', true, 'numeric')}
          {renderInput('bank_name', 'Bank Name', 'Enter your bank name', true)}
          {renderInput('bank_branch', 'Bank Branch', 'Enter your bank branch', true)}
        </>
      )}
    </View>
  );

  const renderStep3 = () => (
    userType === 'driver' ? (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>Vehicle Information</Text>
        
        <View style={styles.vehicleTypeContainer}>
          <Text style={styles.inputLabel}>Vehicle Type <Text style={styles.required}>*</Text></Text>
          <View style={styles.vehicleTypeButtons}>
            {['car', 'bike'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.vehicleTypeButton,
                  formData.vehicle_type === type && styles.vehicleTypeButtonActive
                ]}
                onPress={() => updateFormData('vehicle_type', type)}
              >
                <Icon 
                  name={type === 'car' ? 'directions-car' : 'motorcycle'} 
                  size={24} 
                  color={formData.vehicle_type === type ? 'white' : BrandColors.primary} 
                />
                <Text style={[
                  styles.vehicleTypeButtonText,
                  formData.vehicle_type === type && styles.vehicleTypeButtonTextActive
                ]}>
                  {type.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {renderInput('vehicle_make', 'Vehicle Make', 'e.g., Toyota, Honda', true)}
        {renderInput('vehicle_model', 'Vehicle Model', 'e.g., Corolla, CD-70', true)}
        {renderInput('vehicle_year', 'Vehicle Year', 'e.g., 2020', true)}
        {renderInput('vehicle_color', 'Vehicle Color', 'e.g., White, Red', true)}
        {renderInput('license_plate', 'License Plate', 'e.g., KHI-2020-1234', true)}
        {renderInput('registration_number', 'Registration Number', 'e.g., REG-2020-5678', true)}
        
        <View style={styles.paymentContainer}>
          <Text style={styles.inputLabel}>Preferred Payment Method <Text style={styles.required}>*</Text></Text>
          <View style={styles.paymentButtons}>
            {['mobile_wallet', 'cash'].map((method) => (
              <TouchableOpacity
                key={method}
                style={[
                  styles.paymentButton,
                  formData.preferred_payment === method && styles.paymentButtonActive
                ]}
                onPress={() => updateFormData('preferred_payment', method)}
              >
                <Text style={[
                  styles.paymentButtonText,
                  formData.preferred_payment === method && styles.paymentButtonTextActive
                ]}>
                  {method.replace('_', ' ').toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    ) : null
  );

  const renderStep4 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Document Upload</Text>
      
      {userType === 'passenger' ? (
        <>
          {renderImagePicker('passenger_cnic_front_image', 'CNIC Front Image', true)}
          {renderImagePicker('passenger_cnic_back_image', 'CNIC Back Image', true)}
          {renderImagePicker('passenger_profile_image', 'Profile Image', true)}
        </>
      ) : (
        <>
          {renderImagePicker('cnic_front_image', 'CNIC Front Image', true)}
          {renderImagePicker('cnic_back_image', 'CNIC Back Image', true)}
          {renderImagePicker('license_image', 'License Image', true)}
          {renderImagePicker('profile_image', 'Profile Image', true)}
          {renderImagePicker('vehicle_front_image', 'Vehicle Front Image', true)}
          {renderImagePicker('vehicle_back_image', 'Vehicle Back Image', true)}
          {renderImagePicker('vehicle_left_image', 'Vehicle Left Image', true)}
          {renderImagePicker('vehicle_right_image', 'Vehicle Right Image', true)}
        </>
      )}
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Registration</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${(currentStep / totalSteps) * 100}%` }
            ]} 
          />
        </View>
        <Text style={styles.progressText}>
          Step {currentStep} of {totalSteps}
        </Text>
      </View>

      <KeyboardAvoidingView 
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          {renderCurrentStep()}
        </ScrollView>

        <View style={styles.buttonContainer}>
          {currentStep > 1 && (
            <TouchableOpacity
              style={styles.previousButton}
              onPress={handlePrevious}
            >
              <Text style={styles.previousButtonText}>Previous</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[
              styles.nextButton,
              (isSubmitting || isLoading) && styles.nextButtonDisabled
            ]}
            onPress={handleNext}
            disabled={isSubmitting || isLoading}
          >
            {isSubmitting || isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.nextButtonText}>
                {currentStep === totalSteps ? 'Register' : 'Next'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
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
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: BrandColors.primary,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  stepContainer: {
    padding: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 15,
  },
  userTypeContainer: {
    marginBottom: 20,
  },
  userTypeButtons: {
    flexDirection: 'row',
    gap: 15,
  },
  userTypeButton: {
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
  userTypeButtonActive: {
    backgroundColor: BrandColors.primary,
  },
  userTypeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: BrandColors.primary,
    marginLeft: 8,
  },
  userTypeButtonTextActive: {
    color: 'white',
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
  genderContainer: {
    marginBottom: 20,
  },
  genderButtons: {
    flexDirection: 'row',
    gap: 15,
  },
  genderButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: 'white',
  },
  genderButtonActive: {
    backgroundColor: BrandColors.primary,
    borderColor: BrandColors.primary,
  },
  genderButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  genderButtonTextActive: {
    color: 'white',
  },
  relationContainer: {
    marginBottom: 20,
  },
  relationButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  relationButton: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: 'white',
  },
  relationButtonActive: {
    backgroundColor: BrandColors.primary,
    borderColor: BrandColors.primary,
  },
  relationButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  relationButtonTextActive: {
    color: 'white',
  },
  paymentContainer: {
    marginBottom: 20,
  },
  paymentButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  paymentButton: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: 'white',
  },
  paymentButtonActive: {
    backgroundColor: BrandColors.primary,
    borderColor: BrandColors.primary,
  },
  paymentButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  paymentButtonTextActive: {
    color: 'white',
  },
  vehicleTypeContainer: {
    marginBottom: 20,
  },
  vehicleTypeButtons: {
    flexDirection: 'row',
    gap: 15,
  },
  vehicleTypeButton: {
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
  vehicleTypeButtonActive: {
    backgroundColor: BrandColors.primary,
  },
  vehicleTypeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: BrandColors.primary,
    marginLeft: 8,
  },
  vehicleTypeButtonTextActive: {
    color: 'white',
  },
  imagePickerContainer: {
    marginBottom: 20,
  },
  imagePickerLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  imagePickerButton: {
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    borderRadius: 8,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholder: {
    alignItems: 'center',
  },
  imagePlaceholderText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
  },
  selectedImage: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 15,
  },
  previousButton: {
    flex: 1,
    paddingVertical: 15,
    borderWidth: 2,
    borderColor: BrandColors.primary,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: 'white',
  },
  previousButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: BrandColors.primary,
  },
  nextButton: {
    flex: 2,
    paddingVertical: 15,
    backgroundColor: BrandColors.primary,
    borderRadius: 8,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

export default CompleteRegistrationScreen;
