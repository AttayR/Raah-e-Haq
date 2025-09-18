import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  ScrollView,
  Alert,
  Image,
  ImageBackground,
} from 'react-native';
import { useSelector } from 'react-redux';
import { launchImageLibrary, launchCamera, MediaType, ImagePickerResponse } from 'react-native-image-picker';
import Icon from 'src/assets/icons/index';
import { RootState } from 'src/store';
import { BrandColors } from 'src/theme/colors';

const DriverProfile = () => {
  const navigation = useNavigation();
  const { userProfile, phoneNumber, role } = useSelector(
    (state: RootState) => state.auth,
  );
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const imagePickerOptions = {
    mediaType: 'photo' as MediaType,
    maxHeight: 400,
    maxWidth: 400,
    quality: 0.8 as const,
  };

  const openCamera = () => {
    launchCamera(imagePickerOptions, (response: ImagePickerResponse) => {
      if (response.didCancel || response.errorMessage) {
        return;
      }
      if (response.assets && response.assets[0]) {
        setProfileImage(response.assets[0].uri || null);
      }
    });
  };

  const openGallery = () => {
    launchImageLibrary(imagePickerOptions, (response: ImagePickerResponse) => {
      if (response.didCancel || response.errorMessage) {
        return;
      }
      if (response.assets && response.assets[0]) {
        setProfileImage(response.assets[0].uri || null);
      }
    });
  };

  const handleCameraPress = () => {
    Alert.alert(
      'Select Profile Picture',
      'Choose an option',
      [
        { text: 'Camera', onPress: openCamera },
        { text: 'Gallery', onPress: openGallery },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

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
        {/* Dull/Blur Overlay */}
        <View style={styles.overlay} />
        <View style={styles.overlay2} />
        
        <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            {/* Decorative Circles */}
            <View style={styles.decorativeCircle1} />
            <View style={styles.decorativeCircle2} />
            <View style={styles.decorativeCircle3} />
            <View style={styles.decorativeCircle4} />
            <View style={styles.decorativeCircle5} />
            
            <View style={styles.headerTop}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
              >
                <Icon
                  name="left"
                  size={20}
                  color="#ffffff"
                  type="antDesignIcon"
                />
              </TouchableOpacity>
            </View>

            <View style={styles.profileSection}>
            <View style={styles.profileImageContainer}>
              <View style={styles.profileImage}>
                {profileImage ? (
                  <Image
                    source={{ uri: profileImage }}
                    style={styles.profileImagePhoto}
                  />
                ) : (
                  <Icon
                    name="person"
                    size={40}
                    color="#6b7280"
                    type="fontistoIcon"
                  />
                )}
              </View>
              <TouchableOpacity style={styles.cameraButton} onPress={handleCameraPress}>
                <Icon
                  name="camera"
                  size={16}
                  color="#ffffff"
                  type="antDesignIcon"
                />
              </TouchableOpacity>
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 5,
              }}
            >
              <Text style={styles.userName}>{userProfile?.fullName}</Text>
              <Text
                style={{
                  color: '#ffffff',
                  fontSize: 20,
                }}
              >
                ( {role} )
              </Text>
            </View>
            <Text style={styles.userEmail}>{userProfile?.email}</Text>

            <View style={styles.verifiedBadge}>
              <Icon
                name={userProfile?.isVerified ? 'check' : ''}
                size={14}
                color="#ffffff"
                style={styles.checkIcon}
                type="antDesignIcon"
              />
              <Text style={styles.verifiedText}>
                {userProfile?.isVerified ? 'Verified Driver' : 'Not verified'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Icon
              name="star"
              size={20}
              color={BrandColors.primary}
              type={'antDesignIcon'}
            />
            <Text style={styles.statNumber}>4.9</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>

          <View style={styles.statCard}>
            <Icon
              name="car"
              size={20}
              color={BrandColors.primary}
              type={'fontAwesome6Icon'}
            />
            <Text style={styles.statNumber}>156</Text>
            <Text style={styles.statLabel}>Total Rides</Text>
          </View>

          <View style={styles.statCard}>
            <Icon
              name="dollar"
              size={20}
              color={BrandColors.primary}
              type={'antDesignIcon'}
            />
            <Text style={styles.statNumber}>$2.4k</Text>
            <Text style={styles.statLabel}>Earnings</Text>
          </View>
        </View>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Personal Information</Text>

          <View style={styles.infoCard}>
            <View style={styles.infoItem}>
              <View style={styles.infoIcon}>
                <Icon
                  name="phone"
                  size={20}
                  color="#3b82f6"
                  type={'antDesignIcon'}
                />
              </View>
              <View style={styles.infoDetails}>
                <Text style={styles.infoLabel}>Phone Number</Text>
                <Text style={styles.infoValue}>{phoneNumber}</Text>
              </View>
              <Icon
                name="right"
                size={17}
                color="#9ca3af"
                type={'antDesignIcon'}
              />
            </View>

            <View style={[styles.infoItem, styles.borderTop]}>
              <View style={styles.infoIcon}>
                <Icon
                  name="mail"
                  size={20}
                  color="#3b82f6"
                  type={'antDesignIcon'}
                />
              </View>
              <View style={styles.infoDetails}>
                <Text style={styles.infoLabel}>Email Address</Text>
                <Text style={styles.infoValue}>{userProfile?.email}</Text>
              </View>
              <Icon
                name="right"
                size={17}
                color="#9ca3af"
                type={'antDesignIcon'}
              />
            </View>

            <View style={[styles.infoItem, styles.borderTop]}>
              <View style={styles.infoIcon}>
                <Icon
                  name="enviromento"
                  size={20}
                  color="#3b82f6"
                  type={'antDesignIcon'}
                />
              </View>
              <View style={styles.infoDetails}>
                <Text style={styles.infoLabel}>Location</Text>
                <Text style={styles.infoValue}>{userProfile?.address}</Text>
              </View>
              <Icon
                name="right"
                size={17}
                color="#9ca3af"
                type={'antDesignIcon'}
              />
            </View>

            <View style={[styles.infoItem, styles.borderTop]}>
              <View style={styles.infoIcon}>
                <Icon
                  name="car"
                  size={20}
                  color="#3b82f6"
                  type={'fontAwesome6Icon'}
                />
              </View>
              <View style={styles.infoDetails}>
                <Text style={styles.infoLabel}>Vehicle Info</Text>
                <Text style={styles.infoValue}>Toyota Corolla 2020</Text>
              </View>
              <Icon
                name="right"
                size={17}
                color="#9ca3af"
                type={'antDesignIcon'}
              />
            </View>

            <View style={[styles.infoItem, styles.borderTop]}>
              <View style={styles.infoIcon}>
                <Icon
                  name="idcard"
                  size={20}
                  color="#3b82f6"
                  type={'antDesignIcon'}
                />
              </View>
              <View style={styles.infoDetails}>
                <Text style={styles.infoLabel}>License Number</Text>
                <Text style={styles.infoValue}>DL-123456789</Text>
              </View>
              <Icon
                name="right"
                size={17}
                color="#9ca3af"
                type={'antDesignIcon'}
              />
            </View>
          </View>
        </View>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Driver Preferences</Text>
          <View style={styles.preferencesCard}>
            <View style={styles.preferenceItem}>
              <View style={styles.preferenceInfo}>
                <Icon
                  name="notification"
                  size={20}
                  color={BrandColors.primary}
                  type={'antDesignIcon'}
                />
                <Text style={styles.preferenceText}>Ride Notifications</Text>
              </View>
              <View style={styles.switchContainer}>
                <View style={styles.switchOn}>
                  <View style={styles.switchThumb} />
                </View>
              </View>
            </View>

            <View style={[styles.preferenceItem, styles.borderTop]}>
              <View style={styles.preferenceInfo}>
                <Icon
                  name="sound"
                  size={20}
                  color={BrandColors.primary}
                  type={'antDesignIcon'}
                />
                <Text style={styles.preferenceText}>Sound Alerts</Text>
              </View>
              <View style={styles.switchContainer}>
                <View style={styles.switchOn}>
                  <View style={styles.switchThumb} />
                </View>
              </View>
            </View>

            <View style={[styles.preferenceItem, styles.borderTop]}>
              <View style={styles.preferenceInfo}>
                <Icon
                  name="wifi"
                  size={20}
                  color={BrandColors.primary}
                  type={'antDesignIcon'}
                />
                <Text style={styles.preferenceText}>Auto Accept Rides</Text>
              </View>
              <View style={styles.switchContainer}>
                <View style={styles.switchOff}>
                  <View style={[styles.switchThumb, styles.switchThumbOff]} />
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Actions</Text>
          <View style={styles.actionsCard}>
            <TouchableOpacity style={styles.actionItem}>
              <View style={styles.actionInfo}>
                <Icon
                  name="questioncircle"
                  size={20}
                  color={BrandColors.primary}
                  type={'antDesignIcon'}
                />
                <Text style={styles.actionText}>Help & Support</Text>
              </View>
              <Icon
                name="right"
                size={17}
                color="#9ca3af"
                type={'antDesignIcon'}
              />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionItem, styles.borderTop]}>
              <View style={styles.actionInfo}>
                <Icon
                  name="sharealt"
                  size={20}
                  color={BrandColors.primary}
                  type={'antDesignIcon'}
                />
                <Text style={styles.actionText}>Share App</Text>
              </View>
              <Icon
                name="right"
                size={17}
                color="#9ca3af"
                type={'antDesignIcon'}
              />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionItem, styles.borderTop]}>
              <View style={styles.actionInfo}>
                <Icon
                  name="setting"
                  size={20}
                  color={BrandColors.primary}
                  type={'antDesignIcon'}
                />
                <Text style={styles.actionText}>Driver Settings</Text>
              </View>
              <Icon
                name="right"
                size={17}
                color="#9ca3af"
                type={'antDesignIcon'}
              />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionItem, styles.borderTop]}>
              <View style={styles.actionInfo}>
                <Icon
                  name="delete"
                  size={20}
                  color="#ef4444"
                  type={'antDesignIcon'}
                />
                <Text style={[styles.actionText, styles.deleteText]}>
                  Delete Account
                </Text>
              </View>
              <Icon
                name="right"
                size={17}
                color="#9ca3af"
                type={'antDesignIcon'}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bottomPadding} />
        </ScrollView>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
};

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
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    zIndex: 1,
  },
  overlay2: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    zIndex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    zIndex: 2,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: BrandColors.primary,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 20,
    position: 'relative',
    overflow: 'hidden',
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileSection: {
    alignItems: 'center',
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    overflow: 'hidden',
  },
  profileImagePhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: BrandColors.primary,
  },
  userName: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  userEmail: {
    color: '#e5e7eb',
    fontSize: 16,
    marginBottom: 15,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  checkIcon: {
    marginRight: 5,
  },
  verifiedText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 25,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 1)',
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    gap: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  sectionContainer: {
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 15,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f9ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  infoDetails: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  preferencesCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  preferenceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
  },
  preferenceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  preferenceText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    marginLeft: 15,
  },
  switchContainer: {
    marginLeft: 10,
  },
  switchOn: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  switchOff: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#d1d5db',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignSelf: 'flex-end',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  switchThumbOff: {
    alignSelf: 'flex-start',
  },
  actionsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  actionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
  },
  actionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    marginLeft: 15,
  },
  deleteText: {
    color: '#ef4444',
  },
  bottomPadding: {
    height: 20,
  },
});

export default DriverProfile;
