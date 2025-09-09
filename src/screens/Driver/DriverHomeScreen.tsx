/* eslint-disable react-native/no-inline-styles */
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import BrandButton from '../../components/BrandButton';
import { signOutThunk } from '../../store/thunks/authThunks';
import { RootState } from '../../store';

const DriverHomeScreen = () => {
  const { theme } = useAppTheme();
  const dispatch = useDispatch<any>();
  
  // Get user data from Redux store
  const { userProfile, phoneNumber, role } = useSelector((state: RootState) => state.auth);

  return (
    <ScrollView 
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: 16 }}
    >
      {/* Header */}
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <Text style={{ color: theme.colors.text, fontSize: 28, fontWeight: '700', marginBottom: 8 }}>
          Driver Dashboard
        </Text>
        <Text style={{ color: theme.colors.mutedText, fontSize: 16, textAlign: 'center' }}>
          Ready to provide rides and earn money?
        </Text>
      </View>

      {/* User Profile Card */}
      <View style={{
        backgroundColor: theme.colors.surface,
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}>
        <Text style={{ color: theme.colors.text, fontSize: 20, fontWeight: '600', marginBottom: 16 }}>
          👤 Your Profile
        </Text>
        
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.colors.mutedText, fontSize: 16 }}>Full Name:</Text>
            <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '500' }}>
              {userProfile?.fullName || 'Not set'}
            </Text>
          </View>
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.colors.mutedText, fontSize: 16 }}>Phone Number:</Text>
            <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '500' }}>
              {phoneNumber || 'Not set'}
            </Text>
          </View>
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.colors.mutedText, fontSize: 16 }}>Email:</Text>
            <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '500' }}>
              {userProfile?.email || 'Not set'}
            </Text>
          </View>
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.colors.mutedText, fontSize: 16 }}>Role:</Text>
            <Text style={{ 
              color: theme.colors.primary, 
              fontSize: 16, 
              fontWeight: '600',
              textTransform: 'capitalize'
            }}>
              {role || 'Not set'}
            </Text>
          </View>
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.colors.mutedText, fontSize: 16 }}>Status:</Text>
            <Text style={{ 
              color: userProfile?.isVerified ? theme.colors.success : theme.colors.warning, 
              fontSize: 16, 
              fontWeight: '600'
            }}>
              {userProfile?.isVerified ? 'Verified' : 'Pending Verification'}
            </Text>
          </View>
        </View>
      </View>

      {/* Driver Actions */}
      <View style={{ gap: 16, marginBottom: 24 }}>
        <Text style={{ color: theme.colors.text, fontSize: 20, fontWeight: '600', marginBottom: 8 }}>
          🚗 Driver Actions
        </Text>
        
        <BrandButton 
          title="Go Online" 
          variant="success"
          style={{ marginBottom: 8 }}
        />
        
        <BrandButton 
          title="View Earnings" 
          variant="secondary"
          style={{ marginBottom: 8 }}
        />
        
        <BrandButton 
          title="Ride History" 
          variant="secondary"
          style={{ marginBottom: 8 }}
        />
        
        <BrandButton 
          title="Edit Profile" 
          variant="secondary"
          style={{ marginBottom: 8 }}
        />
      </View>

      {/* Account Actions */}
      <View style={{ gap: 16 }}>
        <Text style={{ color: theme.colors.text, fontSize: 20, fontWeight: '600', marginBottom: 8 }}>
          ⚙️ Account
        </Text>
        
        <BrandButton 
          title="Sign Out" 
          variant="warning" 
          onPress={() => dispatch(signOutThunk())}
        />
      </View>
    </ScrollView>
  );
};

export default DriverHomeScreen;
