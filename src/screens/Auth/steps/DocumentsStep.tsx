import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  Dimensions,
  Image,
  Alert,
  ScrollView,
} from 'react-native';
import { launchImageLibrary, ImagePickerResponse, MediaType, PhotoQuality } from 'react-native-image-picker';
import { BrandColors } from '../../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialIcons';

const { width: screenWidth } = Dimensions.get('window');
const isSmallScreen = screenWidth < 375;

interface DocumentsData {
  driverPicture: string;
  cnicPicture: string;
  licenseFrontPicture: string;
  licenseBackPicture: string;
  cnicFrontPicture: string; // For passengers
  cnicBackPicture: string;  // For passengers
  profilePicture: string;
  vehiclePictures: string[];
  role: 'driver' | 'passenger';
}

interface DocumentsStepProps {
  data: DocumentsData;
  onDataChange: (data: Partial<DocumentsData>) => void;
  errors: Record<string, string>;
}

export default function DocumentsStep({ data, onDataChange, errors }: DocumentsStepProps) {
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);

  // Safety check for undefined data
  if (!data) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Loading...</Text>
      </View>
    );
  }

  const openImagePicker = (type: 'driver' | 'cnic' | 'cnicFront' | 'cnicBack' | 'vehicle' | 'licenseFront' | 'licenseBack' | 'profile') => {
    const options = {
      mediaType: 'photo' as MediaType,
      quality: 0.8 as PhotoQuality,
      maxWidth: 2000,
      maxHeight: 2000,
      selectionLimit: 1,
      includeBase64: false,
    };

    setIsUploading(true);
    launchImageLibrary(options, (response: ImagePickerResponse) => {
      setIsUploading(false);
      
      if (response.didCancel) {
        console.log('Image picker cancelled');
        return;
      }

      // Some providers return an errorMessage but still include a valid asset
      const asset = response.assets && response.assets[0];
      const imageUri = asset?.uri;
      if (!imageUri) {
        console.log('Image picker cancelled or error:', response.errorMessage);
        console.log('No image URI found in response:', response);
        Alert.alert('Error', 'Failed to get image. Please try again.');
        return;
      }
      
      console.log('Image picker response:', {
        imageUri,
        fileName: asset?.fileName,
        fileSize: asset?.fileSize,
        type: asset?.type
      });

      switch (type) {
        case 'driver':
          onDataChange({ driverPicture: imageUri });
          setValidationErrors(prev => ({ ...prev, driverPicture: '' }));
          break;
        case 'cnic':
          onDataChange({ cnicPicture: imageUri });
          setValidationErrors(prev => ({ ...prev, cnicPicture: '' }));
          break;
        case 'licenseFront':
          onDataChange({ licenseFrontPicture: imageUri });
          setValidationErrors(prev => ({ ...prev, licenseFrontPicture: '' }));
          break;
        case 'licenseBack':
          onDataChange({ licenseBackPicture: imageUri });
          setValidationErrors(prev => ({ ...prev, licenseBackPicture: '' }));
          break;
        case 'cnicFront':
          onDataChange({ cnicFrontPicture: imageUri });
          setValidationErrors(prev => ({ ...prev, cnicFrontPicture: '' }));
          break;
        case 'cnicBack':
          onDataChange({ cnicBackPicture: imageUri });
          setValidationErrors(prev => ({ ...prev, cnicBackPicture: '' }));
          break;
        case 'profile':
          onDataChange({ profilePicture: imageUri });
          setValidationErrors(prev => ({ ...prev, profilePicture: '' }));
          break;
        case 'vehicle':
          const currentPictures = data.vehiclePictures || [];
          if (currentPictures.length < 6) {
            const newPictures = [...currentPictures, imageUri];
            onDataChange({ vehiclePictures: newPictures });
            setValidationErrors(prev => ({ ...prev, vehiclePictures: '' }));
          } else {
            Alert.alert('Limit Reached', 'Maximum 6 vehicle pictures allowed');
          }
          break;
      }
    });
  };

  const removeVehiclePicture = (index: number) => {
    const currentPictures = data.vehiclePictures || [];
    const newPictures = currentPictures.filter((_, i) => i !== index);
    onDataChange({ vehiclePictures: newPictures });
  };

  const validateDriverPicture = (picture: string): string | undefined => {
    if (!picture || !picture.trim()) return 'Driver picture is required';
    return undefined;
  };

  const validateCnicPicture = (picture: string): string | undefined => {
    if (!picture || !picture.trim()) return 'CNIC picture is required';
    return undefined;
  };

  const validateCnicFrontPicture = (picture: string): string | undefined => {
    if (!picture || !picture.trim()) return 'CNIC front picture is required';
    return undefined;
  };

  const validateCnicBackPicture = (picture: string): string | undefined => {
    if (!picture || !picture.trim()) return 'CNIC back picture is required';
    return undefined;
  };

  const validateVehiclePictures = (pictures: string[]): string | undefined => {
    if (!pictures || pictures.length < 4) return 'At least 4 vehicle pictures are required';
    if (pictures.length > 6) return 'Maximum 6 vehicle pictures allowed';
    return undefined;
  };

  const renderImagePicker = (
    label: string,
    imageUri: string,
    onPress: () => void,
    errorMessage?: string,
    isRequired: boolean = true
  ) => (
    <View style={styles.imagePickerContainer}>
      <View style={styles.imagePickerHeader}>
        <Text style={styles.imagePickerLabel}>{label}</Text>
        {isRequired && <Text style={styles.requiredText}>*</Text>}
      </View>
      <TouchableOpacity 
        style={[styles.imagePicker, imageUri && styles.imagePickerFilled]} 
        onPress={onPress}
        disabled={isUploading}
      >
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.previewImage} />
        ) : (
          <View style={styles.imagePickerPlaceholder}>
            <Icon 
              name={isUploading ? 'hourglass-empty' : 'add-a-photo'} 
              size={32} 
              color={isUploading ? '#9ca3af' : BrandColors.primary} 
            />
            <Text style={[styles.imagePickerText, isUploading && styles.imagePickerTextDisabled]}>
              {isUploading ? 'Uploading...' : 'Tap to select image'}
            </Text>
          </View>
        )}
      </TouchableOpacity>
      {errorMessage && (
        <View style={styles.errorContainer}>
          <Icon name="error" size={16} color="#ef4444" />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}
    </View>
  );

  const renderVehiclePictureGrid = () => (
    <View style={styles.imagePickerContainer}>
      <View style={styles.imagePickerHeader}>
        <Text style={styles.imagePickerLabel}>Vehicle Pictures</Text>
        <Text style={styles.requiredText}>*</Text>
      </View>
      <Text style={styles.vehiclePicturesSubtitle}>
        Upload 4-6 clear pictures of your vehicle from different angles
      </Text>
      <View style={styles.vehiclePicturesGrid}>
        {Array.from({ length: 6 }, (_, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.vehiclePictureSlot,
              data.vehiclePictures && data.vehiclePictures[index] && styles.vehiclePictureSlotFilled
            ]}
            onPress={() => openImagePicker('vehicle')}
            disabled={isUploading}
          >
            {data.vehiclePictures && data.vehiclePictures[index] ? (
              <View style={styles.vehiclePictureContainer}>
                <Image 
                  source={{ uri: data.vehiclePictures[index] }} 
                  style={styles.vehiclePicture} 
                />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeVehiclePicture(index)}
                >
                  <Icon name="close" size={16} color="#ffffff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.vehiclePicturePlaceholder}>
                <Icon 
                  name={isUploading ? 'hourglass-empty' : 'add'} 
                  size={20} 
                  color={isUploading ? '#9ca3af' : BrandColors.primary} 
                />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.vehiclePicturesCount}>
        {(data.vehiclePictures || []).length}/6 pictures uploaded
      </Text>
      {validationErrors.vehiclePictures && (
        <View style={styles.errorContainer}>
          <Icon name="error" size={16} color="#ef4444" />
          <Text style={styles.errorText}>{validationErrors.vehiclePictures}</Text>
        </View>
      )}
    </View>
  );

  if (data.role === 'passenger') {
    return (
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>CNIC Verification</Text>
          <Text style={styles.formSubtitle}>
            Please upload a clear picture of your CNIC for verification
          </Text>

          {/* Profile Picture (optional) */}
          {renderImagePicker(
            'Profile Image (optional)',
            data.profilePicture,
            () => openImagePicker('profile'),
            validationErrors.profilePicture,
            false
          )}

          {/* CNIC Front Picture for Passengers */}
          {renderImagePicker(
            'CNIC Front Picture',
            data.cnicFrontPicture,
            () => openImagePicker('cnicFront'),
            validationErrors.cnicFrontPicture,
            true
          )}

          {/* CNIC Back Picture for Passengers */}
          {renderImagePicker(
            'CNIC Back Picture',
            data.cnicBackPicture,
            () => openImagePicker('cnicBack'),
            validationErrors.cnicBackPicture,
            true
          )}
        </View>

        {/* Guidelines Card */}
        <View style={styles.guidelinesCard}>
          <Text style={styles.guidelinesTitle}>Photo Guidelines</Text>
          <View style={styles.guidelinesList}>
            <View style={styles.guidelineItem}>
              <Icon name="check-circle" size={16} color="#10b981" />
              <Text style={styles.guidelineText}>Use good lighting and clear focus</Text>
            </View>
            <View style={styles.guidelineItem}>
              <Icon name="check-circle" size={16} color="#10b981" />
              <Text style={styles.guidelineText}>Ensure all text is readable</Text>
            </View>
            <View style={styles.guidelineItem}>
              <Icon name="check-circle" size={16} color="#10b981" />
              <Text style={styles.guidelineText}>Avoid shadows and reflections</Text>
            </View>
            <View style={styles.guidelineItem}>
              <Icon name="check-circle" size={16} color="#10b981" />
              <Text style={styles.guidelineText}>Make sure CNIC is fully visible</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Document Verification</Text>
        <Text style={styles.formSubtitle}>
          Please upload clear pictures of the required documents for verification
        </Text>

        {/* Driver Picture */}
        {renderImagePicker(
          'Driver Profile Picture',
          data.driverPicture,
          () => openImagePicker('driver'),
          validationErrors.driverPicture,
          true
        )}

        {/* CNIC Picture */}
        {renderImagePicker(
          'CNIC Picture',
          data.cnicPicture,
          () => openImagePicker('cnic'),
          validationErrors.cnicPicture,
          true
        )}

        {/* License Front/Back */}
        {renderImagePicker(
          'License Front',
          data.licenseFrontPicture,
          () => openImagePicker('licenseFront'),
          validationErrors.licenseFrontPicture,
          true
        )}
        {renderImagePicker(
          'License Back',
          data.licenseBackPicture,
          () => openImagePicker('licenseBack'),
          validationErrors.licenseBackPicture,
          true
        )}

        {/* Vehicle Pictures */}
        {renderVehiclePictureGrid()}
      </View>

      {/* Guidelines Card */}
      <View style={styles.guidelinesCard}>
        <Text style={styles.guidelinesTitle}>Photo Guidelines</Text>
        <View style={styles.guidelinesList}>
          <View style={styles.guidelineItem}>
            <Icon name="check-circle" size={16} color="#10b981" />
            <Text style={styles.guidelineText}>Use good lighting and clear focus</Text>
          </View>
          <View style={styles.guidelineItem}>
            <Icon name="check-circle" size={16} color="#10b981" />
            <Text style={styles.guidelineText}>Ensure all text is readable</Text>
          </View>
          <View style={styles.guidelineItem}>
            <Icon name="check-circle" size={16} color="#10b981" />
            <Text style={styles.guidelineText}>Avoid shadows and reflections</Text>
          </View>
          <View style={styles.guidelineItem}>
            <Icon name="check-circle" size={16} color="#10b981" />
            <Text style={styles.guidelineText}>Take pictures from different angles for vehicles</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skipCard: {
    backgroundColor: '#ffffff',
    borderRadius: isSmallScreen ? 20 : 25,
    padding: isSmallScreen ? 20 : 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  skipTitle: {
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  skipSubtitle: {
    fontSize: isSmallScreen ? 14 : 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: isSmallScreen ? 20 : 25,
    padding: isSmallScreen ? 20 : 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  formTitle: {
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: isSmallScreen ? 14 : 16,
    color: '#6b7280',
    marginBottom: 24,
    lineHeight: 22,
  },
  imagePickerContainer: {
    marginBottom: 24,
  },
  imagePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  imagePickerLabel: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '600',
    color: '#374151',
  },
  requiredText: {
    color: '#ef4444',
    marginLeft: 4,
    fontSize: 16,
  },
  imagePicker: {
    height: 120,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
  },
  imagePickerFilled: {
    borderStyle: 'solid',
    borderColor: BrandColors.primary,
    backgroundColor: '#ffffff',
  },
  imagePickerPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePickerText: {
    fontSize: isSmallScreen ? 14 : 16,
    color: BrandColors.primary,
    marginTop: 8,
    fontWeight: '500',
  },
  imagePickerTextDisabled: {
    color: '#9ca3af',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  vehiclePicturesSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 12,
  },
  vehiclePicturesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  vehiclePictureSlot: {
    width: (screenWidth - 80) / 3,
    height: (screenWidth - 80) / 3,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
  },
  vehiclePictureSlotFilled: {
    borderStyle: 'solid',
    borderColor: BrandColors.primary,
    backgroundColor: '#ffffff',
  },
  vehiclePictureContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  vehiclePicture: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehiclePicturePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehiclePicturesCount: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
  guidelinesCard: {
    backgroundColor: '#f0f9ff',
    borderRadius: isSmallScreen ? 16 : 20,
    padding: isSmallScreen ? 16 : 20,
    borderLeftWidth: 4,
    borderLeftColor: BrandColors.primary,
  },
  guidelinesTitle: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  guidelinesList: {
    gap: 8,
  },
  guidelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  guidelineText: {
    fontSize: isSmallScreen ? 12 : 14,
    color: '#374151',
    flex: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
    gap: 6,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    flex: 1,
  },
});
