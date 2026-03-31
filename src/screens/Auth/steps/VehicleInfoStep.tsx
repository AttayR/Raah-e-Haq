import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  Dimensions,
  ScrollView,
} from 'react-native';
import { BrandColors } from '../../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ThemedTextInput from '../../../components/ThemedTextInput';

const { width: screenWidth } = Dimensions.get('window');
const isSmallScreen = screenWidth < 375;

interface VehicleInfoData {
  vehicleType: string;
  vehicleNumber: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: string;
  vehicleColor: string;
  licenseType: string;
  licenseExpiryDate: string;
  licensePlate: string;
  registrationNumber: string;
  drivingExperience: string;
  bankName: string;
  bankBranch: string;
  bankAccountNumber: string;
  role: 'driver' | 'passenger';
}

interface VehicleInfoStepProps {
  data: VehicleInfoData;
  onDataChange: (data: Partial<VehicleInfoData>) => void;
  errors: Record<string, string>;
  apiErrors?: Record<string, string>;
  onClearApiError?: (field: string) => void;
}

const LICENSE_TYPES = [
  { value: 'LTV', label: 'LTV (Light Transport Vehicle)' },
  { value: 'HTV', label: 'HTV (Heavy Transport Vehicle)' },
  { value: 'Motorcycle', label: 'Motorcycle' },
  { value: 'PSV', label: 'PSV (Public Service Vehicle)' },
  { value: 'other', label: 'Other' },
];

const DRIVING_EXPERIENCE_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '15', '20', '25', '30'];

const vehicleTypes = [
  { id: 'bike', label: 'Bike', icon: 'motorcycle', description: 'Motorcycle, Scooter' },
  { id: 'rickshaw', label: 'Rickshaw', icon: 'local-taxi', description: 'Auto Rickshaw' },
  { id: 'car', label: 'Car', icon: 'directions-car', description: 'Sedan, Hatchback, SUV' },
];

const vehicleBrands = [
  'Toyota', 'Honda', 'Suzuki', 'Nissan', 'Mitsubishi', 'Hyundai', 'Kia',
  'Ford', 'Chevrolet', 'BMW', 'Mercedes-Benz', 'Audi', 'Volkswagen',
  'Mazda', 'Subaru', 'Lexus', 'Infiniti', 'Acura', 'Other'
];

const vehicleColors = [
  'White', 'Black', 'Silver', 'Gray', 'Red', 'Blue', 'Green', 'Yellow',
  'Orange', 'Brown', 'Gold', 'Purple', 'Pink', 'Other'
];

// API allows vehicle year up to 2025 (must not be greater than 2025)
const MAX_VEHICLE_YEAR = 2025;
const vehicleYears = Array.from({ length: 20 }, (_, i) => (MAX_VEHICLE_YEAR - i).toString());

