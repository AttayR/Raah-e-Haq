import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { setProfileCompleted, setUserProfile } from '../../store/slices/authSlice';
import BrandButton from '../../components/BrandButton';
import ThemedTextInput from '../../components/ThemedTextInput';
import { saveUserBasicInfo } from '../../services/userService';
import { showToast } from '../../components/ToastProvider';

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

export default function BasicInfoScreen() {
  const { theme } = useAppTheme();
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

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Full Name validation
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = 'Full name must be at least 2 characters';
    }

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    // CNIC validation (Pakistani CNIC format: 00000-0000000-0)
    if (!formData.cnic.trim()) {
      newErrors.cnic = 'CNIC is required';
    } else if (!/^\d{5}-\d{7}-\d$/.test(formData.cnic.trim())) {
      newErrors.cnic = 'Please enter CNIC in format: 00000-0000000-0';
    }

    // Address validation
    if (!formData.address.trim()) {
      newErrors.address = 'Address is required';
    } else if (formData.address.trim().length < 10) {
      newErrors.address = 'Address must be at least 10 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    if (!phoneNumber) {
      showToast('error', 'Phone number not found. Please try signing in again.');
      return;
    }

    if (!uid) {
      showToast('error', 'User ID not found. Please try signing in again.');
      console.error('BasicInfoScreen - UID is undefined in auth state');
      return;
    }

    setIsSubmitting(true);
    try {
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
      showToast('error', error.message || 'Failed to save information');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.title, { color: theme.colors.text }]}>
        Complete Your Profile
      </Text>

      <Text style={[styles.subtitle, { color: theme.colors.mutedText }]}>
        Please provide your basic information to continue
      </Text>

      <View style={styles.formContainer}>
        <View style={styles.inputContainer}>
          <ThemedTextInput
            placeholder="Full Name"
            value={formData.fullName}
            onChangeText={(value) => handleInputChange('fullName', value)}
            autoCapitalize="words"
          />
          {errors.fullName && (
            <Text style={[styles.errorText, { color: theme.colors.warning }]}>
              {errors.fullName}
            </Text>
          )}
        </View>

        <View style={styles.inputContainer}>
          <ThemedTextInput
            placeholder="Email Address"
            value={formData.email}
            onChangeText={(value) => handleInputChange('email', value)}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {errors.email && (
            <Text style={[styles.errorText, { color: theme.colors.warning }]}>
              {errors.email}
            </Text>
          )}
        </View>

        <View style={styles.inputContainer}>
          <ThemedTextInput
            placeholder="CNIC (00000-0000000-0)"
            value={formData.cnic}
            onChangeText={(value) => handleInputChange('cnic', value)}
            keyboardType="numeric"
            maxLength={15}
          />
          {errors.cnic && (
            <Text style={[styles.errorText, { color: theme.colors.warning }]}>
              {errors.cnic}
            </Text>
          )}
        </View>

        <View style={styles.inputContainer}>
          <ThemedTextInput
            placeholder="Full Address"
            value={formData.address}
            onChangeText={(value) => handleInputChange('address', value)}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          {errors.address && (
            <Text style={[styles.errorText, { color: theme.colors.warning }]}>
              {errors.address}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <BrandButton
          title={isSubmitting ? 'Saving...' : 'Save & Continue'}
          onPress={handleSubmit}
          variant="primary"
          disabled={isSubmitting}
          style={styles.submitButton}
        />

        <BrandButton
          title="Go Back"
          onPress={handleBack}
          variant="secondary"
          style={styles.backButton}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  formContainer: {
    gap: 20,
    marginBottom: 32,
  },
  inputContainer: {
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    marginLeft: 4,
  },
  buttonContainer: {
    gap: 16,
  },
  submitButton: {
    marginBottom: 8,
  },
  backButton: {
    marginBottom: 8,
  },
});
