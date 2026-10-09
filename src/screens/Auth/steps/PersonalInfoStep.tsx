import React, { useRef, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  Dimensions,
  Image,
} from 'react-native';
import { BrandColors } from '../../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ThemedTextInput from '../../../components/ThemedTextInput';
import type { RegistrationFormData } from '../../../features/auth/registration/registrationForm';
import { validateStepField } from '../../../schemas/registrationSchema';
import { mergeStepErrors } from './stepErrors';

const { width: screenWidth } = Dimensions.get('window');
const isSmallScreen = screenWidth < 375;

type PersonalInfoData = RegistrationFormData;

interface PersonalInfoStepProps {
  data: PersonalInfoData;
  onDataChange: (data: Partial<PersonalInfoData>) => void;
  errors: Partial<Record<string, string>>;
  apiErrors?: Record<string, string>;
  onClearApiError?: (field: string) => void;
}

const API_FIELD_MAP: Record<string, string> = {
  dateOfBirth: 'date_of_birth',
  emergencyRelationship: 'passenger_emergency_contact_relation',
};

// API expects one of these values for passenger_emergency_contact_relation
export const EMERGENCY_RELATION_OPTIONS: { value: string; label: string }[] = [
  { value: 'father', label: 'Father' },
  { value: 'mother', label: 'Mother' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'brother', label: 'Brother' },
  { value: 'sister', label: 'Sister' },
  { value: 'friend', label: 'Friend' },
  { value: 'other', label: 'Other' },
];

