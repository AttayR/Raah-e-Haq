import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { launchImageLibrary, ImagePickerResponse, MediaType, PhotoQuality } from 'react-native-image-picker';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { detailedRegistrationThunk } from '../../store/thunks/authThunks';
import ThemedTextInput from '../../components/ThemedTextInput';
import BrandButton from '../../components/BrandButton';
import { 
  createValidationSchema
} from '../../schemas/registrationSchema';

type RegistrationFormProps = {
  initialRole?: 'driver' | 'passenger';
  onSuccess?: () => void;
};

const vehicleTypes = [
  { label: 'Car', value: 'car' },
  { label: 'Bike', value: 'bike' },
  { label: 'Van', value: 'van' },
  { label: 'Truck', value: 'truck' },
];

export default function RegistrationForm({ initialRole = 'passenger', onSuccess }: RegistrationFormProps) {
  const { theme } = useAppTheme();
  const dispatch = useDispatch<any>();
  const { error } = useSelector((state: RootState) => state.auth);
  
  const [selectedRole, setSelectedRole] = useState<'driver' | 'passenger'>(initialRole);
  const [selectedVehicleType, setSelectedVehicleType] = useState<string>('');
  const [driverPicture, setDriverPicture] = useState<string>('');
  const [cnicPicture, setCnicPicture] = useState<string>('');
  const [vehiclePictures, setVehiclePictures] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualValidation, setManualValidation] = useState<{ isValid: boolean; errors: Record<string, string> }>({ isValid: false, errors: {} });

  // Manual validation function
  const validateForm = React.useCallback(async (data: any) => {
    try {
      // Add vehicle type to data if it's selected
      if (selectedRole === 'driver' && selectedVehicleType) {
        data.vehicleType = selectedVehicleType;
      }
      
      const schema = createValidationSchema(selectedRole);
      await schema.validate(data, { abortEarly: false });
      
      // Additional validation for driver images
      const errors: any = {};
      if (selectedRole === 'driver') {
        console.log('Image validation debug:', {
          driverPicture: driverPicture,
          cnicPicture: cnicPicture,
          vehiclePictures: vehiclePictures,
          driverPictureLength: driverPicture?.length || 0,
          cnicPictureLength: cnicPicture?.length || 0,
          vehiclePicturesLength: vehiclePictures?.length || 0,
          driverPictureType: typeof driverPicture,
          cnicPictureType: typeof cnicPicture
        });
        
        // Driver picture and CNIC picture are now optional
        // Only vehicle pictures are required for drivers
        if (!vehiclePictures || vehiclePictures.length === 0) {
          errors.vehiclePictures = 'At least one vehicle picture is required';
        }
      }
      
      if (Object.keys(errors).length > 0) {
        console.log('Validation errors:', errors);
        setManualValidation({ isValid: false, errors });
        return false;
      }
      
      setManualValidation({ isValid: true, errors: {} });
      return true;
    } catch (validationError: any) {
      const errors: any = {};
      if (validationError.inner) {
        validationError.inner.forEach((err: any) => {
          if (err.path) {
            errors[err.path] = err.message;
          }
        });
      }
      
      // Add image validation errors for driver
      if (selectedRole === 'driver') {
        console.log('Image validation debug (catch):', {
          driverPicture: driverPicture,
          cnicPicture: cnicPicture,
          vehiclePictures: vehiclePictures,
          driverPictureLength: driverPicture?.length || 0,
          cnicPictureLength: cnicPicture?.length || 0,
          vehiclePicturesLength: vehiclePictures?.length || 0,
          driverPictureType: typeof driverPicture,
          cnicPictureType: typeof cnicPicture
        });
        
        // Driver picture and CNIC picture are now optional
        // Only vehicle pictures are required for drivers
        if (!vehiclePictures || vehiclePictures.length === 0) {
          errors.vehiclePictures = 'At least one vehicle picture is required';
        }
      }
      
      console.log('Validation errors (catch):', errors);
      setManualValidation({ isValid: false, errors });
      return false;
    }
  }, [selectedRole, selectedVehicleType, driverPicture, cnicPicture, vehiclePictures]);

  // Custom validation resolver that handles role changes
  const customResolver = async (data: any) => {
    try {
      const schema = createValidationSchema(selectedRole);
      const result = await schema.validate(data, { abortEarly: false });
      return { values: result, errors: {} };
    } catch (validationError: any) {
      const errors: any = {};
      if (validationError.inner) {
        validationError.inner.forEach((err: any) => {
          if (err.path) {
            errors[err.path] = { message: err.message };
          }
        });
      }
      return { values: {}, errors };
    }
  };

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    watch,
    getValues,
    setValue,
    reset,
    trigger,
  } = useForm({
    resolver: customResolver,
    mode: 'onChange',
    defaultValues: {
      fullName: '',
      cnic: '',
      address: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: selectedRole,
      ...(selectedRole === 'driver' && {
        vehicleType: '',
        vehicleNumber: '',
        vehicleBrand: '',
        vehicleModel: '',
        vehicleYear: '',
        vehicleColor: '',
      }),
    },
  });

  // Watch form values and validate using individual field watchers
  const fullName = watch('fullName');
  const cnic = watch('cnic');
  const address = watch('address');
  const email = watch('email');
  const password = watch('password');
  const confirmPassword = watch('confirmPassword');
  const vehicleType = watch('vehicleType');
  const vehicleNumber = watch('vehicleNumber');
  const vehicleBrand = watch('vehicleBrand');
  const vehicleModel = watch('vehicleModel');

  // Validate form when values change
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      const currentValues = getValues();
      console.log('Triggering validation with current values:', currentValues);
      console.log('Current image states:', { driverPicture, cnicPicture, vehiclePictures });
      validateForm(currentValues);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [fullName, cnic, address, email, password, confirmPassword, vehicleType, vehicleNumber, vehicleBrand, vehicleModel, selectedRole, selectedVehicleType, driverPicture, cnicPicture, vehiclePictures, getValues, validateForm]);

  // Additional validation trigger when images change
  React.useEffect(() => {
    if (selectedRole === 'driver') {
      const timeoutId = setTimeout(() => {
        const currentValues = getValues();
        console.log('Image change validation trigger:', { driverPicture, cnicPicture, vehiclePictures });
        validateForm(currentValues);
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [driverPicture, cnicPicture, vehiclePictures, selectedRole, getValues, validateForm]);

  // Reset form when role changes
  React.useEffect(() => {
    reset({
      fullName: '',
      cnic: '',
      address: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: selectedRole,
      ...(selectedRole === 'driver' && {
        vehicleType: '',
        vehicleNumber: '',
        vehicleBrand: '',
        vehicleModel: '',
        vehicleYear: '',
        vehicleColor: '',
      }),
    });
    
    // Clear image states when role changes
    setDriverPicture('');
    setCnicPicture('');
    setVehiclePictures([]);
    setSelectedVehicleType('');
    
    // Trigger validation after reset
    setTimeout(() => {
      trigger();
    }, 100);
  }, [selectedRole, reset, trigger]);

  const openImagePicker = (type: 'driver' | 'cnic' | 'vehicle') => {
    const options = {
      mediaType: 'photo' as MediaType,
      quality: 0.8 as PhotoQuality,
      maxWidth: 1024,
      maxHeight: 1024,
    };

    launchImageLibrary(options, (response: ImagePickerResponse) => {
      if (response.didCancel || response.errorMessage) {
        return;
      }

      const imageUri = response.assets?.[0]?.uri;
      if (!imageUri) return;

      switch (type) {
        case 'driver':
          setDriverPicture(imageUri);
          console.log('Driver picture set to:', imageUri);
          // Trigger validation after setting image with longer delay
          setTimeout(() => {
            const currentValues = getValues();
            validateForm(currentValues);
          }, 500);
          break;
        case 'cnic':
          setCnicPicture(imageUri);
          console.log('CNIC picture set to:', imageUri);
          // Trigger validation after setting image with longer delay
          setTimeout(() => {
            const currentValues = getValues();
            validateForm(currentValues);
          }, 500);
          break;
        case 'vehicle':
          if (vehiclePictures.length < 6) {
            const newPictures = [...vehiclePictures, imageUri];
            setVehiclePictures(newPictures);
            console.log('Vehicle pictures set to:', newPictures);
            // Trigger validation after setting image with longer delay
            setTimeout(() => {
              const currentValues = getValues();
              validateForm(currentValues);
            }, 500);
          } else {
            Alert.alert('Limit Reached', 'Maximum 6 vehicle pictures allowed');
          }
          break;
      }
    });
  };

  const removeVehiclePicture = (index: number) => {
    const newPictures = vehiclePictures.filter((_, i) => i !== index);
    setVehiclePictures(newPictures);
    // Trigger validation after removing image
    setTimeout(() => {
      const currentValues = getValues();
      validateForm(currentValues);
    }, 100);
  };

  const onSubmit = async (data: any) => {
    try {
      setIsSubmitting(true);
      
      // First validate the form
      const isValid = await validateForm(data);
      if (!isValid) {
        // Show specific validation errors
        const errorMessages = Object.values(manualValidation.errors).join('\n• ');
        Alert.alert(
          'Validation Error',
          `Please fix the following issues:\n\n• ${errorMessages}`,
          [{ text: 'OK' }]
        );
        return;
      }
      
      // Prepare profile data
      const profileData = {
        fullName: data.fullName,
        cnic: data.cnic,
        address: data.address,
        ...(selectedRole === 'driver' && {
          vehicleType: data.vehicleType,
          vehicleInfo: {
            number: data.vehicleNumber,
            brand: data.vehicleBrand,
            model: data.vehicleModel,
            year: data.vehicleYear,
            color: data.vehicleColor,
          },
          driverPictureUri: driverPicture,
          cnicPictureUri: cnicPicture,
          vehiclePictureUris: vehiclePictures,
        }),
      };
      
      // Use the detailed registration thunk
      await dispatch(detailedRegistrationThunk(
        data.email,
        data.password,
        selectedRole,
        profileData
      ));
      
      Alert.alert(
        'Registration Successful',
        'Your account has been created successfully!',
        [{ text: 'OK', onPress: onSuccess }]
      );
      
    } catch (registrationError: any) {
      console.error('Registration error:', registrationError);
      Alert.alert('Registration Failed', registrationError.message || 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderImagePicker = (
    label: string,
    imageUri: string,
    onPress: () => void,
    _errorMessage?: string
  ) => (
    <View style={styles.imagePickerContainer}>
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
      <TouchableOpacity style={styles.imagePicker} onPress={onPress}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.previewImage} />
        ) : (
          <Text style={[styles.imagePickerText, { color: theme.colors.mutedText }]}>
            Tap to select image
          </Text>
        )}
      </TouchableOpacity>
      {error && <Text style={[styles.errorText, { color: theme.colors.warning }]}>{error}</Text>}
    </View>
  );

  const renderVehiclePictureGrid = () => (
    <View style={styles.imagePickerContainer}>
      <Text style={[styles.label, { color: theme.colors.text }]}>
        Vehicle Pictures (4-6 required)
      </Text>
      <View style={styles.vehiclePicturesGrid}>
        {Array.from({ length: 6 }, (_, index) => (
          <TouchableOpacity
            key={index}
            style={styles.vehiclePictureSlot}
            onPress={() => openImagePicker('vehicle')}
          >
            {vehiclePictures[index] ? (
              <View style={styles.vehiclePictureContainer}>
                <Image source={{ uri: vehiclePictures[index] }} style={styles.vehiclePicture} />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeVehiclePicture(index)}
                >
                  <Text style={styles.removeButtonText}>×</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={[styles.vehiclePicturePlaceholder, { color: theme.colors.mutedText }]}>
                +
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
      {manualValidation.errors.vehiclePictures && (
        <Text style={[styles.errorText, { color: theme.colors.warning }]}>
          {manualValidation.errors.vehiclePictures}
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
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Complete Your Profile
        </Text>

        {/* Role Selection */}
        <View style={styles.roleContainer}>
          <Text style={[styles.label, { color: theme.colors.text }]}>I am a:</Text>
          <View style={styles.roleButtons}>
            <BrandButton
              title="Passenger"
              onPress={() => setSelectedRole('passenger')}
              variant={selectedRole === 'passenger' ? 'primary' : 'secondary'}
              style={StyleSheet.flatten([styles.roleButton, { flex: 1 }])}
            />
            <BrandButton
              title="Driver"
              onPress={() => setSelectedRole('driver')}
              variant={selectedRole === 'driver' ? 'primary' : 'secondary'}
              style={StyleSheet.flatten([styles.roleButton, { flex: 1 }])}
            />
          </View>
        </View>

        {/* Common Fields */}
            <Controller
              control={control}
              name="fullName"
              render={({ field: { onChange, onBlur, value } }) => (
                <View>
                  <ThemedTextInput
                    placeholder="Full Name"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                  {errors.fullName && (
                    <Text style={[styles.errorText, { color: theme.colors.warning }]}>
                      {errors.fullName.message}
                    </Text>
                  )}
                </View>
              )}
            />

        <Controller
          control={control}
          name="cnic"
          render={({ field: { onChange, onBlur, value } }) => (
            <View>
              <ThemedTextInput
                placeholder="CNIC (e.g., 12345-1234567-1)"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
              />
              {errors.cnic && (
                <Text style={[styles.errorText, { color: theme.colors.warning }]}>
                  {errors.cnic.message}
                </Text>
              )}
            </View>
          )}
        />

        <Controller
          control={control}
          name="address"
          render={({ field: { onChange, onBlur, value } }) => (
            <View>
              <ThemedTextInput
                placeholder="Address"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                multiline
                numberOfLines={3}
              />
              {errors.address && (
                <Text style={[styles.errorText, { color: theme.colors.warning }]}>
                  {errors.address.message}
                </Text>
              )}
            </View>
          )}
        />

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <View>
              <ThemedTextInput
                placeholder="Email"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {errors.email && (
                <Text style={[styles.errorText, { color: theme.colors.warning }]}>
                  {errors.email.message}
                </Text>
              )}
            </View>
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <View>
              <ThemedTextInput
                placeholder="Password"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry
              />
              {errors.password && (
                <Text style={[styles.errorText, { color: theme.colors.warning }]}>
                  {errors.password.message}
                </Text>
              )}
            </View>
          )}
        />

        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <View>
              <ThemedTextInput
                placeholder="Confirm Password"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry
              />
              {errors.confirmPassword && (
                <Text style={[styles.errorText, { color: theme.colors.warning }]}>
                  {errors.confirmPassword.message}
                </Text>
              )}
            </View>
          )}
        />

        {/* Driver-specific Fields */}
        {selectedRole === 'driver' && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Driver Information
            </Text>

            {/* Vehicle Type */}
            <View style={styles.vehicleTypeContainer}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Vehicle Type:</Text>
              <View style={styles.vehicleTypeGrid}>
                {vehicleTypes.map((type) => (
                  <BrandButton
                    key={type.value}
                    title={type.label}
                    onPress={() => {
                      setSelectedVehicleType(type.value);
                      setValue('vehicleType', type.value);
                      // Trigger validation after setting the value
                      setTimeout(() => {
                        trigger();
                        const currentValues = getValues();
                        validateForm(currentValues);
                      }, 100);
                    }}
                    variant={selectedVehicleType === type.value ? 'primary' : 'secondary'}
                    style={styles.vehicleTypeButton}
                  />
                ))}
              </View>
              {errors.vehicleType && (
                <Text style={[styles.errorText, { color: theme.colors.warning }]}>
                  {errors.vehicleType.message}
                </Text>
              )}
            </View>

            {/* Vehicle Information */}
            <Controller
              control={control}
              name="vehicleNumber"
              render={({ field: { onChange, onBlur, value } }) => (
                <View>
                  <ThemedTextInput
                    placeholder="Vehicle Number"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                  {errors.vehicleNumber && (
                    <Text style={[styles.errorText, { color: theme.colors.warning }]}>
                      {errors.vehicleNumber.message}
                    </Text>
                  )}
                </View>
              )}
            />

            <Controller
              control={control}
              name="vehicleBrand"
              render={({ field: { onChange, onBlur, value } }) => (
                <View>
                  <ThemedTextInput
                    placeholder="Vehicle Brand"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                  {errors.vehicleBrand && (
                    <Text style={[styles.errorText, { color: theme.colors.warning }]}>
                      {errors.vehicleBrand.message}
                    </Text>
                  )}
                </View>
              )}
            />

            <Controller
              control={control}
              name="vehicleModel"
              render={({ field: { onChange, onBlur, value } }) => (
                <View>
                  <ThemedTextInput
                    placeholder="Vehicle Model"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                  {errors.vehicleModel && (
                    <Text style={[styles.errorText, { color: theme.colors.warning }]}>
                      {errors.vehicleModel.message}
                    </Text>
                  )}
                </View>
              )}
            />

            <View style={styles.row}>
              <Controller
                control={control}
                name="vehicleYear"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View style={StyleSheet.flatten([styles.halfInput, { marginRight: 8 }])}>
                    <ThemedTextInput
                      placeholder="Year (optional)"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      keyboardType="numeric"
                    />
                    {errors.vehicleYear && (
                      <Text style={[styles.errorText, { color: theme.colors.warning }]}>
                        {errors.vehicleYear.message}
                      </Text>
                    )}
                  </View>
                )}
              />
              <Controller
                control={control}
                name="vehicleColor"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View style={StyleSheet.flatten([styles.halfInput, { marginLeft: 8 }])}>
                    <ThemedTextInput
                      placeholder="Color (optional)"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                    />
                    {errors.vehicleColor && (
                      <Text style={[styles.errorText, { color: theme.colors.warning }]}>
                        {errors.vehicleColor.message}
                      </Text>
                    )}
                  </View>
                )}
              />
            </View>

            {/* Image Uploads */}
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Documents (Optional)
            </Text>

            {renderImagePicker(
              'Driver Picture (Optional)',
              driverPicture,
              () => openImagePicker('driver'),
              manualValidation.errors.driverPicture
            )}

            {renderImagePicker(
              'CNIC Picture (Optional)',
              cnicPicture,
              () => openImagePicker('cnic'),
              manualValidation.errors.cnicPicture
            )}

            {renderVehiclePictureGrid()}
          </>
        )}

        {/* Debug Info */}
        {__DEV__ && (
          <View style={styles.debugContainer}>
            <Text style={styles.debugText}>Form Valid: {isValid ? 'Yes' : 'No'}</Text>
            <Text style={styles.debugText}>Manual Valid: {manualValidation.isValid ? 'Yes' : 'No'}</Text>
            <Text style={styles.debugText}>Role: {selectedRole}</Text>
            <Text style={styles.debugText}>Errors: {Object.keys(errors).length}</Text>
            <Text style={styles.debugText}>Manual Errors: {Object.keys(manualValidation.errors).length}</Text>
            <Text style={styles.debugText}>Driver Pic: {driverPicture ? 'Yes' : 'No'}</Text>
            <Text style={styles.debugText}>CNIC Pic: {cnicPicture ? 'Yes' : 'No'}</Text>
            <Text style={styles.debugText}>Vehicle Pics: {vehiclePictures.length}</Text>
            <Text style={styles.debugText}>Vehicle Type: {selectedVehicleType || 'None'}</Text>
          </View>
        )}

        {/* Submit Button */}
        <BrandButton
          title={isSubmitting ? 'Creating Account...' : 'Create Account'}
          onPress={handleSubmit(onSubmit)}
          variant="primary"
          disabled={isSubmitting}
          style={styles.submitButton}
        />

        {/* Manual Validation Errors */}
        {Object.keys(manualValidation.errors).length > 0 && (
          <View style={styles.validationErrorsContainer}>
            {Object.entries(manualValidation.errors).map(([field, message]) => (
              <Text key={field} style={[styles.errorText, { color: theme.colors.warning }]}>
                {field}: {String(message)}
              </Text>
            ))}
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
  },
  roleContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  roleButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  roleButton: {
    marginBottom: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 16,
  },
  vehicleTypeContainer: {
    marginBottom: 16,
  },
  vehicleTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  vehicleTypeButton: {
    flex: 1,
    minWidth: 80,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  halfInput: {
    flex: 1,
  },
  imagePickerContainer: {
    marginBottom: 16,
  },
  imagePicker: {
    height: 120,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  imagePickerText: {
    fontSize: 14,
  },
  vehiclePicturesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  vehiclePictureSlot: {
    width: 80,
    height: 80,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehiclePictureContainer: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  vehiclePicture: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'red',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  vehiclePicturePlaceholder: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  submitButton: {
    marginTop: 24,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
  debugContainer: {
    backgroundColor: '#f0f0f0',
    padding: 8,
    marginVertical: 8,
    borderRadius: 4,
  },
  debugText: {
    fontSize: 12,
    color: '#666',
  },
  validationErrorsContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#fff3cd',
    borderRadius: 4,
  },
});