export default function VehicleInfoStep({ data, onDataChange, errors, apiErrors = {}, onClearApiError }: VehicleInfoStepProps) {
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);
  const [showColorDropdown, setShowColorDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showLicenseTypeDropdown, setShowLicenseTypeDropdown] = useState(false);
  const [showExperienceDropdown, setShowExperienceDropdown] = useState(false);

  // Safety check for undefined data
  if (!data) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Loading...</Text>
      </View>
    );
  }

  // Validation functions
  const validateVehicleType = (type: string): string | undefined => {
    if (!type || !type.trim()) return 'Vehicle type is required';
    return undefined;
  };

  const validateVehicleNumber = (number: string): string | undefined => {
    if (!number || !number.trim()) return 'Vehicle number is required';
    const numberRegex = /^[A-Z]{2,3}\s?\d{4}\s?[A-Z]{1,2}$/;
    if (!numberRegex.test(number.trim().toUpperCase())) {
      return 'Please enter a valid vehicle number (e.g., ABC-1234 or ABC-1234-D)';
    }
    return undefined;
  };

  const validateVehicleBrand = (brand: string): string | undefined => {
    if (!brand || !brand.trim()) return 'Vehicle brand is required';
    return undefined;
  };

  const validateVehicleModel = (model: string): string | undefined => {
    if (!model || !model.trim()) return 'Vehicle model is required';
    return undefined;
  };

  const validateVehicleYear = (year: string): string | undefined => {
    if (!year || !year.trim()) return 'Vehicle year is required';
    const yearNum = parseInt(year, 10);
    if (isNaN(yearNum) || yearNum < 2000 || yearNum > MAX_VEHICLE_YEAR) {
      return `Please enter a valid year between 2000 and ${MAX_VEHICLE_YEAR}`;
    }
    return undefined;
  };

  const validateVehicleColor = (color: string): string | undefined => {
    if (!color || !color.trim()) return 'Vehicle color is required';
    return undefined;
  };

  const formatVehicleNumber = (value: string): string => {
    if (!value) return '';
    // Remove all non-alphanumeric characters
    const cleaned = value.replace(/[^A-Za-z0-9]/g, '');
    
    // Format as ABC-1234 or ABC-1234-D
    if (cleaned.length <= 3) {
      return cleaned.toUpperCase();
    } else if (cleaned.length <= 7) {
      return `${cleaned.slice(0, 3).toUpperCase()}-${cleaned.slice(3)}`;
    } else {
      return `${cleaned.slice(0, 3).toUpperCase()}-${cleaned.slice(3, 7)}-${cleaned.slice(7, 8).toUpperCase()}`;
    }
  };

  const handleInputChange = (field: keyof VehicleInfoData, value: string) => {
    let processedValue = value || '';
    
    if (field === 'vehicleNumber') {
      processedValue = formatVehicleNumber(value);
    }
    
    onDataChange({ [field]: processedValue });
    
    // Clear validation error when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateField = (field: keyof VehicleInfoData, value: string) => {
    let error: string | undefined;
    const safeValue = value || '';
    
    switch (field) {
      case 'vehicleType':
        error = validateVehicleType(safeValue);
        break;
      case 'vehicleNumber':
        error = validateVehicleNumber(safeValue);
        break;
      case 'vehicleBrand':
        error = validateVehicleBrand(safeValue);
        break;
      case 'vehicleModel':
        error = validateVehicleModel(safeValue);
        break;
      case 'vehicleYear':
        error = validateVehicleYear(safeValue);
        break;
      case 'vehicleColor':
        error = validateVehicleColor(safeValue);
        break;
      case 'licenseType':
        error = !safeValue ? 'License type is required' : undefined;
        break;
      case 'licenseExpiryDate':
        error = !safeValue ? 'License expiry date is required' : undefined;
        break;
      case 'licensePlate':
        error = !safeValue ? 'License plate is required' : undefined;
        break;
      case 'registrationNumber':
        error = !safeValue ? 'Registration number is required' : undefined;
        break;
      case 'drivingExperience':
        error = !safeValue ? 'Driving experience is required' : undefined;
        break;
      case 'bankName':
        error = !safeValue ? 'Bank name is required' : undefined;
        break;
      case 'bankBranch':
        error = !safeValue ? 'Bank branch is required' : undefined;
        break;
      case 'bankAccountNumber':
        error = !safeValue ? 'Bank account number is required' : undefined;
        break;
    }
    
    if (error) {
      setValidationErrors(prev => ({ ...prev, [field]: error! }));
    } else {
      setValidationErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleVehicleTypeSelect = (type: string) => {
    onDataChange({ vehicleType: type });
    setValidationErrors(prev => ({ ...prev, vehicleType: '' }));
  };

  const handleBrandSelect = (brand: string) => {
    onDataChange({ vehicleBrand: brand });
    setShowBrandDropdown(false);
    setValidationErrors(prev => ({ ...prev, vehicleBrand: '' }));
  };

  const handleColorSelect = (color: string) => {
    onDataChange({ vehicleColor: color });
    setShowColorDropdown(false);
    setValidationErrors(prev => ({ ...prev, vehicleColor: '' }));
  };

  const handleYearSelect = (year: string) => {
    onDataChange({ vehicleYear: year });
    setShowYearDropdown(false);
    setValidationErrors(prev => ({ ...prev, vehicleYear: '' }));
  };

  if (data.role === 'passenger') {
    return (
      <View style={styles.container}>
        <View style={styles.skipCard}>
          <Icon name="check-circle" size={48} color="#10b981" />
          <Text style={styles.skipTitle}>Vehicle Information Skipped</Text>
          <Text style={styles.skipSubtitle}>
            As a passenger, you don't need to provide vehicle information. 
            You can book rides from available drivers.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Vehicle Information</Text>
        <Text style={styles.formSubtitle}>
          Please provide details about your vehicle
        </Text>

        {/* Vehicle Type Selection */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Vehicle Type *</Text>
          <View style={styles.vehicleTypeGrid}>
            {vehicleTypes.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.vehicleTypeCard,
                  data.vehicleType === type.id && styles.vehicleTypeCardActive
                ]}
                onPress={() => handleVehicleTypeSelect(type.id)}
                activeOpacity={0.8}
              >
                <Icon 
                  name={type.icon} 
                  size={24} 
                  color={data.vehicleType === type.id ? '#ffffff' : BrandColors.primary} 
                />
                <Text style={[
                  styles.vehicleTypeLabel,
                  data.vehicleType === type.id && styles.vehicleTypeLabelActive
                ]}>
                  {type.label}
                </Text>
                <Text style={[
                  styles.vehicleTypeDescription,
                  data.vehicleType === type.id && styles.vehicleTypeDescriptionActive
                ]}>
                  {type.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {(validationErrors.vehicleType || apiErrors.vehicle_type) && (
            <View style={styles.errorContainer}>
              <Icon name="error" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{validationErrors.vehicleType || apiErrors.vehicle_type}</Text>
            </View>
          )}
        </View>

        {/* Vehicle Number */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Vehicle Registration Number *</Text>
          <ThemedTextInput
            placeholder="ABC-1234 or ABC-1234-D"
            value={data.vehicleNumber || ''}
            onChangeText={(value) => handleInputChange('vehicleNumber', value)}
            onBlur={() => validateField('vehicleNumber', data.vehicleNumber || '')}
            autoCapitalize="characters"
            style={styles.input}
          />
          {(validationErrors.vehicleNumber) && (
            <View style={styles.errorContainer}>
              <Icon name="error" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{validationErrors.vehicleNumber}</Text>
            </View>
          )}
        </View>

        {/* Vehicle Brand */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Vehicle Brand *</Text>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setShowBrandDropdown(!showBrandDropdown)}
          >
            <Text style={[styles.dropdownText, !data.vehicleBrand && styles.dropdownPlaceholder]}>
              {data.vehicleBrand || 'Select vehicle brand'}
            </Text>
            <Icon 
              name={showBrandDropdown ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} 
              size={20} 
              color="#6b7280" 
            />
          </TouchableOpacity>
          {showBrandDropdown && (
            <View style={styles.dropdownList}>
              <ScrollView style={styles.dropdownScroll} showsVerticalScrollIndicator={false}>
                {vehicleBrands.map((brand) => (
                  <TouchableOpacity
                    key={brand}
                    style={styles.dropdownItem}
                    onPress={() => handleBrandSelect(brand)}
                  >
                    <Text style={styles.dropdownItemText}>{brand}</Text>
                    {data.vehicleBrand === brand && (
                      <Icon name="check" size={20} color={BrandColors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          {(validationErrors.vehicleBrand || apiErrors.vehicle_make) && (
            <View style={styles.errorContainer}>
              <Icon name="error" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{validationErrors.vehicleBrand || apiErrors.vehicle_make}</Text>
            </View>
          )}
        </View>

        {/* Vehicle Model */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Vehicle Model *</Text>
          <ThemedTextInput
            placeholder="Enter vehicle model"
            value={data.vehicleModel || ''}
            onChangeText={(value) => handleInputChange('vehicleModel', value)}
            onBlur={() => validateField('vehicleModel', data.vehicleModel || '')}
            style={styles.input}
          />
          {(validationErrors.vehicleModel || apiErrors.vehicle_model) && (
            <View style={styles.errorContainer}>
              <Icon name="error" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{validationErrors.vehicleModel || apiErrors.vehicle_model}</Text>
            </View>
          )}
        </View>

        {/* Vehicle Year and Color Row */}
        <View style={styles.rowContainer}>
          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={styles.inputLabel}>Year *</Text>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => setShowYearDropdown(!showYearDropdown)}
            >
              <Text style={[styles.dropdownText, !data.vehicleYear && styles.dropdownPlaceholder]}>
                {data.vehicleYear || 'Year'}
              </Text>
              <Icon 
                name={showYearDropdown ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} 
                size={20} 
                color="#6b7280" 
              />
            </TouchableOpacity>
            {showYearDropdown && (
              <View style={styles.dropdownList}>
                <ScrollView style={styles.dropdownScroll} showsVerticalScrollIndicator={false}>
                  {vehicleYears.map((year) => (
                    <TouchableOpacity
                      key={year}
                      style={styles.dropdownItem}
                      onPress={() => handleYearSelect(year)}
                    >
                      <Text style={styles.dropdownItemText}>{year}</Text>
                      {data.vehicleYear === year && (
                        <Icon name="check" size={20} color={BrandColors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            {(validationErrors.vehicleYear || apiErrors.vehicle_year) && (
              <View style={styles.errorContainer}>
                <Icon name="error" size={16} color="#ef4444" />
                <Text style={styles.errorText}>{validationErrors.vehicleYear || apiErrors.vehicle_year}</Text>
              </View>
            )}
          </View>

          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={styles.inputLabel}>Color *</Text>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => setShowColorDropdown(!showColorDropdown)}
            >
              <Text style={[styles.dropdownText, !data.vehicleColor && styles.dropdownPlaceholder]}>
                {data.vehicleColor || 'Color'}
              </Text>
              <Icon 
                name={showColorDropdown ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} 
                size={20} 
                color="#6b7280" 
              />
            </TouchableOpacity>
            {showColorDropdown && (
              <View style={styles.dropdownList}>
                <ScrollView style={styles.dropdownScroll} showsVerticalScrollIndicator={false}>
                  {vehicleColors.map((color) => (
                    <TouchableOpacity
                      key={color}
                      style={styles.dropdownItem}
                      onPress={() => handleColorSelect(color)}
                    >
                      <View style={[styles.colorIndicator, { backgroundColor: color.toLowerCase() }]} />
                      <Text style={styles.dropdownItemText}>{color}</Text>
                      {data.vehicleColor === color && (
                        <Icon name="check" size={20} color={BrandColors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            {(validationErrors.vehicleColor || apiErrors.vehicle_color) && (
              <View style={styles.errorContainer}>
                <Icon name="error" size={16} color="#ef4444" />
                <Text style={styles.errorText}>{validationErrors.vehicleColor || apiErrors.vehicle_color}</Text>
              </View>
            )}
          </View>
        </View>

        {/* License plate & Registration number */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>License Plate *</Text>
          <ThemedTextInput
            placeholder="e.g. ABC-1234-D"
            value={data.licensePlate || ''}
            onChangeText={(v) => { onDataChange({ licensePlate: v }); onClearApiError?.('license_plate'); }}
            style={styles.input}
          />
          {(validationErrors.licensePlate || apiErrors.license_plate) && (
            <View style={styles.errorContainer}>
              <Icon name="error" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{validationErrors.licensePlate || apiErrors.license_plate}</Text>
            </View>
          )}
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Vehicle Registration Number *</Text>
          <ThemedTextInput
            placeholder="Official registration number"
            value={data.registrationNumber || ''}
            onChangeText={(v) => { onDataChange({ registrationNumber: v }); onClearApiError?.('registration_number'); }}
            style={styles.input}
          />
          {(validationErrors.registrationNumber || apiErrors.registration_number) && (
            <View style={styles.errorContainer}>
              <Icon name="error" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{validationErrors.registrationNumber || apiErrors.registration_number}</Text>
            </View>
          )}
        </View>

        {/* License type & expiry & experience */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>License Type *</Text>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setShowLicenseTypeDropdown(!showLicenseTypeDropdown)}
          >
            <Text style={[styles.dropdownText, !data.licenseType && styles.dropdownPlaceholder]}>
              {LICENSE_TYPES.find((t) => t.value === data.licenseType)?.label || 'Select license type'}
            </Text>
            <Icon name={showLicenseTypeDropdown ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={20} color="#6b7280" />
          </TouchableOpacity>
          {showLicenseTypeDropdown && (
            <View style={styles.dropdownList}>
              <ScrollView style={styles.dropdownScroll} showsVerticalScrollIndicator={false}>
                {LICENSE_TYPES.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={styles.dropdownItem}
                    onPress={() => {
                      onDataChange({ licenseType: opt.value });
                      setShowLicenseTypeDropdown(false);
                      onClearApiError?.('license_type');
                    }}
                  >
                    <Text style={styles.dropdownItemText}>{opt.label}</Text>
                    {data.licenseType === opt.value && <Icon name="check" size={20} color={BrandColors.primary} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          {(validationErrors.licenseType || apiErrors.license_type) && (
            <View style={styles.errorContainer}>
              <Icon name="error" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{validationErrors.licenseType || apiErrors.license_type}</Text>
            </View>
          )}
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>License Expiry Date *</Text>
          <ThemedTextInput
            placeholder="YYYY-MM-DD"
            value={data.licenseExpiryDate || ''}
            onChangeText={(v) => { onDataChange({ licenseExpiryDate: v }); onClearApiError?.('license_expiry_date'); }}
            style={styles.input}
          />
          {(validationErrors.licenseExpiryDate || apiErrors.license_expiry_date) && (
            <View style={styles.errorContainer}>
              <Icon name="error" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{validationErrors.licenseExpiryDate || apiErrors.license_expiry_date}</Text>
            </View>
          )}
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Driving Experience (years) *</Text>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setShowExperienceDropdown(!showExperienceDropdown)}
          >
            <Text style={[styles.dropdownText, !data.drivingExperience && styles.dropdownPlaceholder]}>
              {data.drivingExperience ? `${data.drivingExperience} years` : 'Select years'}
            </Text>
            <Icon name={showExperienceDropdown ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={20} color="#6b7280" />
          </TouchableOpacity>
          {showExperienceDropdown && (
            <View style={styles.dropdownList}>
              <ScrollView style={styles.dropdownScroll} showsVerticalScrollIndicator={false}>
                {DRIVING_EXPERIENCE_OPTIONS.map((y) => (
                  <TouchableOpacity
                    key={y}
                    style={styles.dropdownItem}
                    onPress={() => {
                      onDataChange({ drivingExperience: y });
                      setShowExperienceDropdown(false);
                      onClearApiError?.('driving_experience');
                    }}
                  >
                    <Text style={styles.dropdownItemText}>{y} years</Text>
                    {data.drivingExperience === y && <Icon name="check" size={20} color={BrandColors.primary} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          {(validationErrors.drivingExperience || apiErrors.driving_experience) && (
            <View style={styles.errorContainer}>
              <Icon name="error" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{validationErrors.drivingExperience || apiErrors.driving_experience}</Text>
            </View>
          )}
        </View>

        {/* Bank details */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Bank Details</Text>
          <Text style={styles.formSubtitle}>Required for driver payouts</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Bank Name *</Text>
            <ThemedTextInput
              placeholder="e.g. HBL, UBL, MCB"
              value={data.bankName || ''}
              onChangeText={(v) => { onDataChange({ bankName: v }); onClearApiError?.('bank_name'); }}
              style={styles.input}
            />
            {(validationErrors.bankName || apiErrors.bank_name) && (
              <View style={styles.errorContainer}>
                <Icon name="error" size={16} color="#ef4444" />
                <Text style={styles.errorText}>{validationErrors.bankName || apiErrors.bank_name}</Text>
              </View>
            )}
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Bank Branch *</Text>
            <ThemedTextInput
              placeholder="Branch name or address"
              value={data.bankBranch || ''}
              onChangeText={(v) => { onDataChange({ bankBranch: v }); onClearApiError?.('bank_branch'); }}
              style={styles.input}
            />
            {(validationErrors.bankBranch || apiErrors.bank_branch) && (
              <View style={styles.errorContainer}>
                <Icon name="error" size={16} color="#ef4444" />
                <Text style={styles.errorText}>{validationErrors.bankBranch || apiErrors.bank_branch}</Text>
              </View>
            )}
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Bank Account Number *</Text>
            <ThemedTextInput
              placeholder="IBAN or account number"
              value={data.bankAccountNumber || ''}
              onChangeText={(v) => { onDataChange({ bankAccountNumber: v }); onClearApiError?.('bank_account_number'); }}
              keyboardType="number-pad"
              style={styles.input}
            />
            {(validationErrors.bankAccountNumber || apiErrors.bank_account_number) && (
              <View style={styles.errorContainer}>
                <Icon name="error" size={16} color="#ef4444" />
                <Text style={styles.errorText}>{validationErrors.bankAccountNumber || apiErrors.bank_account_number}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 20,
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
  vehicleTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  vehicleTypeCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  vehicleTypeCardActive: {
    backgroundColor: BrandColors.primary,
    borderColor: BrandColors.primary,
  },
  vehicleTypeLabel: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
    color: BrandColors.primary,
  },
  vehicleTypeLabelActive: {
    color: '#ffffff',
  },
  vehicleTypeDescription: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  vehicleTypeDescriptionActive: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  rowContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  dropdownText: {
    fontSize: isSmallScreen ? 14 : 16,
    color: '#374151',
    flex: 1,
  },
  dropdownPlaceholder: {
    color: '#9ca3af',
  },
  dropdownList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  dropdownItemText: {
    fontSize: isSmallScreen ? 14 : 16,
    color: '#374151',
    flex: 1,
  },
  colorIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
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
