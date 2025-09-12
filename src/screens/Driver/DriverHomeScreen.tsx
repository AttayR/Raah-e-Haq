import React, { useState } from 'react';
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
import { BrandColors } from '../../theme/colors';

const { width } = Dimensions.get('window');

export default function DriverHomeScreen() {
  const { theme } = useAppTheme();
  const dispatch = useDispatch<any>();
  const navigation = useNavigation();
  const [isOnline, setIsOnline] = useState(false);
  
  // Get user data from Redux store
  const { userProfile } = useSelector((state: RootState) => state.auth);

  const quickActions = [
    {
      id: 'online',
      title: isOnline ? 'Go Offline' : 'Go Online',
      subtitle: isOnline ? 'Stop receiving rides' : 'Start receiving rides',
      icon: isOnline ? 'pause-circle-filled' : 'play-circle-filled',
      color: isOnline ? '#ef4444' : '#10b981',
      onPress: () => setIsOnline(!isOnline),
    },
    {
      id: 'earnings',
      title: 'Earnings',
      subtitle: 'View your income',
      icon: 'attach-money',
      color: '#f59e0b',
      onPress: () => console.log('View earnings'),
    },
    {
      id: 'history',
      title: 'Ride History',
      subtitle: 'Past trips',
      icon: 'history',
      color: theme.colors.secondary,
      onPress: () => console.log('View history'),
    },
    {
      id: 'profile',
      title: 'Profile',
      subtitle: 'Edit your profile',
      icon: 'person',
      color: '#8b5cf6',
      onPress: () => navigation.navigate('DriverProfile'),
    },
  ];

  const stats = [
    { label: 'Total Rides', value: '156', icon: 'local-taxi' },
    { label: 'Rating', value: '4.9', icon: 'star' },
    { label: 'Earnings', value: '$2.4k', icon: 'attach-money' },
  ];

  const recentRides = [
    {
      id: '1',
      passenger: 'Sarah Ahmed',
      from: 'Downtown Mall',
      to: 'Airport Terminal 1',
      fare: '$25.50',
      time: '2:30 PM',
      status: 'completed',
    },
    {
      id: '2',
      passenger: 'Ali Hassan',
      from: 'University Campus',
      to: 'City Center',
      fare: '$18.75',
      time: '1:15 PM',
      status: 'completed',
    },
    {
      id: '3',
      passenger: 'Fatima Khan',
      from: 'Hospital',
      to: 'Shopping Mall',
      fare: '$12.30',
      time: '11:45 AM',
      status: 'completed',
    },
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
          backgroundColor={BrandColors.primary}
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
                {userProfile?.fullName || 'Driver'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => navigation.navigate('DriverProfile')}
            >
              <Icon name="person" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {/* Status Badge with Cartoon Style */}
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: isOnline ? '#10b981' : '#ef4444' },
            ]}
          >
            <View style={styles.statusIndicator} />
            <Text style={styles.statusText}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Stats Cards */}
          <View style={styles.statsContainer}>
            {stats.map((stat, index) => (
              <View key={index} style={styles.statCard}>
                <View style={styles.statIconContainer}>
                  <Icon name={stat.icon} size={24} color={BrandColors.primary} />
                </View>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>

          {/* Quick Actions */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionsGrid}>
              {quickActions.map((action) => (
                <TouchableOpacity
                  key={action.id}
                  style={[styles.actionCard, { borderLeftColor: action.color }]}
                  onPress={action.onPress}
                  activeOpacity={0.7}
                >
                  <View style={styles.actionContent}>
                    <View style={[styles.actionIcon, { backgroundColor: action.color }]}>
                      <Icon name={action.icon} size={24} color="white" />
                    </View>
                    <View style={styles.actionTextContainer}>
                      <Text style={styles.actionTitle}>{action.title}</Text>
                      <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Recent Rides */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Rides</Text>
              <TouchableOpacity>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.ridesList}>
              {recentRides.map((ride) => (
                <View key={ride.id} style={styles.rideCard}>
                  <View style={styles.rideHeader}>
                    <View style={styles.passengerInfo}>
                      <View style={styles.passengerAvatar}>
                        <Icon name="person" size={20} color={BrandColors.primary} />
                      </View>
                      <View>
                        <Text style={styles.passengerName}>{ride.passenger}</Text>
                        <Text style={styles.rideTime}>{ride.time}</Text>
                      </View>
                    </View>
                    <Text style={styles.rideFare}>{ride.fare}</Text>
                  </View>
                  <View style={styles.rideRoute}>
                    <View style={styles.routePoint}>
                      <View style={[styles.routeDot, styles.pickupDot]} />
                      <Text style={styles.routeText}>{ride.from}</Text>
                    </View>
                    <View style={styles.routeLine} />
                    <View style={styles.routePoint}>
                      <View style={[styles.routeDot, styles.dropoffDot]} />
                      <Text style={styles.routeText}>{ride.to}</Text>
                    </View>
                  </View>
                  <View style={styles.rideStatus}>
                    <View style={[styles.statusBadge, { backgroundColor: '#10b981' }]}>
                      <Text style={styles.statusText}>Completed</Text>
                    </View>
                  </View>
                </View>
              ))}
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
    backgroundColor: 'transparent',
    zIndex: 2,
  },
  transparentBackground: {
    backgroundColor: 'transparent',
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  headerBackground: {
    backgroundColor: BrandColors.primary,
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
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    fontWeight: '500',
  },
  userName: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 4,
  },
  profileButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#10b981',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffffff',
    marginRight: 8,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
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
  statIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  sectionContainer: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seeAllText: {
    fontSize: 14,
    color: BrandColors.primary,
    fontWeight: '500',
  },
  actionsGrid: {
    gap: 12,
  },
  actionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  ridesList: {
    gap: 12,
  },
  rideCard: {
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
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  passengerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passengerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  rideTime: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  rideFare: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10b981',
  },
  rideRoute: {
    marginBottom: 16,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  pickupDot: {
    backgroundColor: '#10b981',
  },
  dropoffDot: {
    backgroundColor: '#ef4444',
  },
  routeText: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: '#e5e7eb',
    marginLeft: 5,
    marginBottom: 8,
  },
  rideStatus: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  bottomSpacing: {
    height: 20,
  },
});
