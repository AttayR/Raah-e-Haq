import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  Dimensions,
  Alert,
} from 'react-native';
import { BrandColors } from '../../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ThemedTextInput from '../../../components/ThemedTextInput';
import BrandButton from '../../../components/BrandButton';

const { width: screenWidth } = Dimensions.get('window');
const isSmallScreen = screenWidth < 375;

interface PersonalInfoData {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  cnic: string;
  address: string;
  phoneNumber: string;
  role: 'driver' | 'passenger';
}

interface PersonalInfoStepProps {
  data: PersonalInfoData;
  onDataChange: (data: Partial<PersonalInfoData>) => void;
  errors: Record<string, string>;
}

export default function PersonalInfoStep({ data, onDataChange, errors }: PersonalInfoStepProps) {
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
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

  // Validation functions
  const validateFullName = (name: string): string | undefined => {
    if (!name || !name.trim()) return 'Full name is required';
    if (name.trim().length < 2) return 'Full name must be at least 2 characters';
    if (name.trim().length > 50) return 'Full name must be less than 50 characters';
    if (!/^[a-zA-Z\s]+$/.test(name.trim())) return 'Full name can only contain letters and spaces';
    return undefined;
  };

  const validateEmail = (email: string): string | undefined => {
    if (!email || !email.trim()) return 'Email is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) return 'Please enter a valid email address';
    return undefined;
  };

  const validatePassword = (password: string): string | undefined => {
    if (!password || !password.trim()) return 'Password is required';
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (!/(?=.*[a-z])/.test(password)) return 'Password must contain at least one lowercase letter';
    if (!/(?=.*[A-Z])/.test(password)) return 'Password must contain at least one uppercase letter';
    if (!/(?=.*\d)/.test(password)) return 'Password must contain at least one number';
    return undefined;
  };

  const validateConfirmPassword = (confirmPassword: string, password: string): string | undefined => {
    if (!confirmPassword || !confirmPassword.trim()) return 'Please confirm your password';
    if (confirmPassword !== password) return 'Passwords do not match';
    return undefined;
  };

  const validateCNIC = (cnic: string): string | undefined => {
    if (!cnic || !cnic.trim()) return 'CNIC is required';
    const cnicRegex = /^\d{5}-\d{7}-\d$/;
    if (!cnicRegex.test(cnic.trim())) return 'Please enter CNIC in format: 00000-0000000-0';
    return undefined;
  };

  const validateAddress = (address: string): string | undefined => {
    if (!address || !address.trim()) return 'Address is required';
    if (address.trim().length < 10) return 'Address must be at least 10 characters';
    if (address.trim().length > 200) return 'Address must be less than 200 characters';
    return undefined;
  };

  const validatePhoneNumber = (phone: string): string | undefined => {
    if (!phone || !phone.trim()) return 'Phone number is required';
    const phoneRegex = /^(\+92|0)?[0-9]{10}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
      return 'Please enter a valid Pakistani phone number';
    }
    return undefined;
  };

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
    
    onDataChange({ [field]: processedValue });
    
    // Clear validation error when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateField = (field: keyof PersonalInfoData, value: string) => {
    let error: string | undefined;
    const safeValue = value || '';
    
    switch (field) {
      case 'fullName':
        error = validateFullName(safeValue);
        break;
      case 'email':
        error = validateEmail(safeValue);
        break;
      case 'password':
        error = validatePassword(safeValue);
        break;
      case 'confirmPassword':
        error = validateConfirmPassword(safeValue, data.password || '');
        break;
      case 'cnic':
        error = validateCNIC(safeValue);
        break;
      case 'address':
        error = validateAddress(safeValue);
        break;
      case 'phoneNumber':
        error = validatePhoneNumber(safeValue);
        break;
    }
    
    if (error) {
      setValidationErrors(prev => ({ ...prev, [field]: error! }));
    } else {
      setValidationErrors(prev => ({ ...prev, [field]: '' }));
    }
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
            <Icon 
              name="person" 
              size={24} 
              color={data.role === 'passenger' ? '#ffffff' : BrandColors.primary} 
            />
            <Text style={[
              styles.roleButtonText,
              data.role === 'passenger' ? styles.roleButtonTextActive : styles.roleButtonTextInactive
            ]}>
              Passenger
            </Text>
            <Text style={[
              styles.roleButtonSubtext,
              data.role === 'passenger' ? styles.roleButtonSubtextActive : styles.roleButtonSubtextInactive
            ]}>
              Book rides
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
            <Icon 
              name="local-taxi" 
              size={24} 
              color={data.role === 'driver' ? '#ffffff' : BrandColors.primary} 
            />
            <Text style={[
              styles.roleButtonText,
              data.role === 'driver' ? styles.roleButtonTextActive : styles.roleButtonTextInactive
            ]}>
              Driver
            </Text>
            <Text style={[
              styles.roleButtonSubtext,
              data.role === 'driver' ? styles.roleButtonSubtextActive : styles.roleButtonSubtextInactive
            ]}>
              Provide rides
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
            onBlur={() => validateField('fullName', data.fullName || '')}
            autoCapitalize="words"
            style={styles.input}
          />
          {validationErrors.fullName && (
            <View style={styles.errorContainer}>
              <Icon name="error" size={16} color="#ef4444" />
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
            onBlur={() => validateField('email', data.email || '')}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />
          {validationErrors.email && (
            <View style={styles.errorContainer}>
              <Icon name="error" size={16} color="#ef4444" />
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
            onBlur={() => validateField('phoneNumber', data.phoneNumber || '')}
            keyboardType="phone-pad"
            style={styles.input}
          />
          {validationErrors.phoneNumber && (
            <View style={styles.errorContainer}>
              <Icon name="error" size={16} color="#ef4444" />
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
            onBlur={() => validateField('cnic', data.cnic || '')}
            keyboardType="numeric"
            maxLength={15}
            style={styles.input}
          />
          {validationErrors.cnic && (
            <View style={styles.errorContainer}>
              <Icon name="error" size={16} color="#ef4444" />
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
            onBlur={() => validateField('address', data.address || '')}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={[styles.input, styles.textArea]}
          />
          {validationErrors.address && (
            <View style={styles.errorContainer}>
              <Icon name="error" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{validationErrors.address}</Text>
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
              onBlur={() => validateField('password', data.password || '')}
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
          {data.password && data.password.length > 0 && (
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
          
          {validationErrors.password && (
            <View style={styles.errorContainer}>
              <Icon name="error" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{validationErrors.password}</Text>
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
              onBlur={() => validateField('confirmPassword', data.confirmPassword || '')}
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
              <Icon name="error" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{validationErrors.confirmPassword}</Text>
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
    padding: 20,
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
  roleButtonText: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  roleButtonTextActive: {
    color: '#ffffff',
  },
  roleButtonTextInactive: {
    color: BrandColors.primary,
  },
  roleButtonSubtext: {
    fontSize: 12,
    fontWeight: '500',
  },
  roleButtonSubtextActive: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  roleButtonSubtextInactive: {
    color: '#6b7280',
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
});
