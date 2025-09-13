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
  role: 'driver' | 'passenger';
}

interface VehicleInfoStepProps {
  data: VehicleInfoData;
  onDataChange: (data: Partial<VehicleInfoData>) => void;
  errors: Record<string, string>;
}

const vehicleTypes = [
  { 
    id: 'car', 
    label: 'Car', 
    icon: 'directions-car',
    description: 'Sedan, Hatchback, SUV'
  },
  { 
    id: 'bike', 
    label: 'Bike', 
    icon: 'motorcycle',
    description: 'Motorcycle, Scooter'
  },
  { 
    id: 'van', 
    label: 'Van', 
    icon: 'local-shipping',
    description: 'Minivan, Cargo Van'
  },
  { 
    id: 'truck', 
    label: 'Truck', 
    icon: 'local-shipping',
    description: 'Pickup, Delivery Truck'
  },
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

const currentYear = new Date().getFullYear();
const vehicleYears = Array.from({ length: 20 }, (_, i) => (currentYear - i).toString());

export default function VehicleInfoStep({ data, onDataChange, errors }: VehicleInfoStepProps) {
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);
  const [showColorDropdown, setShowColorDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);

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
    const yearNum = parseInt(year);
    if (isNaN(yearNum) || yearNum < 2000 || yearNum > currentYear) {
      return `Please enter a valid year between 2000 and ${currentYear}`;
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
          {validationErrors.vehicleType && (
            <View style={styles.errorContainer}>
              <Icon name="error" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{validationErrors.vehicleType}</Text>
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
          {validationErrors.vehicleNumber && (
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
          {validationErrors.vehicleBrand && (
            <View style={styles.errorContainer}>
              <Icon name="error" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{validationErrors.vehicleBrand}</Text>
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
          {validationErrors.vehicleModel && (
            <View style={styles.errorContainer}>
              <Icon name="error" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{validationErrors.vehicleModel}</Text>
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
            {validationErrors.vehicleYear && (
              <View style={styles.errorContainer}>
                <Icon name="error" size={16} color="#ef4444" />
                <Text style={styles.errorText}>{validationErrors.vehicleYear}</Text>
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
            {validationErrors.vehicleColor && (
              <View style={styles.errorContainer}>
                <Icon name="error" size={16} color="#ef4444" />
                <Text style={styles.errorText}>{validationErrors.vehicleColor}</Text>
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
