import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ImageBackground,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { signOutUser } from '../../services/firebaseAuth';
import { setSignedOut } from '../../store/slices/authSlice';
import { showToast } from '../../components/ToastProvider';
import { BrandColors } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function DriverPendingApprovalScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch<any>();
  const { userProfile } = useSelector((state: RootState) => state.auth);
  
  const [refreshCount, setRefreshCount] = useState(0);

  const driverStatus = userProfile?.driverStatus || 'pending';
  const rejectionReason = userProfile?.rejectionReason;

  const handleSignOut = async () => {
    try {
      Alert.alert(
        'Sign Out',
        'Are you sure you want to sign out?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign Out',
            style: 'destructive',
            onPress: async () => {
              await signOutUser();
              dispatch(setSignedOut());
              showToast('success', 'Signed out successfully');
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error signing out:', error);
      showToast('error', 'Failed to sign out');
    }
  };

  const handleRefresh = () => {
    setRefreshCount(prev => prev + 1);
    showToast('info', 'Checking approval status...');
  };

  const getStatusInfo = () => {
    switch (driverStatus) {
      case 'pending':
        return {
          icon: 'hourglass-empty',
          title: 'Application Under Review',
          message: 'Your driver application is currently being reviewed by our admin team. This process usually takes 24-48 hours.',
          color: '#f59e0b',
          showRefresh: true,
        };
      case 'rejected':
        return {
          icon: 'cancel',
          title: 'Application Rejected',
          message: rejectionReason || 'Your driver application has been rejected. Please contact support for more information.',
          color: '#ef4444',
          showRefresh: false,
        };
      case 'suspended':
        return {
          icon: 'pause-circle-filled',
          title: 'Account Suspended',
          message: rejectionReason || 'Your driver account has been suspended. Please contact support for more information.',
          color: '#ef4444',
          showRefresh: false,
        };
      default:
        return {
          icon: 'hourglass-empty',
          title: 'Application Under Review',
          message: 'Your driver application is currently being reviewed by our admin team.',
          color: '#f59e0b',
          showRefresh: true,
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={BrandColors.primary}
        translucent={false}
      />
      <ImageBackground
        source={require('../../assets/images/background_raahe_haq.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <Image 
                  source={require('../../assets/images/logo.png')} 
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.title}>Driver Application</Text>
              <Text style={styles.subtitle}>
                {userProfile?.fullName || 'Driver'}
              </Text>
            </View>

            {/* Status Card */}
            <View style={styles.statusCard}>
              <View style={[styles.statusIconContainer, { backgroundColor: statusInfo.color + '20' }]}>
                <Icon 
                  name={statusInfo.icon} 
                  size={48} 
                  color={statusInfo.color} 
                />
              </View>
              
              <Text style={styles.statusTitle}>{statusInfo.title}</Text>
              <Text style={styles.statusMessage}>{statusInfo.message}</Text>

              {driverStatus === 'pending' && (
                <View style={styles.pendingInfo}>
                  <View style={styles.infoItem}>
                    <Icon name="schedule" size={20} color="#6b7280" />
                    <Text style={styles.infoText}>Review Time: 24-48 hours</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Icon name="notifications" size={20} color="#6b7280" />
                    <Text style={styles.infoText}>You'll be notified when approved</Text>
                  </View>
                </View>
              )}

              {driverStatus === 'rejected' && (
                <View style={styles.rejectedInfo}>
                  <View style={styles.infoItem}>
                    <Icon name="info" size={20} color="#ef4444" />
                    <Text style={[styles.infoText, { color: '#ef4444' }]}>
                      Contact support for assistance
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              {statusInfo.showRefresh && (
                <TouchableOpacity
                  style={styles.refreshButton}
                  onPress={handleRefresh}
                  activeOpacity={0.8}
                >
                  <Icon name="refresh" size={20} color="#ffffff" />
                  <Text style={styles.refreshButtonText}>Check Status</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.signOutButton}
                onPress={handleSignOut}
                activeOpacity={0.8}
              >
                <Icon name="logout" size={20} color={BrandColors.primary} />
                <Text style={styles.signOutButtonText}>Sign Out</Text>
              </TouchableOpacity>
            </View>

            {/* Additional Info */}
            <View style={styles.additionalInfo}>
              <Text style={styles.additionalInfoTitle}>What happens next?</Text>
              <View style={styles.stepsList}>
                <View style={styles.stepItem}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>1</Text>
                  </View>
                  <Text style={styles.stepText}>Admin reviews your documents</Text>
                </View>
                <View style={styles.stepItem}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>2</Text>
                  </View>
                  <Text style={styles.stepText}>Background verification</Text>
                </View>
                <View style={styles.stepItem}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>3</Text>
                  </View>
                  <Text style={styles.stepText}>Approval notification</Text>
                </View>
              </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.6)',
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
    width: 50,
    height: 50,
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    textAlign: 'center',
  },
  statusCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  statusIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  statusMessage: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  pendingInfo: {
    width: '100%',
    gap: 12,
  },
  rejectedInfo: {
    width: '100%',
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  buttonContainer: {
    gap: 16,
    marginBottom: 30,
  },
  refreshButton: {
    backgroundColor: BrandColors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  refreshButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: BrandColors.primary,
    gap: 8,
  },
  signOutButtonText: {
    color: BrandColors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  additionalInfo: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
  },
  additionalInfoTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  stepsList: {
    gap: 12,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  stepText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    flex: 1,
  },
});
