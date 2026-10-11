import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  Dimensions,
  Image,
  Alert,
} from 'react-native';
import { launchImageLibrary, ImagePickerResponse } from 'react-native-image-picker';
import { BrandColors } from '../../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { logger } from '../../../core/logging/logger';
import { mergeStepErrors } from './stepErrors';
import { useFieldAnchor } from '../../../features/auth/registration/fieldAnchors';
import { isStepFieldRequired } from '../../../schemas/registrationSchema';
import { DOCUMENT_PICKER_OPTIONS, uploadProblem } from '../../../features/driverDocuments/upload';
import {
  VEHICLE_PHOTO_SLOTS,
  filledVehiclePhotoCount,
  setVehiclePhoto,
} from '../../../features/auth/registration/registrationForm';

const { width: screenWidth } = Dimensions.get('window');
const isSmallScreen = screenWidth < 375;

type PickerType = 'driver' | 'cnic' | 'cnicFront' | 'cnicBack' | 'vehicle' | 'licenseFront' | 'profile';

const PICKER_FIELD: Record<PickerType, keyof DocumentsData> = {
  driver: 'driverPicture',
  cnic: 'cnicPicture',
  cnicFront: 'cnicFrontPicture',
  cnicBack: 'cnicBackPicture',
  vehicle: 'vehiclePictures',
  licenseFront: 'licenseFrontPicture',
  profile: 'profilePicture',
};

interface DocumentsData {
  driverPicture: string;
  cnicPicture: string;
  licenseFrontPicture: string;
  cnicFrontPicture: string; // For passengers
  cnicBackPicture: string;  // For passengers
  profilePicture: string;
  vehiclePictures: string[];
  role: 'driver' | 'passenger';
}

interface DocumentsStepProps {
  data: DocumentsData;
  onDataChange: (data: Partial<DocumentsData>) => void;
  errors: Partial<Record<string, string>>;
}

