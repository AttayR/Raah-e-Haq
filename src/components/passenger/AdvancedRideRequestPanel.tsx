import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Dimensions,
  Modal,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../app/providers/ThemeProvider';
import { RideStopRequest } from '../../services/rideService';
import LocationSearch from './LocationSearch';
import VehicleSelector from './VehicleSelector';
import PassengerCountSelector from './PassengerCountSelector';
import StopManager from './StopManager';

const { width } = Dimensions.get('window');

interface AdvancedRideRequestPanelProps {
  visible: boolean;
  onClose: () => void;
  onRequestRide: (rideData: {
    pickup_address: string;
    dropoff_address: string;
    pickup_latitude: number;
    pickup_longitude: number;
    dropoff_latitude: number;
    dropoff_longitude: number;
    vehicle_type: string;
    passenger_count: number;
    special_instructions: string;
    stops: RideStopRequest[];
  }) => void;
  isLoading?: boolean;
}

const AdvancedRideRequestPanel: React.FC<AdvancedRideRequestPanelProps> = ({
  visible,
  onClose,
  onRequestRide,
  isLoading = false,
}) => {
  // Safe theme access with fallback
  let theme;
  try {
    const themeContext = useTheme();
    theme = themeContext?.theme || {
      colors: {
        primary: '#3B82F6',
        primaryDark: '#1E40AF',
        background: '#FFFFFF',
        surface: '#F8FAFC',
        text: '#1F2937',
        textSecondary: '#6B7280',
        border: '#E5E7EB',
        success: '#10B981',
        error: '#EF4444',
      }
    };
  } catch (error) {
    console.log('Theme error, using fallback:', error);
    theme = {
      colors: {
        primary: '#3B82F6',
        primaryDark: '#1E40AF',
        background: '#FFFFFF',
        surface: '#F8FAFC',
        text: '#1F2937',
        textSecondary: '#6B7280',
        border: '#E5E7EB',
        success: '#10B981',
        error: '#EF4444',
      }
    };
  }
  
  const styles = createStyles(theme);

  // Location states
  const [pickupLocation, setPickupLocation] = useState({
    address: '',
    latitude: 0,
    longitude: 0,
  });
  const [dropoffLocation, setDropoffLocation] = useState({
    address: '',
    latitude: 0,
    longitude: 0,
  });

  // Ride configuration states
  const [selectedVehicle, setSelectedVehicle] = useState('car');
  const [passengerCount, setPassengerCount] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [stops, setStops] = useState<RideStopRequest[]>([]);

  // UI states
  const [currentStep, setCurrentStep] = useState(1);
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [searchType, setSearchType] = useState<'pickup' | 'dropoff' | 'stop'>('pickup');

  const totalSteps = 4;

  const handleLocationSelect = (location: {
    address: string;
    latitude: number;
    longitude: number;
  }) => {
    if (searchType === 'pickup') {
      setPickupLocation(location);
    } else if (searchType === 'dropoff') {
      setDropoffLocation(location);
    }
    setShowLocationSearch(false);
  };

  const handleAddStop = () => {
    setSearchType('stop');
    setShowLocationSearch(true);
  };

  const handleStopSelect = (location: {
    address: string;
    latitude: number;
    longitude: number;
  }) => {
    const newStop: RideStopRequest = {
      address: location.address,
      latitude: location.latitude,
      longitude: location.longitude,
      stop_order: stops.length + 1,
    };
    setStops([...stops, newStop]);
    setShowLocationSearch(false);
  };

  const handleRemoveStop = (index: number) => {
    const updatedStops = stops.filter((_, i) => i !== index);
    // Reorder stop_order
    const reorderedStops = updatedStops.map((stop, i) => ({
      ...stop,
      stop_order: i + 1,
    }));
    setStops(reorderedStops);
  };

  const handleReorderStops = (fromIndex: number, toIndex: number) => {
    const updatedStops = [...stops];
    const [movedStop] = updatedStops.splice(fromIndex, 1);
    updatedStops.splice(toIndex, 0, movedStop);
    
    // Reorder stop_order
    const reorderedStops = updatedStops.map((stop, i) => ({
      ...stop,
      stop_order: i + 1,
    }));
    setStops(reorderedStops);
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return pickupLocation.address !== '' && dropoffLocation.address !== '';
      case 2:
        return selectedVehicle !== '';
      case 3:
        return passengerCount > 0;
      case 4:
        return true; // Special instructions and stops are optional
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < totalSteps) {
        setCurrentStep(currentStep + 1);
      }
    } else {
      Alert.alert('Validation Error', 'Please fill in all required fields');
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = () => {
    if (!validateStep(1)) {
      Alert.alert('Error', 'Please select pickup and dropoff locations');
      return;
    }

    const rideData = {
      pickup_address: pickupLocation.address,
      dropoff_address: dropoffLocation.address,
      pickup_latitude: pickupLocation.latitude,
      pickup_longitude: pickupLocation.longitude,
      dropoff_latitude: dropoffLocation.latitude,
      dropoff_longitude: dropoffLocation.longitude,
      vehicle_type: selectedVehicle,
      passenger_count: passengerCount,
      special_instructions: specialInstructions,
      stops: stops,
    };

    onRequestRide(rideData);
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {Array.from({ length: totalSteps }, (_, index) => (
        <View
          key={index}
          style={[
            styles.stepDot,
            {
              backgroundColor:
                index + 1 <= currentStep
                  ? theme.colors.primary
                  : theme.colors.border,
            },
          ]}
        />
      ))}
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Select Locations</Text>
      
      <TouchableOpacity
        style={styles.locationButton}
        onPress={() => {
          setSearchType('pickup');
          setShowLocationSearch(true);
        }}
      >
        <View style={styles.locationIcon}>
          <Icon name="place" size={20} color={theme.colors.primary} />
        </View>
        <View style={styles.locationContent}>
          <Text style={styles.locationLabel}>Pickup Location</Text>
          <Text style={styles.locationText}>
            {pickupLocation.address || 'Select pickup location'}
          </Text>
        </View>
        <Icon name="chevron-right" size={20} color={theme.colors.text} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.locationButton}
        onPress={() => {
          setSearchType('dropoff');
          setShowLocationSearch(true);
        }}
      >
        <View style={styles.locationIcon}>
          <Icon name="flag" size={20} color={theme.colors.success} />
        </View>
        <View style={styles.locationContent}>
          <Text style={styles.locationLabel}>Dropoff Location</Text>
          <Text style={styles.locationText}>
            {dropoffLocation.address || 'Select dropoff location'}
          </Text>
        </View>
        <Icon name="chevron-right" size={20} color={theme.colors.text} />
      </TouchableOpacity>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Choose Vehicle Type</Text>
      <VehicleSelector
        selectedVehicle={selectedVehicle}
        onVehicleSelect={setSelectedVehicle}
      />
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Passenger Count</Text>
      <PassengerCountSelector
        count={passengerCount}
        onCountChange={setPassengerCount}
      />
    </View>
  );

  const renderStep4 = () => (
    <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Additional Options</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Add Stops (Optional)</Text>
        <TouchableOpacity
          style={styles.addStopButton}
          onPress={handleAddStop}
        >
            <Icon name="add-circle-outline" size={20} color={theme.colors.primary} />
          <Text style={styles.addStopText}>Add Stop</Text>
        </TouchableOpacity>
        
        {stops.length > 0 && (
          <StopManager
            stops={stops}
            onRemoveStop={handleRemoveStop}
            onReorderStops={handleReorderStops}
          />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Special Instructions</Text>
        <TextInput
          style={styles.instructionsInput}
          placeholder="Any special instructions for the driver?"
          placeholderTextColor={theme.colors.textSecondary}
          value={specialInstructions}
          onChangeText={setSpecialInstructions}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>
    </ScrollView>
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
        return renderStep1();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.primaryDark || theme.colors.primary]}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Request Ride</Text>
            <View style={styles.placeholder} />
          </View>
          {renderStepIndicator()}
        </LinearGradient>

        <View style={styles.content}>
          {renderCurrentStep()}
        </View>

        <View style={styles.footer}>
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
                currentStep === totalSteps && styles.submitButton,
              ]}
              onPress={currentStep === totalSteps ? handleSubmit : handleNext}
              disabled={isLoading}
            >
              <Text style={styles.nextButtonText}>
                {isLoading
                  ? 'Requesting...'
                  : currentStep === totalSteps
                  ? 'Request Ride'
                  : 'Next'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {showLocationSearch && (
          <LocationSearch
            visible={showLocationSearch}
            onClose={() => setShowLocationSearch(false)}
            onLocationSelect={
              searchType === 'stop' ? handleStopSelect : handleLocationSelect
            }
            placeholder={
              searchType === 'pickup'
                ? 'Search pickup location'
                : searchType === 'dropoff'
                ? 'Search dropoff location'
                : 'Search stop location'
            }
          />
        )}
      </View>
    </Modal>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      paddingTop: 50,
      paddingBottom: 20,
      paddingHorizontal: 20,
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 20,
    },
    closeButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: 'white',
    },
    placeholder: {
      width: 40,
    },
    stepIndicator: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    stepDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      marginHorizontal: 4,
    },
    content: {
      flex: 1,
      padding: 20,
    },
    stepContainer: {
      flex: 1,
    },
    stepTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 20,
    },
    locationButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    locationIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    locationContent: {
      flex: 1,
    },
    locationLabel: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 4,
    },
    locationText: {
      fontSize: 16,
      color: theme.colors.text,
      fontWeight: '500',
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 12,
    },
    addStopButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderStyle: 'dashed',
    },
    addStopText: {
      fontSize: 16,
      color: theme.colors.primary,
      marginLeft: 8,
      fontWeight: '500',
    },
    instructionsInput: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: theme.colors.text,
      borderWidth: 1,
      borderColor: theme.colors.border,
      minHeight: 100,
    },
    footer: {
      padding: 20,
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    previousButton: {
      flex: 1,
      backgroundColor: 'transparent',
      borderRadius: 12,
      padding: 16,
      marginRight: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    previousButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      textAlign: 'center',
    },
    nextButton: {
      flex: 2,
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
      padding: 16,
    },
    submitButton: {
      backgroundColor: theme.colors.success,
    },
    nextButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: 'white',
      textAlign: 'center',
    },
  });

export default AdvancedRideRequestPanel;
