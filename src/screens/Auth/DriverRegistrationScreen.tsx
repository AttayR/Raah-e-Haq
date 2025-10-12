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
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { driverRegistrationThunk } from '../../store/thunks/authThunks';
import { showToast } from '../../components/ToastProvider';
import { BrandColors } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { launchImageLibrary, ImagePickerResponse, MediaType } from 'react-native-image-picker';

type RegistrationStep = 'personal' | 'vehicle' | 'documents' | 'review';

interface DriverRegistrationData {
  fullName: string;
  cnic: string;
  address: string;
  vehicleType: 'car' | 'bike' | 'van' | 'truck';
  vehicleNumber: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: string;
  vehicleColor: string;
  driverPictureUri?: string;
  cnicPictureUri?: string;
  vehiclePictureUris: string[];
}

export default function DriverRegistrationScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const dispatch = useDispatch<any>();
  
  const { phoneNumber } = route.params || {};
  const { isLoading } = useSelector((state: RootState) => state.auth);
  
  const [currentStep, setCurrentStep] = useState<RegistrationStep>('personal');
  const [formData, setFormData] = useState<DriverRegistrationData>({
    fullName: '',
    cnic: '',
    address: '',
    vehicleType: 'car',
    vehicleNumber: '',
    vehicleBrand: '',
    vehicleModel: '',
    vehicleYear: '',
    vehicleColor: '',
    vehiclePictureUris: [],
  });

  const steps = [
    { key: 'personal', title: 'Personal Info', icon: 'person' },
    { key: 'vehicle', title: 'Vehicle Info', icon: 'local-taxi' },
    { key: 'documents', title: 'Documents', icon: 'description' },
    { key: 'review', title: 'Review', icon: 'check-circle' },
  ];

  const updateFormData = (patch: Partial<DriverRegistrationData>) => {
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
        return !!(formData.fullName && formData.cnic && formData.address);
      case 'vehicle':
        return !!(formData.vehicleNumber && formData.vehicleBrand && formData.vehicleModel);
      case 'documents':
        return !!(formData.driverPictureUri && formData.cnicPictureUri && formData.vehiclePictureUris.length > 0);
      case 'review':
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (!canProceedToNext()) {
      showToast('error', 'Please fill in all required fields');
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

  const handleImagePicker = (type: 'driver' | 'cnic' | 'vehicle') => {
    const options = {
      mediaType: 'photo' as MediaType,
      quality: 0.8,
      maxWidth: 1024,
      maxHeight: 1024,
    };

    launchImageLibrary(options, (response: ImagePickerResponse) => {
      if (response.didCancel || response.errorMessage) {
        return;
      }

      if (response.assets && response.assets[0]) {
        const uri = response.assets[0].uri;
        if (uri) {
          if (type === 'driver') {
            updateFormData({ driverPictureUri: uri });
          } else if (type === 'cnic') {
            updateFormData({ cnicPictureUri: uri });
          } else if (type === 'vehicle') {
            updateFormData({ 
              vehiclePictureUris: [...formData.vehiclePictureUris, uri] 
            });
          }
        }
      }
    });
  };

  const handleSubmit = async () => {
    try {
      const profileData = {
        fullName: formData.fullName,
        cnic: formData.cnic,
        address: formData.address,
        vehicleType: formData.vehicleType,
        vehicleInfo: {
          number: formData.vehicleNumber,
          brand: formData.vehicleBrand,
          model: formData.vehicleModel,
          year: formData.vehicleYear,
          color: formData.vehicleColor,
        },
        driverPictureUri: formData.driverPictureUri,
        cnicPictureUri: formData.cnicPictureUri,
        vehiclePictureUris: formData.vehiclePictureUris,
      };

      await dispatch(driverRegistrationThunk(phoneNumber, profileData));
      
      showToast('success', 'Driver registration submitted for approval');
      // Navigation will be handled by AuthFlow based on driver status
      
    } catch (error: any) {
      console.error('Driver registration error:', error);
      showToast('error', error.message || 'Driver registration failed');
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'personal':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Personal Information</Text>
            <Text style={styles.stepDescription}>
              Please provide your personal details for verification
            </Text>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Full Name *</Text>
              <TouchableOpacity style={styles.input}>
                <Text style={styles.inputText}>
                  {formData.fullName || 'Enter your full name'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>CNIC Number *</Text>
              <TouchableOpacity style={styles.input}>
                <Text style={styles.inputText}>
                  {formData.cnic || 'Enter your CNIC number'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Address *</Text>
              <TouchableOpacity style={styles.input}>
                <Text style={styles.inputText}>
                  {formData.address || 'Enter your address'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'vehicle':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Vehicle Information</Text>
            <Text style={styles.stepDescription}>
              Please provide details about your vehicle
            </Text>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Vehicle Type *</Text>
              <View style={styles.vehicleTypeContainer}>
                {['car', 'bike', 'van', 'truck'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.vehicleTypeButton,
                      formData.vehicleType === type && styles.vehicleTypeButtonSelected
                    ]}
                    onPress={() => updateFormData({ vehicleType: type as any })}
                  >
                    <Text style={[
                      styles.vehicleTypeText,
                      formData.vehicleType === type && styles.vehicleTypeTextSelected
                    ]}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Vehicle Number *</Text>
              <TouchableOpacity style={styles.input}>
                <Text style={styles.inputText}>
                  {formData.vehicleNumber || 'Enter vehicle number'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Brand *</Text>
              <TouchableOpacity style={styles.input}>
                <Text style={styles.inputText}>
                  {formData.vehicleBrand || 'Enter vehicle brand'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Model *</Text>
              <TouchableOpacity style={styles.input}>
                <Text style={styles.inputText}>
                  {formData.vehicleModel || 'Enter vehicle model'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'documents':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Document Upload</Text>
            <Text style={styles.stepDescription}>
              Please upload required documents for verification
            </Text>
            
            <View style={styles.documentSection}>
              <Text style={styles.documentTitle}>Driver Photo *</Text>
              <TouchableOpacity
                style={styles.documentButton}
                onPress={() => handleImagePicker('driver')}
              >
                <Icon name="camera-alt" size={24} color={BrandColors.primary} />
                <Text style={styles.documentButtonText}>
                  {formData.driverPictureUri ? 'Photo Selected' : 'Take Driver Photo'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.documentSection}>
              <Text style={styles.documentTitle}>CNIC Photo *</Text>
              <TouchableOpacity
                style={styles.documentButton}
                onPress={() => handleImagePicker('cnic')}
              >
                <Icon name="camera-alt" size={24} color={BrandColors.primary} />
                <Text style={styles.documentButtonText}>
                  {formData.cnicPictureUri ? 'CNIC Photo Selected' : 'Take CNIC Photo'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.documentSection}>
              <Text style={styles.documentTitle}>Vehicle Photos * (At least 2)</Text>
              <TouchableOpacity
                style={styles.documentButton}
                onPress={() => handleImagePicker('vehicle')}
              >
                <Icon name="camera-alt" size={24} color={BrandColors.primary} />
                <Text style={styles.documentButtonText}>
                  Add Vehicle Photo ({formData.vehiclePictureUris.length})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'review':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Review Information</Text>
            <Text style={styles.stepDescription}>
              Please review your information before submitting
            </Text>
            
            <View style={styles.reviewSection}>
              <Text style={styles.reviewTitle}>Personal Info</Text>
              <Text style={styles.reviewText}>Name: {formData.fullName}</Text>
              <Text style={styles.reviewText}>CNIC: {formData.cnic}</Text>
              <Text style={styles.reviewText}>Address: {formData.address}</Text>
            </View>

            <View style={styles.reviewSection}>
              <Text style={styles.reviewTitle}>Vehicle Info</Text>
              <Text style={styles.reviewText}>Type: {formData.vehicleType}</Text>
              <Text style={styles.reviewText}>Number: {formData.vehicleNumber}</Text>
              <Text style={styles.reviewText}>Brand: {formData.vehicleBrand}</Text>
              <Text style={styles.reviewText}>Model: {formData.vehicleModel}</Text>
            </View>

            <View style={styles.reviewSection}>
              <Text style={styles.reviewTitle}>Documents</Text>
              <Text style={styles.reviewText}>
                Driver Photo: {formData.driverPictureUri ? '✓' : '✗'}
              </Text>
              <Text style={styles.reviewText}>
                CNIC Photo: {formData.cnicPictureUri ? '✓' : '✗'}
              </Text>
              <Text style={styles.reviewText}>
                Vehicle Photos: {formData.vehiclePictureUris.length}
              </Text>
            </View>
          </View>
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
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image 
              source={require('../../assets/images/Logo.png')} 
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>Driver Registration</Text>
          <Text style={styles.subtitle}>
            Complete your driver profile
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

        {/* Step Content */}
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {renderStepContent()}
        </ScrollView>

        {/* Navigation Buttons */}
        <View style={styles.buttonContainer}>
          <View style={styles.buttonRow}>
            {getCurrentStepIndex() > 0 && (
              <TouchableOpacity
                style={styles.previousButton}
                onPress={handlePrevious}
                activeOpacity={0.8}
              >
                <Icon name="arrow-back" size={20} color={BrandColors.primary} />
                <Text style={styles.previousButtonText}>Previous</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.nextButton,
                !canProceedToNext() && styles.nextButtonDisabled
              ]}
              onPress={getCurrentStepIndex() === steps.length - 1 ? handleSubmit : handleNext}
              disabled={!canProceedToNext() || isLoading}
              activeOpacity={0.8}
            >
              <Text style={styles.nextButtonText}>
                {isLoading ? 'Processing...' : 
                 getCurrentStepIndex() === steps.length - 1 ? 'Submit' : 'Next'}
              </Text>
              {getCurrentStepIndex() < steps.length - 1 && (
                <Icon name="arrow-forward" size={20} color="#ffffff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
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
  header: {
    backgroundColor: BrandColors.primary,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
  },
  logoContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoImage: {
    width: 40,
    height: 40,
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    textAlign: 'center',
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 2,
  },
  progressText: {
    color: '#ffffff',
    fontSize: 14,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  stepContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 24,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f9fafb',
  },
  inputText: {
    fontSize: 16,
    color: '#1f2937',
  },
  vehicleTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  vehicleTypeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
  },
  vehicleTypeButtonSelected: {
    backgroundColor: BrandColors.primary,
    borderColor: BrandColors.primary,
  },
  vehicleTypeText: {
    fontSize: 14,
    color: '#6b7280',
  },
  vehicleTypeTextSelected: {
    color: '#ffffff',
  },
  documentSection: {
    marginBottom: 24,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  documentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: BrandColors.primary,
    borderStyle: 'dashed',
    gap: 8,
  },
  documentButtonText: {
    fontSize: 16,
    color: BrandColors.primary,
    fontWeight: '500',
  },
  reviewSection: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  reviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  reviewText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  previousButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    gap: 8,
  },
  previousButtonText: {
    fontSize: 16,
    color: BrandColors.primary,
    fontWeight: '600',
  },
  nextButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: BrandColors.primary,
    gap: 8,
  },
  nextButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  nextButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },
});