export default function PersonalInfoStep({ data, onDataChange, errors, apiErrors = {}, onClearApiError }: PersonalInfoStepProps) {
  const [localErrors, setValidationErrors] = useState<Record<string, string>>({});
  // The latest typed values: a blur can fire before the re-render that carries the last
  // keystroke (tap Next right after typing), so blur checks read this, never a stale `data`.
  const latest = useRef(data);
  latest.current = data;
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Safety check for undefined data
  if (!data) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Loading...</Text>
      </View>
    );
  }

  // Schema errors from Next (T-201) plus the ones found on blur.
  const validationErrors = mergeStepErrors(errors, localErrors);

  const formatCNIC = (value: string): string => {
    if (!value) return '';
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 5) {
      return digits;
    } else if (digits.length <= 12) {
      return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    } else {
      return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12, 13)}`;
    }
  };

  const formatPhoneNumber = (value: string): string => {
    if (!value) return '';
    const digits = value.replace(/\D/g, '');
    if (digits.startsWith('92')) {
      return `+${digits}`;
    } else if (digits.startsWith('0')) {
      return `+92${digits.slice(1)}`;
    } else if (digits.length > 0) {
      return `+92${digits}`;
    }
    return digits;
  };

  const handleInputChange = (field: keyof PersonalInfoData, value: string) => {
    let processedValue = value || '';
    
    if (field === 'cnic') {
      processedValue = formatCNIC(value);
    } else if (field === 'phoneNumber') {
      processedValue = formatPhoneNumber(value);
    }
    
    latest.current = { ...latest.current, [field]: processedValue };
    onDataChange({ [field]: processedValue });

    // Typing makes this field's error stale, whatever set it (blur or Next).
    setValidationErrors(prev => (prev[field] ? { ...prev, [field]: '' } : prev));
    const apiField = API_FIELD_MAP[field] || field;
    if (apiErrors[apiField] && onClearApiError) {
      onClearApiError(apiField);
    }
  };

  const validateField = (field: keyof PersonalInfoData) => {
    const error = validateStepField('personal', field, latest.current);
    setValidationErrors(prev => ({ ...prev, [field]: error ?? '' }));
  };

  const handleRoleChange = (role: 'driver' | 'passenger') => {
    onDataChange({ role });
  };

  const getPasswordStrength = (password: string): { strength: string; color: string; percentage: number } => {
    if (!password || password.length === 0) return { strength: '', color: '#9ca3af', percentage: 0 };
    
    let score = 0;
    if (password.length >= 8) score += 25;
    if (/(?=.*[a-z])/.test(password)) score += 25;
    if (/(?=.*[A-Z])/.test(password)) score += 25;
    if (/(?=.*\d)/.test(password)) score += 25;
    
    if (score < 50) return { strength: 'Weak', color: '#ef4444', percentage: score };
    if (score < 75) return { strength: 'Medium', color: '#f59e0b', percentage: score };
    return { strength: 'Strong', color: '#10b981', percentage: score };
  };

  const passwordStrength = getPasswordStrength(data.password || '');

  return (
    <View style={styles.container}>
      {/* Role Selection */}
      <View style={styles.roleSection}>
        <Text style={styles.sectionTitle}>Account Type</Text>
        <Text style={styles.sectionSubtitle}>Choose how you want to use RaaHeHaq</Text>
        
        <View style={styles.roleButtons}>
          <TouchableOpacity
            style={[
              styles.roleButton,
              data.role === 'passenger' ? styles.roleButtonActive : styles.roleButtonInactive
            ]}
            onPress={() => handleRoleChange('passenger')}
            activeOpacity={0.8}
          >
            <Image
              source={require('../../../assets/images/4.png')}
              style={styles.roleImage}
              resizeMode="contain"
            />
            <Text
              style={[
                styles.roleButtonText,
                data.role === 'passenger' ? styles.roleButtonTextActive : styles.roleButtonTextInactive,
              ]}
            >
              Passenger
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.roleButton,
              data.role === 'driver' ? styles.roleButtonActive : styles.roleButtonInactive
            ]}
            onPress={() => handleRoleChange('driver')}
            activeOpacity={0.8}
          >
            <Image
              source={require('../../../assets/images/2.png')}
              style={styles.roleImage}
              resizeMode="contain"
            />
            <Text
              style={[
                styles.roleButtonText,
                data.role === 'driver' ? styles.roleButtonTextActive : styles.roleButtonTextInactive,
              ]}
            >
              Driver
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Personal Information Form */}
      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Personal Information</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Full Name *</Text>
          <ThemedTextInput
            placeholder="Enter your full name"
            value={data.fullName || ''}
            onChangeText={(value) => handleInputChange('fullName', value)}
            onBlur={() => validateField('fullName')}
            autoCapitalize="words"
            style={styles.input}
          />
          {validationErrors.fullName && (
            <View style={styles.errorContainer}>
              <Icon name="error" size={16} color={styles.errorText.color} />
              <Text style={styles.errorText}>{validationErrors.fullName}</Text>
            </View>
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Email Address *</Text>
          <ThemedTextInput
            placeholder="Enter your email address"
            value={data.email || ''}
            onChangeText={(value) => handleInputChange('email', value)}
            onBlur={() => validateField('email')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            style={styles.input}
          />
          {validationErrors.email && (
            <View style={styles.errorContainer}>
              <Icon name="error" size={16} color={styles.errorText.color} />
              <Text style={styles.errorText}>{validationErrors.email}</Text>
            </View>
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Phone Number *</Text>
          <ThemedTextInput
            placeholder="+92XXXXXXXXXX"
            value={data.phoneNumber || ''}
            onChangeText={(value) => handleInputChange('phoneNumber', value)}
            onBlur={() => validateField('phoneNumber')}
            keyboardType="phone-pad"
            style={styles.input}
          />
          {validationErrors.phoneNumber && (
            <View style={styles.errorContainer}>
              <Icon name="error" size={16} color={styles.errorText.color} />
              <Text style={styles.errorText}>{validationErrors.phoneNumber}</Text>
            </View>
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>CNIC Number *</Text>
          <ThemedTextInput
            placeholder="00000-0000000-0"
            value={data.cnic || ''}
            onChangeText={(value) => handleInputChange('cnic', value)}
            onBlur={() => validateField('cnic')}
            keyboardType="numeric"
            maxLength={15}
            style={styles.input}
          />
          {validationErrors.cnic && (
            <View style={styles.errorContainer}>
              <Icon name="error" size={16} color={styles.errorText.color} />
              <Text style={styles.errorText}>{validationErrors.cnic}</Text>
            </View>
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Address *</Text>
          <ThemedTextInput
            placeholder="Enter your complete address"
            value={data.address || ''}
            onChangeText={(value) => handleInputChange('address', value)}
            onBlur={() => validateField('address')}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={[styles.input, styles.textArea]}
          />
          {(validationErrors.address || apiErrors.address) && (
            <View style={styles.errorContainer}>
              <Icon name="error" size={16} color={styles.errorText.color} />
              <Text style={styles.errorText}>{validationErrors.address || apiErrors.address}</Text>
            </View>
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Date of Birth *</Text>
          <ThemedTextInput
            placeholder="YYYY-MM-DD (e.g. 1990-01-15)"
            value={data.dateOfBirth || ''}
            onChangeText={(value) => handleInputChange('dateOfBirth', value)}
            onBlur={() => validateField('dateOfBirth')}
            keyboardType="numeric"
            maxLength={10}
            style={styles.input}
          />
          {(validationErrors.dateOfBirth || apiErrors.date_of_birth) && (
            <View style={styles.errorContainer}>
              <Icon name="error" size={16} color={styles.errorText.color} />
              <Text style={styles.errorText}>{validationErrors.dateOfBirth || apiErrors.date_of_birth}</Text>
            </View>
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Gender *</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {(['male', 'female', 'other'] as const).map((g) => (
              <TouchableOpacity
                key={g}
                onPress={() => {
                  onDataChange({ gender: g });
                  if (apiErrors.gender && onClearApiError) onClearApiError('gender');
                }}
                style={[styles.chip, data.gender === g && styles.chipActive]}
              >
                <Text style={[styles.chipText, data.gender === g && styles.chipTextActive]}>
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {(validationErrors.gender || apiErrors.gender) && (
            <View style={styles.errorContainer}>
              <Icon name="error" size={16} color={styles.errorText.color} />
              <Text style={styles.errorText}>{validationErrors.gender || apiErrors.gender}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Password Section */}
      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Account Security</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Password *</Text>
          <View style={styles.passwordContainer}>
            <ThemedTextInput
              placeholder="Create a strong password"
              value={data.password || ''}
              onChangeText={(value) => handleInputChange('password', value)}
              onBlur={() => validateField('password')}
              secureTextEntry={!showPassword}
              style={[styles.input, styles.passwordInput]}
            />
            <TouchableOpacity
              style={styles.passwordToggle}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Icon 
                name={showPassword ? 'visibility-off' : 'visibility'} 
                size={20} 
                color="#9ca3af" 
              />
            </TouchableOpacity>
          </View>
          
          {/* Password Strength Indicator */}
          {passwordStrength.strength !== '' && (
            <View style={styles.passwordStrengthContainer}>
              <View style={styles.passwordStrengthBar}>
                <View 
                  style={[
                    styles.passwordStrengthFill,
                    { 
                      width: `${passwordStrength.percentage}%`,
                      backgroundColor: passwordStrength.color
                    }
                  ]} 
                />
              </View>
              <Text style={[styles.passwordStrengthText, { color: passwordStrength.color }]}>
                {passwordStrength.strength}
              </Text>
            </View>
          )}
          
          {(validationErrors.password || apiErrors.password) && (
            <View style={styles.errorContainer}>
              <Icon name="error" size={16} color={styles.errorText.color} />
              <Text style={styles.errorText}>{validationErrors.password || apiErrors.password}</Text>
            </View>
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Confirm Password *</Text>
          <View style={styles.passwordContainer}>
            <ThemedTextInput
              placeholder="Confirm your password"
              value={data.confirmPassword || ''}
              onChangeText={(value) => handleInputChange('confirmPassword', value)}
              onBlur={() => validateField('confirmPassword')}
              secureTextEntry={!showConfirmPassword}
              style={[styles.input, styles.passwordInput]}
            />
            <TouchableOpacity
              style={styles.passwordToggle}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              <Icon 
                name={showConfirmPassword ? 'visibility-off' : 'visibility'} 
                size={20} 
                color="#9ca3af" 
              />
            </TouchableOpacity>
          </View>
          {validationErrors.confirmPassword && (
            <View style={styles.errorContainer}>
              <Icon name="error" size={16} color={styles.errorText.color} />
              <Text style={styles.errorText}>{validationErrors.confirmPassword}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Emergency Contact */}
      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Emergency Contact Details</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Emergency Contact Number *</Text>
          <ThemedTextInput
            placeholder="+92XXXXXXXXXX"
            value={data.emergencyContactNumber || ''}
            onChangeText={(value) => handleInputChange('emergencyContactNumber', value)}
            onBlur={() => validateField('emergencyContactNumber')}
            keyboardType="phone-pad"
            style={styles.input}
          />
          {validationErrors.emergencyContactNumber && (
            <View style={styles.errorContainer}>
              <Icon name="error" size={16} color={styles.errorText.color} />
              <Text style={styles.errorText}>{validationErrors.emergencyContactNumber}</Text>
            </View>
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Emergency Contact Name *</Text>
          <ThemedTextInput
            placeholder="Full name of emergency contact"
            value={data.emergencyContactName || ''}
            onChangeText={(value) => handleInputChange('emergencyContactName', value)}
            onBlur={() => validateField('emergencyContactName')}
            autoCapitalize="words"
            style={styles.input}
          />
          {validationErrors.emergencyContactName && (
            <View style={styles.errorContainer}>
              <Icon name="error" size={16} color={styles.errorText.color} />
              <Text style={styles.errorText}>{validationErrors.emergencyContactName}</Text>
            </View>
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Relationship *</Text>
          <Text style={styles.inputHint}>Select the relationship to your emergency contact (API accepts only these values)</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {EMERGENCY_RELATION_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => {
                  onDataChange({ emergencyRelationship: opt.value });
                  if (apiErrors.passenger_emergency_contact_relation && onClearApiError) onClearApiError('passenger_emergency_contact_relation');
                }}
                style={[styles.chip, data.emergencyRelationship === opt.value && styles.chipActive]}
              >
                <Text style={[styles.chipText, data.emergencyRelationship === opt.value && styles.chipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {(validationErrors.emergencyRelationship || apiErrors.passenger_emergency_contact_relation) && (
            <View style={styles.errorContainer}>
              <Icon name="error" size={16} color={styles.errorText.color} />
              <Text style={styles.errorText}>{validationErrors.emergencyRelationship || apiErrors.passenger_emergency_contact_relation}</Text>
            </View>
          )}
        </View>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 20,
  },
  roleSection: {
    backgroundColor: '#ffffff',
    borderRadius: isSmallScreen ? 20 : 25,
    padding: isSmallScreen ? 20 : 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: isSmallScreen ? 18 : 20,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: isSmallScreen ? 14 : 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  roleButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  roleButtonActive: {
    backgroundColor: BrandColors.primary,
    borderColor: BrandColors.primary,
  },
  roleButtonInactive: {
    backgroundColor: '#ffffff',
  },
  roleImage: {
    width: 80,
    height: 80,
  },
  roleButtonText: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '700',
    marginTop: 10,
  },
  roleButtonTextActive: {
    color: '#ffffff',
  },
  roleButtonTextInactive: {
    color: BrandColors.primary,
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: isSmallScreen ? 20 : 25,
    padding: isSmallScreen ? 20 : 24,
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
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputHint: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  input: {
    marginBottom: 4,
  },
  textArea: {
    minHeight: 80,
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 50,
  },
  passwordToggle: {
    position: 'absolute',
    right: 12,
    top: 12,
    padding: 4,
  },
  passwordStrengthContainer: {
    marginTop: 8,
    gap: 4,
  },
  passwordStrengthBar: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    overflow: 'hidden',
  },
  passwordStrengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  passwordStrengthText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'right',
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
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  chipActive: {
    backgroundColor: BrandColors.primary,
    borderColor: BrandColors.primary,
  },
  chipText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#ffffff',
  },
});
