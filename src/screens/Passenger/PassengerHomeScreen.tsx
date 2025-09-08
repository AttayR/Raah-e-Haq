/* eslint-disable react-native/no-inline-styles */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import Icon from 'src/assets/icons/index';
import { useDispatch, useSelector } from 'react-redux';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { RootState } from '../../store';
import { BrandColors } from 'src/theme/colors';
import { useNavigation } from '@react-navigation/native';

export default function PassengerHomeScreen() {
  const { theme } = useAppTheme();
  const dispatch = useDispatch<any>();
  const navigation = useNavigation();
  // Get user data from Redux store
  const { userProfile, phoneNumber, role } = useSelector(
    (state: RootState) => state.auth,
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1e3a8a" />
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                }}
              >
                <View>
                  <Text style={styles.greeting}>Good Evening</Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 5,
                    }}
                  >
                    <Text style={styles.userName}>{userProfile?.fullName}</Text>
                  </View>
                </View>
                <View>
                  <TouchableOpacity
                    style={styles.userIcon}
                    onPress={() => navigation.navigate('PassengerPofile')}
                  >
                    <Icon
                      name="person"
                      size={20}
                      color="#ffffff"
                      type={'fontistoIcon'}
                    />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.verifiedBadge}>
                <Icon
                  name="check"
                  size={14}
                  color="#ffffff"
                  style={styles.checkIcon}
                  type={'antDesignIcon'}
                />
                <Text style={styles.verifiedText}>
                  {' '}
                  {userProfile?.isVerified ? 'Verified User' : 'Not verified'}
                </Text>
              </View>
              <View style={styles.adventurePrompt}>
                <Text style={styles.adventureText}>
                  🚗 Ready for your next adventure?
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>

          <View style={styles.activityCard}>
            <View style={styles.activityItem}>
              <View style={styles.activityInfo}>
                <Icon
                  name="car-side"
                  size={20}
                  color={BrandColors.primary}
                  type={'fontAwesome6Icon'}
                />
                <View style={styles.activityDetails}>
                  <Text style={styles.activityTitle}>Ride to Airport</Text>
                  <Text style={styles.activitySubtitle}>
                    Yesterday, 2:30 PM
                  </Text>
                </View>
              </View>
              <Text style={styles.price}>$24.50</Text>
            </View>

            <View style={[styles.activityItem, styles.borderTop]}>
              <View style={styles.activityInfo}>
                <Icon
                  name="star"
                  size={20}
                  color="#10b981"
                  type={'antDesignIcon'}
                />
                <View style={styles.activityDetails}>
                  <Text style={styles.activityTitle}>Rated Driver</Text>
                  <Text style={styles.activitySubtitle}>2 days ago</Text>
                </View>
              </View>
              <Text style={styles.rating}>5.0</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.accountCard}>
            <TouchableOpacity style={styles.accountItem}>
              <View style={styles.accountInfo}>
                <Icon
                  name="pen"
                  size={20}
                  color={BrandColors.primary}
                  type={'fontAwesome6Icon'}
                />
                <Text style={styles.accountText}>Edit Profile</Text>
              </View>
              <Icon
                name="chevron-small-right"
                size={25}
                color="#9ca3af"
                type={'entypoIcon'}
              />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.accountItem, styles.borderTop]}>
              <View style={styles.accountInfo}>
                <Icon
                  name="settings"
                  size={20}
                  color={BrandColors.primary}
                  type={'ioniconsIcon'}
                />
                <Text style={styles.accountText}>Settings</Text>
              </View>
              <Icon
                name="chevron-small-right"
                size={25}
                color="#9ca3af"
                type={'entypoIcon'}
              />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.accountItem, styles.borderTop]}>
              <View style={styles.accountInfo}>
                <Icon
                  name="logout"
                  size={20}
                  color="#ef4444"
                  type={'antDesignIcon'}
                />
                <Text style={[styles.accountText, styles.signOutText]}>
                  Sign Out
                </Text>
              </View>
              <Icon
                name="chevron-small-right"
                size={25}
                color="#9ca3af"
                type={'entypoIcon'}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: BrandColors.primary,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 30,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
    marginBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 20,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userIcon: {
    width: 45,
    height: 45,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {},
  greeting: {
    color: '#e5e7eb',
    fontSize: 16,
    marginBottom: -5
  },
  userName: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 15,
    alignSelf: 'flex-start',
  },
  checkIcon: {
    marginRight: 5,
  },
  verifiedText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  adventurePrompt: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    textAlign: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    alignItems: 'center',
    width: '100%',
  },
  adventureText: {
    color: '#ffffff',
    fontSize: 16,
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
  activityCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  activityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  activityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 15,
  },
  activityDetails: {
    gap: 5,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  activitySubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
    color: BrandColors.primary,
  },
  rating: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10b981',
  },
  accountCard: {
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
  accountItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  accountText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    marginLeft: 15,
  },
  signOutText: {
    color: '#ef4444',
  },
  bottomPadding: {
    height: 20,
  },
});
