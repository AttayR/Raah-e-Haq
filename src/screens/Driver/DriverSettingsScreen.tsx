import React from 'react';
import { 
  View, 
  Text, 
  SafeAreaView, 
  StatusBar, 
  StyleSheet,
  ImageBackground,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { BrandColors } from '../../theme/colors';
import { useDispatch } from 'react-redux';
import { signOutThunk } from '../../store/thunks/authThunks';
import Icon from 'react-native-vector-icons/MaterialIcons';

const DriverSettingsScreen = () => {
  const { theme } = useAppTheme();
  const dispatch = useDispatch<any>();
  
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
          <View style={styles.header}>
            {/* Decorative Circles */}
            <View style={styles.decorativeCircle1} />
            <View style={styles.decorativeCircle2} />
            <View style={styles.decorativeCircle3} />
            <View style={styles.decorativeCircle4} />
            <View style={styles.decorativeCircle5} />
            
            <Text style={styles.headerTitle}>Settings</Text>
          </View>
          
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.contentContainer}>
              <Text style={styles.title}>Driver Settings</Text>
              <Text style={styles.subtitle}>
                Manage your account preferences and app settings
              </Text>
              
              {/* Settings Options */}
              <View style={styles.settingsContainer}>
                <TouchableOpacity
                  style={styles.settingItem}
                  onPress={() => console.log('Edit Profile')}
                >
                  <View style={styles.settingIcon}>
                    <Icon name="person" size={24} color={BrandColors.primary} />
                  </View>
                  <View style={styles.settingContent}>
                    <Text style={styles.settingTitle}>Edit Profile</Text>
                    <Text style={styles.settingSubtitle}>Update your personal information</Text>
                  </View>
                  <Icon name="chevron-right" size={24} color="#9ca3af" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.settingItem}
                  onPress={() => console.log('Notifications')}
                >
                  <View style={styles.settingIcon}>
                    <Icon name="notifications" size={24} color={BrandColors.primary} />
                  </View>
                  <View style={styles.settingContent}>
                    <Text style={styles.settingTitle}>Notifications</Text>
                    <Text style={styles.settingSubtitle}>Manage notification preferences</Text>
                  </View>
                  <Icon name="chevron-right" size={24} color="#9ca3af" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.settingItem}
                  onPress={() => console.log('Privacy')}
                >
                  <View style={styles.settingIcon}>
                    <Icon name="privacy-tip" size={24} color={BrandColors.primary} />
                  </View>
                  <View style={styles.settingContent}>
                    <Text style={styles.settingTitle}>Privacy & Security</Text>
                    <Text style={styles.settingSubtitle}>Control your privacy settings</Text>
                  </View>
                  <Icon name="chevron-right" size={24} color="#9ca3af" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.settingItem}
                  onPress={() => console.log('Help')}
                >
                  <View style={styles.settingIcon}>
                    <Icon name="help" size={24} color={BrandColors.primary} />
                  </View>
                  <View style={styles.settingContent}>
                    <Text style={styles.settingTitle}>Help & Support</Text>
                    <Text style={styles.settingSubtitle}>Get help and contact support</Text>
                  </View>
                  <Icon name="chevron-right" size={24} color="#9ca3af" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.settingItem, styles.logoutItem]}
                  onPress={() => dispatch(signOutThunk())}
                >
                  <View style={[styles.settingIcon, styles.logoutIcon]}>
                    <Icon name="logout" size={24} color="#ef4444" />
                  </View>
                  <View style={styles.settingContent}>
                    <Text style={[styles.settingTitle, styles.logoutText]}>Sign Out</Text>
                    <Text style={styles.settingSubtitle}>Logout from your account</Text>
                  </View>
                  <Icon name="chevron-right" size={24} color="#9ca3af" />
                </TouchableOpacity>
              </View>
            </View>
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
  header: {
    backgroundColor: BrandColors.primary,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
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
  headerTitle: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  title: {
    color: '#1f2937',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    color: '#6b7280',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  placeholderContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  placeholderText: {
    color: '#6b7280',
    fontSize: 16,
    textAlign: 'center',
  },
  settingsContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  logoutItem: {
    borderBottomWidth: 0,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  logoutIcon: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  logoutText: {
    color: '#ef4444',
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
});

export default DriverSettingsScreen;
