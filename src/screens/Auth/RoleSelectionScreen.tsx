import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { setUserRole } from '../../store/slices/authSlice';
import { RootState } from '../../store';
import BrandButton from '../../components/BrandButton';

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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>
        Choose Your Role
      </Text>

      <Text style={[styles.subtitle, { color: theme.colors.mutedText }]}>
        Select how you want to use the app
      </Text>

      <View style={styles.roleContainer}>
        <View style={styles.roleCard}>
          <Text style={[styles.roleTitle, { color: theme.colors.text }]}>
            Passenger
          </Text>
          <Text style={[styles.roleDescription, { color: theme.colors.mutedText }]}>
            Book rides and travel to your destination
          </Text>
          <BrandButton
            title={selectedRole === 'passenger' ? 'Selected ✓' : 'Select Passenger'}
            variant={selectedRole === 'passenger' ? 'primary' : 'secondary'}
            onPress={() => handleRoleSelect('passenger')}
            style={styles.roleButton}
          />
        </View>

        <View style={styles.roleCard}>
          <Text style={[styles.roleTitle, { color: theme.colors.text }]}>
            Driver
          </Text>
          <Text style={[styles.roleDescription, { color: theme.colors.mutedText }]}>
            Provide rides and earn money
          </Text>
          <BrandButton
            title={selectedRole === 'driver' ? 'Selected ✓' : 'Select Driver'}
            variant={selectedRole === 'driver' ? 'success' : 'secondary'}
            onPress={() => handleRoleSelect('driver')}
            style={styles.roleButton}
          />
        </View>
      </View>

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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 60,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
  },
  roleContainer: {
    gap: 24,
    marginBottom: 40,
  },
  roleCard: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    gap: 12,
  },
  roleTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  roleDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  roleButton: {
    minWidth: 150,
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
