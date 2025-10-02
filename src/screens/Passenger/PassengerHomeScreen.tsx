import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  ImageBackground,
  RefreshControl,
  Alert,
  Animated,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { refreshSessionThunk } from '../../store/thunks/authThunks';
import { useApiAuth } from '../../hooks/useApiAuth';
import { useLocation } from '../../hooks/useLocation';
import { reverseGeocode } from '../../services/placesService';
import { RootState } from '../../store';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

export default function PassengerHomeScreen() {
  const { theme } = useAppTheme();
  const dispatch = useDispatch<any>();
  const navigation = useNavigation<any>();
  const { user } = useSelector((state: RootState) => state.apiAuth);
  const { logout } = useApiAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [weatherInfo] = useState({ temp: '28°C', condition: 'Sunny' });
  const [notifications] = useState(2);
  const [currentAddress, setCurrentAddress] = useState<string>('Getting location...');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  
  const { currentLocation, isInitialized } = useLocation();

  useEffect(() => {
    // Animate on mount
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Update time every minute
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, [fadeAnim, slideAnim]);

  // Update address when location changes
  useEffect(() => {
    const updateAddress = async () => {
      console.log('Location update effect:', { currentLocation, isInitialized });
      
      if (currentLocation && isInitialized) {
        console.log('Got location, reverse geocoding:', currentLocation);
        try {
          const address = await reverseGeocode(currentLocation.latitude, currentLocation.longitude);
          console.log('Reverse geocode result:', address);
          if (address && typeof address === 'string' && address.trim().length > 0) {
            // Show full formatted address to be precise (no slicing)
            setCurrentAddress(address.trim());
            return;
          } else {
            // Fallback to coordinates if reverse geocoding fails
            console.log('Reverse geocoding failed, showing coordinates');
            setCurrentAddress(`${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}`);
            return;
          }
        } catch (error) {
          console.warn('Reverse geocoding error:', error);
          // Fallback to coordinates on error
          setCurrentAddress(`${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}`);
        }
      } else if (!isInitialized) {
        console.log('Location not initialized yet');
        setCurrentAddress('Getting location...');
      } else if (!currentLocation) {
        console.log('No current location available');
        setCurrentAddress('Location unavailable');
      }
    };

    updateAddress();
  }, [currentLocation, isInitialized]);

  // Debug logging
  console.log('PassengerHomeScreen - User data:', user);
  console.log('PassengerHomeScreen - User name:', user?.name);
  console.log('PassengerHomeScreen - User status:', user?.status);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Refresh session/token
      await dispatch(refreshSessionThunk());
      // User data will be automatically updated from the API
    } finally {
      setRefreshing(false);
    }
  }, [dispatch]);

  const quickActions = [
    {
      id: 'ride',
      title: 'Book a Ride',
      subtitle: 'Find nearby drivers',
      icon: 'local-taxi',
      color: '#3B82F6',
      gradient: ['#3B82F6', '#1D4ED8'],
      onPress: () => navigation.navigate('PassengerMap'),
    },
    {
      id: 'history',
      title: 'Ride History',
      subtitle: 'View past trips',
      icon: 'history',
      color: '#8B5CF6',
      gradient: ['#8B5CF6', '#7C3AED'],
      onPress: () => navigation.navigate('RideHistory'),
    },
    {
      id: 'favorites',
      title: 'Favorites',
      subtitle: 'Saved locations',
      icon: 'favorite',
      color: '#EF4444',
      gradient: ['#EF4444', '#DC2626'],
      onPress: () => navigation.navigate('FavoriteLocations'),
    },
    {
      id: 'wallet',
      title: 'Wallet',
      subtitle: 'Payment methods',
      icon: 'account-balance-wallet',
      color: '#10B981',
      gradient: ['#10B981', '#059669'],
      onPress: () => navigation.navigate('Wallet'),
    },
    {
      id: 'schedule',
      title: 'Schedule Ride',
      subtitle: 'Book for later',
      icon: 'schedule',
      color: '#F59E0B',
      gradient: ['#F59E0B', '#D97706'],
      onPress: () => Alert.alert('Schedule Ride', 'Schedule feature coming soon!'),
    },
    {
      id: 'support',
      title: 'Support',
      subtitle: 'Get help',
      icon: 'support-agent',
      color: '#6366F1',
      gradient: ['#6366F1', '#4F46E5'],
      onPress: () => Alert.alert('Support', 'Contact support at help@raahehaq.com'),
    },
  ];

  const recentRides = [
    {
      id: '1',
      from: 'Iqbal Town',
      to: 'Liberty Market',
      date: 'Today, 2:30 PM',
      fare: '₨ 520',
      status: 'completed',
      rating: 5,
    },
    {
      id: '2',
      from: 'Wapda Town',
      to: 'Model Town',
      date: 'Yesterday, 9:10 AM',
      fare: '₨ 320',
      status: 'completed',
      rating: 4,
    },
  ];

  const offers = [
    {
      id: '1',
      title: '20% Off First Ride',
      description: 'Use code WELCOME20',
      validUntil: 'Dec 31, 2024',
      color: '#FF6B6B',
    },
    {
      id: '2',
      title: 'Free Ride Weekend',
      description: 'Up to ₨ 200 off',
      validUntil: 'This Weekend',
      color: '#4ECDC4',
    },
  ];

  const stats = [
    { label: 'Total Rides', value: '24', icon: 'local-taxi', change: '+12%', changeType: 'positive' },
    { label: 'Rating', value: '4.8', icon: 'star', change: '+0.2', changeType: 'positive' },
    { label: 'Distance', value: '156 km', icon: 'straighten', change: '+23 km', changeType: 'positive' },
    { label: 'Savings', value: '₨ 1,240', icon: 'savings', change: '+₨ 180', changeType: 'positive' },
  ];

  return (
    <ImageBackground
      source={require('../../assets/images/background_raahe_haq.png')}
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

        {/* Enhanced Header with Gradient Background */}
        <View style={[styles.header, styles.headerBackground]}>
          {/* Decorative Elements */}
          <View style={styles.decorativeCircle1} />
          <View style={styles.decorativeCircle2} />
          <View style={styles.decorativeCircle3} />
          <View style={styles.decorativeCircle4} />
          <View style={styles.decorativeCircle5} />

          <Animated.View style={[styles.headerContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.headerTop}>
              <View>
                <Text style={styles.greeting}>
                  Good{' '}
                  {currentTime.getHours() < 12
                    ? 'Morning'
                    : currentTime.getHours() < 18
                    ? 'Afternoon'
                    : 'Evening'}
                  {', '}
                  {user?.name || 'Passenger'}! 👋
                </Text>
                <Text style={styles.timeText}>
                  {currentTime.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: true 
                  })}
                </Text>
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={styles.notificationButton}
                  onPress={() => navigation.navigate('PassengerNotifications')}
                >
                  <Icon name="notifications" size={20} color="white" />
                  {notifications > 0 && (
                    <View style={styles.notificationBadge}>
                      <Text style={styles.notificationText}>{notifications}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.profileButton}
                  onPress={() => navigation.navigate('PassengerPofile')}
                >
                  <Icon name="person" size={24} color="white" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Weather and Location Info */}
            <View style={styles.weatherSection}>
              <View style={styles.weatherInfo}>
                <Icon name="wb-sunny" size={20} color="#FFD700" />
                <Text style={styles.weatherText}>{weatherInfo.temp} • {weatherInfo.condition}</Text>
              </View>
              <View style={styles.locationInfo}>
                <Icon name="location-on" size={16} color="rgba(255,255,255,0.8)" />
                <Text style={styles.locationText} numberOfLines={1} ellipsizeMode="tail">
                  {currentAddress}
                </Text>
              </View>
            </View>

            {/* Status Badge */}
            <View
              style={[
                styles.statusBadge,
                user?.status === 'active'
                  ? styles.statusVerified
                  : styles.statusPending,
              ]}
            >
              <Icon
                name={user?.status === 'active' ? 'verified' : 'schedule'}
                size={16}
                color="white"
              />
              <Text style={styles.statusText}>
                {user?.status === 'active' ? 'Active User' : 'Pending Verification'}
              </Text>
            </View>
          </Animated.View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        >
          {/* Enhanced Stats Cards */}
          <Animated.View style={[styles.statsContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            {stats.map((stat, index) => (
              <View
                key={index}
                style={[
                  styles.statCard,
                  { backgroundColor: theme.colors.surface },
                ]}
              >
                <View style={styles.statHeader}>
                  <Icon name={stat.icon} size={20} color={theme.colors.primary} />
                  <Text style={[styles.statChange, stat.changeType === 'positive' ? styles.statChangePositive : styles.statChangeNegative]} numberOfLines={1} ellipsizeMode="tail">
                    {stat.change}
                  </Text>
                </View>
                <Text style={[styles.statValue, { color: theme.colors.text }]} numberOfLines={1} ellipsizeMode="tail">
                  {stat.value}
                </Text>
                <Text
                  style={[styles.statLabel, { color: theme.colors.mutedText }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {stat.label}
                </Text>
              </View>
            ))}
          </Animated.View>

          {/* Special Offers Section */}
          <Animated.View style={[styles.section, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Special Offers 🎉
              </Text>
              <TouchableOpacity>
                <Text style={[styles.viewAll, { color: theme.colors.primary }]}>View All</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.offersScroll}>
              {offers.map((offer) => (
                <TouchableOpacity
                  key={offer.id}
                  style={[styles.offerCard, { backgroundColor: offer.color }]}
                  onPress={() => Alert.alert(offer.title, offer.description)}
                >
                  <Text style={styles.offerTitle}>{offer.title}</Text>
                  <Text style={styles.offerDescription}>{offer.description}</Text>
                  <Text style={styles.offerValidUntil}>Valid until {offer.validUntil}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>

          {/* Enhanced Quick Actions Grid */}
          <Animated.View style={[styles.section, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Quick Actions ⚡
            </Text>
            <View style={styles.actionsGrid}>
              {quickActions.map((action) => (
                <TouchableOpacity
                  key={action.id}
                  style={styles.actionCard}
                  onPress={action.onPress}
                  activeOpacity={0.8}
                >
                  <View style={[styles.actionGradient, { backgroundColor: action.color }]}>
                    <Icon name={action.icon} size={24} color="white" />
                    <Text style={styles.actionTitle}>{action.title}</Text>
                    <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>

          {/* Recent Rides Section */}
          <Animated.View style={[styles.section, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Recent Rides 🚗
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('RideHistory')}>
                <Text style={[styles.viewAll, { color: theme.colors.primary }]}>View All</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.recentRidesCard, { backgroundColor: theme.colors.surface }]}>
              {recentRides.map((ride, index) => (
                <View key={ride.id}>
                  <TouchableOpacity style={styles.rideItem}>
                    <View style={styles.rideInfo}>
                      <View style={styles.rideRoute}>
                        <View style={styles.rideDot} />
                        <View style={styles.rideLine} />
                        <View style={[styles.rideDot, styles.rideDotEnd]} />
                      </View>
                      <View style={styles.rideDetails}>
                        <Text style={[styles.rideFrom, { color: theme.colors.text }]}>{ride.from}</Text>
                        <Text style={[styles.rideTo, { color: theme.colors.mutedText }]}>{ride.to}</Text>
                        <Text style={[styles.rideDate, { color: theme.colors.mutedText }]}>{ride.date}</Text>
                      </View>
                    </View>
                    <View style={styles.rideRight}>
                      <Text style={[styles.rideFare, { color: theme.colors.primary }]}>{ride.fare}</Text>
                      <View style={styles.rideRating}>
                        <Icon name="star" size={14} color="#FFD700" />
                        <Text style={[styles.rideRatingText, { color: theme.colors.text }]}>{ride.rating}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                  {index < recentRides.length - 1 && (
                    <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
                  )}
                </View>
              ))}
            </View>
          </Animated.View>

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
                onPress={() => logout()}
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
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  weatherSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  weatherInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weatherText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '500',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    flex: 1,
    marginLeft: 4,
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
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
    padding: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  statCard: {
    width: (width - 60) / 2,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  statChange: {
    fontSize: 12,
    fontWeight: '600',
  },
  statChangePositive: {
    color: '#10B981',
  },
  statChangeNegative: {
    color: '#EF4444',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAll: {
    fontSize: 14,
    fontWeight: '600',
  },
  offersScroll: {
    marginTop: 8,
  },
  offerCard: {
    width: 200,
    padding: 16,
    borderRadius: 12,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  offerTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  offerDescription: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    marginBottom: 8,
  },
  offerValidUntil: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    width: (width - 60) / 2,
    marginBottom: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  actionGradient: {
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    minHeight: 120,
    justifyContent: 'center',
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
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
    color: 'white',
  },
  actionSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.9)',
  },
  recentRidesCard: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  rideItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  rideInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rideRoute: {
    alignItems: 'center',
    marginRight: 12,
  },
  rideDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  rideDotEnd: {
    backgroundColor: '#10B981',
  },
  rideLine: {
    width: 2,
    height: 20,
    backgroundColor: '#E5E7EB',
    marginVertical: 2,
  },
  rideDetails: {
    flex: 1,
  },
  rideFrom: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  rideTo: {
    fontSize: 12,
    marginBottom: 2,
  },
  rideDate: {
    fontSize: 11,
  },
  rideRight: {
    alignItems: 'flex-end',
  },
  rideFare: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  rideRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  rideRatingText: {
    fontSize: 12,
    fontWeight: '600',
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
    height: 8,
  },
});
