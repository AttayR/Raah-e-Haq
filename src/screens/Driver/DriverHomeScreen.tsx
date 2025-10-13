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
  SafeAreaView,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { signOutThunk } from '../../store/thunks/authThunks';
import { RootState } from '../../store';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { BrandColors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import LinearGradient from 'react-native-linear-gradient';
import { showToast } from '../../components/ToastProvider';

const { width, height } = Dimensions.get('window');
const isTablet = width >= 768;
const isLargeScreen = width >= 1024;

export default function DriverHomeScreen() {
  const { theme } = useAppTheme();
  const dispatch = useDispatch<any>();
  const navigation = useNavigation();
  const [isOnline, setIsOnline] = useState(false);
  
  // Get user data from Redux store
  const { user } = useSelector((state: RootState) => state.apiAuth);

  // Check if driver is approved
  const isDriverApproved = user?.status === 'active';

  const quickActions = [
    {
      id: 'online',
      title: isOnline ? 'Go Offline' : 'Go Online',
      subtitle: isOnline ? 'Stop receiving rides' : 'Start receiving rides',
      icon: isOnline ? 'pause-circle-filled' : 'play-circle-filled',
      color: isOnline ? '#ef4444' : '#10b981',
      onPress: () => {
        if (!isDriverApproved) {
          showToast('error', 'Your driver account is not approved yet');
          return;
        }
        setIsOnline(!isOnline);
      },
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
    { 
      label: 'Total Rides', 
      value: '156', 
      icon: 'local-taxi', 
      color: '#3b82f6',
      subtitle: '+12 this week'
    },
    { 
      label: 'Rating', 
      value: '4.9', 
      icon: 'star', 
      color: '#f59e0b',
      subtitle: 'Excellent'
    },
    { 
      label: 'Earnings', 
      value: 'PKR 24k', 
      icon: 'attach-money', 
      color: '#10b981',
      subtitle: 'This month'
    },
    { 
      label: 'Online Hours', 
      value: '8.5h', 
      icon: 'schedule', 
      color: '#8b5cf6',
      subtitle: 'Today'
    },
  ];

  // Get vehicle type and info
  const vehicleType = user?.vehicle_type || 'car';
  const vehicleInfo = user?.vehicleInfo || null;
  
  // Format vehicle display text
  const getVehicleDisplayText = () => {
    if (vehicleInfo) {
      return `${vehicleInfo.brand} ${vehicleInfo.model} ${vehicleInfo.year || ''}`.trim();
    }
    return vehicleType.charAt(0).toUpperCase() + vehicleType.slice(1);
  };

  const getVehicleIcon = () => {
    switch (vehicleType) {
      case 'car': return 'directions-car';
      case 'bike': return 'motorcycle';
      case 'van': return 'local-shipping';
      case 'truck': return 'local-shipping';
      default: return 'directions-car';
    }
  };

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

        <View style={[styles.container, styles.transparentBackground]}>

        {/* Driver Status Banner */}
        {!isDriverApproved && (
          <View style={styles.statusBanner}>
            <Icon name="info" size={20} color="#f59e0b" />
            <Text style={styles.statusText}>
              Your driver account is pending approval. You cannot accept rides until approved.
            </Text>
          </View>
        )}

        {/* Compact gradient header */}
        <LinearGradient colors={[BrandColors.primary, '#2563eb']} style={styles.header}>
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
                {user?.name || 'Driver'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => navigation.navigate('DriverProfile')}
            >
              <Icon name="person" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {/* Vehicle Information Card */}
          <View style={styles.vehicleCard}>
            <View style={styles.vehicleInfo}>
              <Icon name={getVehicleIcon()} size={24} color="#ffffff" />
              <View style={styles.vehicleDetails}>
                <Text style={styles.vehicleType}>
                  {vehicleType.charAt(0).toUpperCase() + vehicleType.slice(1)}
                </Text>
                <Text style={styles.vehicleModel}>
                  {getVehicleDisplayText()}
                </Text>
              </View>
            </View>
            <View style={styles.vehicleStatus}>
              <Text style={styles.vehicleStatusText}>
                {isDriverApproved ? 'Verified' : 'Pending'}
              </Text>
            </View>
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
        </LinearGradient>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Enhanced Stats Section */}
          <View style={styles.statsSection}>
            <Text style={styles.statsSectionTitle}>Performance Overview</Text>
            <View style={styles.statsGrid}>
              {stats.map((stat, index) => (
                <View key={index} style={styles.statCard}>
                  <LinearGradient
                    colors={[`${stat.color}20`, `${stat.color}10`]}
                    style={styles.statGradient}
                  >
                    <View style={styles.statContent}>
                      <View style={[styles.statIconWrapper, { backgroundColor: stat.color }]}>
                        <Icon name={stat.icon} size={20} color="white" />
                      </View>
                      <View style={styles.statTextContainer}>
                        <Text style={styles.statValue}>{stat.value}</Text>
                        <Text style={styles.statLabel}>{stat.label}</Text>
                        <Text style={styles.statSubtitle}>{stat.subtitle}</Text>
                      </View>
                    </View>
                    <View style={[styles.statAccent, { backgroundColor: stat.color }]} />
                  </LinearGradient>
                </View>
              ))}
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionsGrid}>
              {quickActions.map((action) => (
                <TouchableOpacity
                  key={action.id}
                  style={[
                    styles.actionCard, 
                    { borderLeftColor: action.color },
                    action.id === 'online' && isOnline && styles.activeActionCard
                  ]}
                  onPress={action.onPress}
                  activeOpacity={0.7}
                >
                  <View style={styles.actionContent}>
                    <View style={[
                      styles.actionIcon, 
                      { backgroundColor: action.color },
                      action.id === 'online' && isOnline && styles.activeActionIcon
                    ]}>
                      <Icon name={action.icon} size={24} color="white" />
                    </View>
                    <View style={styles.actionTextContainer}>
                      <Text style={[
                        styles.actionTitle,
                        action.id === 'online' && isOnline && styles.activeActionTitle
                      ]}>
                        {action.title}
                      </Text>
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
                    <View style={styles.rideFareContainer}>
                      <Text style={styles.rideFare}>{ride.fare}</Text>
                      <View style={[
                        styles.statusBadgeSmall,
                        { backgroundColor: ride.status === 'completed' ? '#10b981' : '#f59e0b' }
                      ]}>
                        <Text style={styles.statusBadgeText}>
                          {ride.status.charAt(0).toUpperCase() + ride.status.slice(1)}
                        </Text>
                      </View>
                    </View>
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

          {/* Account Actions */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.actionsGrid}>
              <TouchableOpacity
                style={[styles.actionCard, { borderLeftColor: '#ef4444' }]}
                onPress={() => dispatch(signOutThunk())}
                activeOpacity={0.7}
              >
                <View style={styles.actionContent}>
                  <View style={[styles.actionIcon, { backgroundColor: '#ef4444' }]}>
                    <Icon name="logout" size={24} color="white" />
                  </View>
                  <View style={styles.actionTextContainer}>
                    <Text style={styles.actionTitle}>Sign Out</Text>
                    <Text style={styles.actionSubtitle}>Logout from your account</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Bottom Spacing */}
          <View style={styles.bottomSpacing} />
        </ScrollView>
        </View>
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
    fontSize: 14,
    fontWeight: '600',
  },
  userName: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '800',
    marginTop: 2,
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
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  vehicleDetails: {
    marginLeft: 12,
    flex: 1,
  },
  vehicleType: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  vehicleModel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
  vehicleStatus: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  vehicleStatusText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  statsSection: {
    marginBottom: 30,
  },
  statsSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    width: isTablet ? (width - 80) / 4 : (width - 60) / 2, // Responsive width calculation
    marginBottom: 12,
    minWidth: isTablet ? 160 : 140,
  },
  statGradient: {
    borderRadius: 16,
    padding: isTablet ? 20 : 16,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statContent: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 2,
  },
  statIconWrapper: {
    width: isTablet ? 48 : 40,
    height: isTablet ? 48 : 40,
    borderRadius: isTablet ? 24 : 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: isTablet ? 16 : 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  statTextContainer: {
    flex: 1,
  },
  statValue: {
    fontSize: isTablet ? 24 : 20,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: isTablet ? 14 : 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  statSubtitle: {
    fontSize: isTablet ? 12 : 10,
    color: '#9ca3af',
    fontWeight: '400',
    marginTop: 1,
  },
  statAccent: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 4,
    height: '100%',
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
  },
  sectionContainer: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
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
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 13,
    color: '#6b7280',
  },
  activeActionCard: {
    backgroundColor: '#f0f9ff',
    borderColor: '#0ea5e9',
    borderWidth: 1,
  },
  activeActionIcon: {
    backgroundColor: '#0ea5e9',
    transform: [{ scale: 1.1 }],
  },
  activeActionTitle: {
    color: '#0ea5e9',
    fontWeight: '700',
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
    fontWeight: '700',
    color: '#1f2937',
  },
  rideTime: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  rideFare: {
    fontSize: 18,
    fontWeight: '800',
    color: '#10b981',
  },
  rideFareContainer: {
    alignItems: 'flex-end',
  },
  statusBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
  },
  statusBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
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
    fontSize: 13,
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
  statusBanner: {
    backgroundColor: '#fef3c7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    gap: 8,
  },
  statusText: {
    flex: 1,
    fontSize: 14,
    color: '#92400e',
    fontWeight: '500',
  },
});
