import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Alert, 
  SafeAreaView, 
  StatusBar, 
  ImageBackground, 
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { setUserRole } from '../../store/slices/authSlice';
import { RootState } from '../../store';
import BrandButton from '../../components/BrandButton';
import { BrandColors } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function RoleSelectionScreen() {
  const { theme } = useAppTheme();
  const navigation = useNavigation<any>();
  const dispatch = useDispatch<any>();
  const [selectedRole, setSelectedRole] = useState<'driver' | 'passenger' | null>(null);
  
  // Get current auth state for debugging
  const authState = useSelector((state: RootState) => state.auth);

  const handleRoleSelect = (role: 'driver' | 'passenger') => {
    setSelectedRole(role);
  };

  const handleContinue = () => {
    if (!selectedRole) {
      Alert.alert('Error', 'Please select a role to continue');
      return;
    }

    console.log('RoleSelectionScreen - Selected role:', selectedRole);
    console.log('RoleSelectionScreen - Current auth state:', authState);
    console.log('RoleSelectionScreen - Dispatching setUserRole...');

    // Set the user role in the auth state
    dispatch(setUserRole(selectedRole));

    console.log('RoleSelectionScreen - Role set, navigating to BasicInfo...');

    // Navigate to basic information screen with selected role
    navigation.navigate('BasicInfo', { role: selectedRole });
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={BrandColors.primary}
        translucent={false}
      />
      <ImageBackground
        source={require('../../assets/images/BackgroundRaaheHaq.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        
        {/* Fixed Header */}
        <View style={styles.fixedHeader}>
          {/* Decorative Circles */}
          <View style={styles.decorativeCircle1} />
          <View style={styles.decorativeCircle2} />
          <View style={styles.decorativeCircle3} />
          <View style={styles.decorativeCircle4} />
          <View style={styles.decorativeCircle5} />
          
          <View style={styles.logoContainer}>
            <View style={styles.logoWrapper}>
              <Image 
                source={require('../../assets/images/Logo.png')} 
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.title}>Choose Your Role</Text>
            <Text style={styles.subtitle}>
              Select how you want to use the app
            </Text>
          </View>
        </View>

        {/* Scrollable Content */}
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>

            {/* Role Selection Cards */}
            <View style={styles.roleContainer}>
              <TouchableOpacity
                style={[
                  styles.roleCard,
                  selectedRole === 'passenger' ? styles.roleCardSelected : styles.roleCardUnselected
                ]}
                onPress={() => handleRoleSelect('passenger')}
                activeOpacity={0.8}
              >
                <View style={styles.roleIconContainer}>
                  <Icon name="person" size={48} color={selectedRole === 'passenger' ? '#ffffff' : BrandColors.primary} />
                </View>
                <Text style={[
                  styles.roleTitle,
                  selectedRole === 'passenger' ? styles.roleTitleSelected : styles.roleTitleUnselected
                ]}>
                  Passenger
                </Text>
                <Text style={[
                  styles.roleDescription,
                  selectedRole === 'passenger' ? styles.roleDescriptionSelected : styles.roleDescriptionUnselected
                ]}>
                  Book rides and travel to your destination
                </Text>
                <View style={[
                  styles.roleFeatures,
                  selectedRole === 'passenger' ? styles.roleFeaturesSelected : styles.roleFeaturesUnselected
                ]}>
                  <View style={styles.featureItem}>
                    <Icon name="check" size={16} color={selectedRole === 'passenger' ? '#ffffff' : '#10b981'} />
                    <Text style={[
                      styles.featureText,
                      selectedRole === 'passenger' ? styles.featureTextSelected : styles.featureTextUnselected
                    ]}>
                      Easy booking
                    </Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Icon name="check" size={16} color={selectedRole === 'passenger' ? '#ffffff' : '#10b981'} />
                    <Text style={[
                      styles.featureText,
                      selectedRole === 'passenger' ? styles.featureTextSelected : styles.featureTextUnselected
                    ]}>
                      Real-time tracking
                    </Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Icon name="check" size={16} color={selectedRole === 'passenger' ? '#ffffff' : '#10b981'} />
                    <Text style={[
                      styles.featureText,
                      selectedRole === 'passenger' ? styles.featureTextSelected : styles.featureTextUnselected
                    ]}>
                      Safe payments
                    </Text>
                  </View>
                </View>
                {selectedRole === 'passenger' && (
                  <View style={styles.selectedBadge}>
                    <Icon name="check" size={20} color="#ffffff" />
                    <Text style={styles.selectedText}>Selected</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleCard,
                  selectedRole === 'driver' ? styles.roleCardSelected : styles.roleCardUnselected
                ]}
                onPress={() => handleRoleSelect('driver')}
                activeOpacity={0.8}
              >
                <View style={styles.roleIconContainer}>
                  <Icon name="local-taxi" size={48} color={selectedRole === 'driver' ? '#ffffff' : BrandColors.primary} />
                </View>
                <Text style={[
                  styles.roleTitle,
                  selectedRole === 'driver' ? styles.roleTitleSelected : styles.roleTitleUnselected
                ]}>
                  Driver
                </Text>
                <Text style={[
                  styles.roleDescription,
                  selectedRole === 'driver' ? styles.roleDescriptionSelected : styles.roleDescriptionUnselected
                ]}>
                  Provide rides and earn money
                </Text>
                <View style={[
                  styles.roleFeatures,
                  selectedRole === 'driver' ? styles.roleFeaturesSelected : styles.roleFeaturesUnselected
                ]}>
                  <View style={styles.featureItem}>
                    <Icon name="check" size={16} color={selectedRole === 'driver' ? '#ffffff' : '#10b981'} />
                    <Text style={[
                      styles.featureText,
                      selectedRole === 'driver' ? styles.featureTextSelected : styles.featureTextUnselected
                    ]}>
                      Flexible schedule
                    </Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Icon name="check" size={16} color={selectedRole === 'driver' ? '#ffffff' : '#10b981'} />
                    <Text style={[
                      styles.featureText,
                      selectedRole === 'driver' ? styles.featureTextSelected : styles.featureTextUnselected
                    ]}>
                      Good earnings
                    </Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Icon name="check" size={16} color={selectedRole === 'driver' ? '#ffffff' : '#10b981'} />
                    <Text style={[
                      styles.featureText,
                      selectedRole === 'driver' ? styles.featureTextSelected : styles.featureTextUnselected
                    ]}>
                      Easy navigation
                    </Text>
                  </View>
                </View>
                {selectedRole === 'driver' && (
                  <View style={styles.selectedBadge}>
                    <Icon name="check" size={20} color="#ffffff" />
                    <Text style={styles.selectedText}>Selected</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              <BrandButton
                title="Continue"
                onPress={handleContinue}
                variant="primary"
                disabled={!selectedRole}
                style={styles.continueButton}
              />

              <BrandButton
                title="Go Back"
                onPress={handleBack}
                variant="secondary"
                style={styles.backButton}
              />
            </View>
          </View>
        </ScrollView>
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
  fixedHeader: {
    backgroundColor: BrandColors.primary,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    position: 'relative',
    overflow: 'hidden',
    zIndex: 10,
  },
  scrollView: {
    flex: 1,
    marginTop: -20, // Overlap with header for seamless look
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  decorativeCircle1: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.15)',
    top: -30,
    right: -30,
  },
  decorativeCircle2: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    top: 20,
    left: -20,
  },
  decorativeCircle3: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
    bottom: 10,
    right: 50,
  },
  decorativeCircle4: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
    top: 60,
    right: 80,
  },
  decorativeCircle5: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.08)',
    bottom: -20,
    left: 30,
  },
  logoContainer: {
    alignItems: 'center',
    zIndex: 2,
  },
  logoWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logoImage: {
    width: 60,
    height: 60,
  },
  title: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  roleContainer: {
    gap: 20,
    marginBottom: 30,
  },
  roleCard: {
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  roleCardSelected: {
    backgroundColor: BrandColors.primary,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  roleCardUnselected: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  roleIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  roleTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  roleTitleSelected: {
    color: '#ffffff',
  },
  roleTitleUnselected: {
    color: '#1f2937',
  },
  roleDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  roleDescriptionSelected: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  roleDescriptionUnselected: {
    color: '#6b7280',
  },
  roleFeatures: {
    width: '100%',
    gap: 12,
  },
  roleFeaturesSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    borderRadius: 12,
  },
  roleFeaturesUnselected: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 14,
    fontWeight: '500',
  },
  featureTextSelected: {
    color: '#ffffff',
  },
  featureTextUnselected: {
    color: '#374151',
  },
  selectedBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  selectedText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  buttonContainer: {
    gap: 16,
  },
  continueButton: {
    marginBottom: 8,
  },
  backButton: {
    marginBottom: 8,
  },
});
