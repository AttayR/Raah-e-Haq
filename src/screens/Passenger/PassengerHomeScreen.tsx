import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  ImageBackground,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { signOutThunk } from '../../store/thunks/authThunks';
import { RootState } from '../../store';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

export default function PassengerHomeScreen() {
  const { theme } = useAppTheme();
  const dispatch = useDispatch<any>();
  const navigation = useNavigation();
  // Get user data from Redux store
  const { userProfile } = useSelector((state: RootState) => state.auth);

  const quickActions = [
    {
      id: 'ride',
      title: 'Book a Ride',
      subtitle: 'Find nearby drivers',
      icon: 'local-taxi',
      color: theme.colors.primary,
      onPress: () => console.log('Book ride'),
    },
    {
      id: 'history',
      title: 'Ride History',
      subtitle: 'View past trips',
      icon: 'history',
      color: theme.colors.secondary,
      onPress: () => console.log('View history'),
    },
    {
      id: 'favorites',
      title: 'Favorites',
      subtitle: 'Saved locations',
      icon: 'favorite',
      color: '#FF6B6B',
      onPress: () => console.log('Favorites'),
    },
    {
      id: 'wallet',
      title: 'Wallet',
      subtitle: 'Payment methods',
      icon: 'account-balance-wallet',
      color: '#4ECDC4',
      onPress: () => console.log('Wallet'),
    },
  ];

  const stats = [
    { label: 'Total Rides', value: '24', icon: 'local-taxi' },
    { label: 'Rating', value: '4.8', icon: 'star' },
    { label: 'Distance', value: '156 km', icon: 'straighten' },
  ];

  return (
    <ImageBackground
      source={require('../../assets/images/BackgroundRaaheHaq.png')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      {/* Dull/Blur Overlay */}
      <View style={styles.overlay} />
      <View style={styles.overlay2} />

      <View style={[styles.container, styles.transparentBackground]}>
        <StatusBar
          barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'}
          backgroundColor={theme.colors.primary}
        />

        {/* Header with Cartoon-style Background */}
        <View style={[styles.header, styles.headerBackground]}>
          {/* Decorative Circles */}
          <View style={styles.decorativeCircle1} />
          <View style={styles.decorativeCircle2} />
          <View style={styles.decorativeCircle3} />
          <View style={styles.decorativeCircle4} />
          <View style={styles.decorativeCircle5} />

          <View style={styles.headerContent}>
            <View>
              <Text style={styles.greeting}>
                Good{' '}
                {new Date().getHours() < 12
                  ? 'Morning'
                  : new Date().getHours() < 18
                  ? 'Afternoon'
                  : 'Evening'}
              </Text>
              <Text style={styles.userName}>
                {userProfile?.fullName || 'Passenger'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => navigation.navigate('PassengerPofile')}
            >
              <Icon name="person" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {/* Status Badge with Cartoon Style */}
          <View
            style={[
              styles.statusBadge,
              userProfile?.isVerified
                ? styles.statusVerified
                : styles.statusPending,
            ]}
          >
            <Icon
              name={userProfile?.isVerified ? 'verified' : 'schedule'}
              size={16}
              color="white"
            />
            <Text style={styles.statusText}>
              {userProfile?.isVerified ? 'Verified' : 'Pending'}
            </Text>
          </View>

          {/* Welcome Message with Cartoon Style */}
          <View style={styles.welcomeMessage}>
            <Text style={styles.welcomeText}>
              🚗 Ready for your next adventure?
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Stats Cards */}
          <View style={styles.statsContainer}>
            {stats.map((stat, index) => (
              <View
                key={index}
                style={[
                  styles.statCard,
                  { backgroundColor: theme.colors.surface },
                ]}
              >
                <Icon name={stat.icon} size={24} color={theme.colors.primary} />
                <Text style={[styles.statValue, { color: theme.colors.text }]}>
                  {stat.value}
                </Text>
                <Text
                  style={[styles.statLabel, { color: theme.colors.mutedText }]}
                >
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>

          {/* Quick Actions Grid */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Quick Actions
            </Text>
            <View style={styles.actionsGrid}>
              {quickActions.map(action => (
                <TouchableOpacity
                  key={action.id}
                  style={[
                    styles.actionCard,
                    { backgroundColor: theme.colors.surface },
                  ]}
                  onPress={action.onPress}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.actionIcon,
                      { backgroundColor: action.color + '20' },
                    ]}
                  >
                    <Icon name={action.icon} size={28} color={action.color} />
                  </View>
                  <Text
                    style={[styles.actionTitle, { color: theme.colors.text }]}
                  >
                    {action.title}
                  </Text>
                  <Text
                    style={[
                      styles.actionSubtitle,
                      { color: theme.colors.mutedText },
                    ]}
                  >
                    {action.subtitle}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Recent Activity */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Recent Activity
            </Text>
            <View
              style={[
                styles.activityCard,
                { backgroundColor: theme.colors.surface },
              ]}
            >
              <View style={styles.activityItem}>
                <View
                  style={[
                    styles.activityIcon,
                    { backgroundColor: theme.colors.primary + '20' },
                  ]}
                >
                  <Icon
                    name="local-taxi"
                    size={20}
                    color={theme.colors.primary}
                  />
                </View>
                <View style={styles.activityContent}>
                  <Text
                    style={[styles.activityTitle, { color: theme.colors.text }]}
                  >
                    Ride to Airport
                  </Text>
                  <Text
                    style={[
                      styles.activitySubtitle,
                      { color: theme.colors.mutedText },
                    ]}
                  >
                    Yesterday, 2:30 PM
                  </Text>
                </View>
                <Text
                  style={[
                    styles.activityPrice,
                    { color: theme.colors.primary },
                  ]}
                >
                  $24.50
                </Text>
              </View>

              <View
                style={[
                  styles.divider,
                  { backgroundColor: theme.colors.border },
                ]}
              />

              <View style={styles.activityItem}>
                <View
                  style={[
                    styles.activityIcon,
                    { backgroundColor: theme.colors.success + '20' },
                  ]}
                >
                  <Icon name="star" size={20} color={theme.colors.success} />
                </View>
                <View style={styles.activityContent}>
                  <Text
                    style={[styles.activityTitle, { color: theme.colors.text }]}
                  >
                    Rated Driver
                  </Text>
                  <Text
                    style={[
                      styles.activitySubtitle,
                      { color: theme.colors.mutedText },
                    ]}
                  >
                    2 days ago
                  </Text>
                </View>
                <Text
                  style={[
                    styles.activityPrice,
                    { color: theme.colors.success },
                  ]}
                >
                  5.0
                </Text>
              </View>
            </View>
          </View>

          {/* Account Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Account
            </Text>
            <View
              style={[
                styles.accountCard,
                { backgroundColor: theme.colors.surface },
              ]}
            >
              <TouchableOpacity
                style={styles.accountItem}
                onPress={() => console.log('Edit Profile')}
              >
                <Icon name="edit" size={24} color={theme.colors.primary} />
                <Text
                  style={[styles.accountText, { color: theme.colors.text }]}
                >
                  Edit Profile
                </Text>
                <Icon
                  name="chevron-right"
                  size={24}
                  color={theme.colors.mutedText}
                />
              </TouchableOpacity>

              <View
                style={[
                  styles.divider,
                  { backgroundColor: theme.colors.border },
                ]}
              />

              <TouchableOpacity
                style={styles.accountItem}
                onPress={() => console.log('Settings')}
              >
                <Icon name="settings" size={24} color={theme.colors.primary} />
                <Text
                  style={[styles.accountText, { color: theme.colors.text }]}
                >
                  Settings
                </Text>
                <Icon
                  name="chevron-right"
                  size={24}
                  color={theme.colors.mutedText}
                />
              </TouchableOpacity>

              <View
                style={[
                  styles.divider,
                  { backgroundColor: theme.colors.border },
                ]}
              />

              <TouchableOpacity
                style={styles.accountItem}
                onPress={() => dispatch(signOutThunk())}
              >
                <Icon name="logout" size={24} color={theme.colors.warning} />
                <Text
                  style={[styles.accountText, { color: theme.colors.warning }]}
                >
                  Sign Out
                </Text>
                <Icon
                  name="chevron-right"
                  size={24}
                  color={theme.colors.mutedText}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Bottom Spacing */}
          <View style={styles.bottomSpacing} />
        </ScrollView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
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
    zIndex: 2,
  },
  transparentBackground: {
    backgroundColor: 'transparent',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 40,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    position: 'relative',
    overflow: 'hidden',
  },
  headerBackground: {
    backgroundColor: '#011c72ff',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  userName: {
    fontSize: 24,
    color: 'white',
    fontWeight: '700',
    marginTop: 4,
  },
  profileButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
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
  welcomeMessage: {
    alignItems: 'center',
    marginTop: 15,
  },
  welcomeText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  statusVerified: {
    backgroundColor: '#00C851',
  },
  statusPending: {
    backgroundColor: '#FF9500',
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    marginHorizontal: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    width: (width - 60) / 2,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  actionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  actionSubtitle: {
    fontSize: 12,
    textAlign: 'center',
  },
  activityCard: {
    borderRadius: 16,
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  activitySubtitle: {
    fontSize: 14,
  },
  activityPrice: {
    fontSize: 16,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
  accountCard: {
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  accountText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 16,
  },
  bottomSpacing: {
    height: 20,
  },
});