export default function DocumentsStep({ data, onDataChange, errors }: DocumentsStepProps) {
  const [localErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);
  const anchor = useFieldAnchor();
  // Schema errors from Next (T-201) plus the step's own picker errors.
  const validationErrors = mergeStepErrors(errors, localErrors);

  // Safety check for undefined data
  if (!data) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Loading...</Text>
      </View>
    );
  }

  /** `slot`: the vehicle photo slot that was tapped (its index is the side it is sent as). */
  const openImagePicker = (type: PickerType, slot = 0) => {
    setIsUploading(true);
    // Scaled to 2000 px at 0.8 quality by the picker; still checked against the 5 MB rule below.
    launchImageLibrary(DOCUMENT_PICKER_OPTIONS, (response: ImagePickerResponse) => {
      setIsUploading(false);
      
      if (response.didCancel) {
        logger.debug('Image picker cancelled');
        return;
      }

      // Some providers return an errorMessage but still include a valid asset
      const asset = response.assets && response.assets[0];
      const imageUri = asset?.uri;
      if (!imageUri) {
        logger.debug('Image picker cancelled or error:', response.errorMessage);
        Alert.alert('Error', 'Failed to get image. Please try again.');
        return;
      }
      
      logger.debug('Image picker response:', {
        imageUri,
        fileName: asset?.fileName,
        fileSize: asset?.fileSize,
        type: asset?.type
      });

      // The server takes JPEG/PNG/GIF up to 5 MB (T-203): say so now, not after Submit.
      const problem = asset ? uploadProblem(asset) : null;
      if (problem) {
        setValidationErrors(prev => ({ ...prev, [PICKER_FIELD[type]]: problem }));
        return;
      }

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
          // Index-stable: the photo replaces the tapped slot only (T-203).
          onDataChange({ vehiclePictures: setVehiclePhoto(data.vehiclePictures || [], slot, imageUri) });
          setValidationErrors(prev => ({ ...prev, vehiclePictures: '' }));
          break;
      }
    });
  };

  /** Clears one slot; the other sides keep their photos and positions. */
  const removeVehiclePicture = (index: number) => {
    onDataChange({ vehiclePictures: setVehiclePhoto(data.vehiclePictures || [], index, '') });
  };

  // Required documents are checked by registrationSchema (driverDocuments) on Next.

  const renderImagePicker = (
    label: string,
    imageUri: string,
    onPress: () => void,
    field: keyof DocumentsData,
    errorMessage?: string,
  ) => (
    <View style={styles.imagePickerContainer}>
      <View style={styles.imagePickerHeader}>
        <Text style={styles.imagePickerLabel}>{label}</Text>
        {/* Only fields the schema requires for this role get a * (T-206). */}
        {isStepFieldRequired('documents', field, data.role) && <Text style={styles.requiredText}>*</Text>}
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
        <View style={styles.errorContainer} ref={anchor(field)}>
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
        {isStepFieldRequired('documents', 'vehiclePictures', data.role) && <Text style={styles.requiredText}>*</Text>}
      </View>
      <Text style={styles.vehiclePicturesSubtitle}>
        Upload 4 clear pictures of your vehicle in this order: front, back, left side, right side
      </Text>
      <View style={styles.vehiclePicturesGrid}>
        {VEHICLE_PHOTO_SLOTS.map(({ label: slotLabel }, index) => (
          <View key={slotLabel}>
          <TouchableOpacity
            testID={`vehicle-photo-slot-${index}`}
            accessibilityLabel={`Vehicle ${slotLabel} picture`}
            style={[
              styles.vehiclePictureSlot,
              data.vehiclePictures && data.vehiclePictures[index] && styles.vehiclePictureSlotFilled
            ]}
            onPress={() => openImagePicker('vehicle', index)}
            disabled={isUploading}
          >
            {data.vehiclePictures && data.vehiclePictures[index] ? (
              <View style={styles.vehiclePictureContainer}>
                <Image 
                  source={{ uri: data.vehiclePictures[index] }} 
                  style={styles.vehiclePicture} 
                />
                <TouchableOpacity
                  testID={`vehicle-photo-remove-${index}`}
                  accessibilityLabel={`Remove vehicle ${slotLabel} picture`}
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
          {/* The side under every slot, filled or empty. */}
          <Text style={styles.vehiclePicturesCount}>{slotLabel}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.vehiclePicturesCount}>
        {filledVehiclePhotoCount(data.vehiclePictures)}/{VEHICLE_PHOTO_SLOTS.length} pictures uploaded
      </Text>
      {validationErrors.vehiclePictures && (
        <View style={styles.errorContainer} ref={anchor('vehiclePictures')}>
          <Icon name="error" size={16} color="#ef4444" />
          <Text style={styles.errorText}>{validationErrors.vehiclePictures}</Text>
        </View>
      )}
    </View>
  );

  if (data.role === 'passenger') {
    return (
      <View style={styles.container}>
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
            'profilePicture',
            validationErrors.profilePicture
          )}

          {/* CNIC Front Picture for Passengers */}
          {renderImagePicker(
            'CNIC Front Picture',
            data.cnicFrontPicture,
            () => openImagePicker('cnicFront'),
            'cnicFrontPicture',
            validationErrors.cnicFrontPicture
          )}

          {/* CNIC Back Picture for Passengers */}
          {renderImagePicker(
            'CNIC Back Picture',
            data.cnicBackPicture,
            () => openImagePicker('cnicBack'),
            'cnicBackPicture',
            validationErrors.cnicBackPicture
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
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
          'driverPicture',
          validationErrors.driverPicture
        )}

        {/* CNIC front (sent as cnic_front_image) and back (cnic_back_image, T-203) */}
        {renderImagePicker(
          'CNIC Front',
          data.cnicPicture,
          () => openImagePicker('cnic'),
          'cnicPicture',
          validationErrors.cnicPicture
        )}
        {renderImagePicker(
          'CNIC Back',
          data.cnicBackPicture,
          () => openImagePicker('cnicBack'),
          'cnicBackPicture',
          validationErrors.cnicBackPicture
        )}

        {/* Licence front (license_image). The server has no licence-back field, so none is asked. */}
        {renderImagePicker(
          'License Front',
          data.licenseFrontPicture,
          () => openImagePicker('licenseFront'),
          'licenseFrontPicture',
          validationErrors.licenseFrontPicture
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
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
