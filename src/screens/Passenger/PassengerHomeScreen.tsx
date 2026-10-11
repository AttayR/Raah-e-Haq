import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppDispatch, RootState } from '../../store';
import { getUserProfile } from '../../store/thunks/apiThunks';
import { useNativeLocation } from '../../hooks/useNativeLocation';
import { usePassengerNotifications } from '../../hooks/usePassengerNotifications';
import type { PassengerStackParamList } from '../../app/navigation/stacks/PassengerStack';
import { Screen } from '../../components/ui/Screen';
import { ListGroup } from '../../components/ui/ListGroup';
import { ListItem } from '../../components/ui/ListItem';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { layout, space } from '../../theme';
import { HomeHeader } from '../../features/passenger-home/components/HomeHeader';
import { WhereToBar } from '../../features/passenger-home/components/WhereToBar';
import { OffersRow } from '../../features/passenger-home/components/OffersRow';
import { StatGrid } from '../../features/passenger-home/components/StatGrid';
import { RecentRidesCard } from '../../features/passenger-home/components/RecentRidesCard';
import { greetingFor } from '../../features/passenger-home/greeting';
import { useHomeLocation } from '../../features/passenger-home/useHomeLocation';
import type { HomeOffer, HomeRecentRide, HomeStat } from '../../features/passenger-home/types';
import { AppText } from '../../components/ui/AppText';

// No invented numbers (DESIGN_SYSTEM §0.3): these sections stay hidden until T-506 loads
// stats (BE-08), banners (BE-10) and recent rides (BE-01).
const NO_STATS: HomeStat[] = [];
const NO_OFFERS: HomeOffer[] = [];
const NO_RECENT_RIDES: HomeRecentRide[] = [];

/** The greeting follows the clock (morning → afternoon → evening) while Home stays open. */
const GREETING_REFRESH_MS = 60_000;

/**
 * Passenger Home (docs/design/screens/passenger-home.md, T-604 visual pass): greeting and
 * location, the "Where to?" entry into booking, shortcuts, offers, ride stats and recent
 * rides. Account rows, weather and quick-action tiles moved out (Settings has them).
 * Stats, offers and recent rides render nothing until T-506 wires the API (no fake data).
 */
export default function PassengerHomeScreen() {
  const { theme } = useAppTheme();
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<NativeStackNavigationProp<PassengerStackParamList>>();
  const { user } = useSelector((state: RootState) => state.apiAuth);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => new Date());

  // T-315: no lookups while another screen covers Home; failures show in the header, no alerts.
  const isFocused = useIsFocused();
  const { currentLocation, permissionStatus, error: locationError, requestLocationPermission, openSettings } =
    useNativeLocation({ active: isFocused });
  const location = useHomeLocation(currentLocation, permissionStatus, locationError);
  // Services off, or access refused for good, can only be turned back on in Settings.
  const needsSettings = locationError === 'disabled' || (locationError === 'denied' && !permissionStatus.canAskAgain);
  const enableLocation = needsSettings ? openSettings : requestLocationPermission;

  const {
    isInitialized: notificationsInitialized,
    subscribeToPassengerNotifications,
    unsubscribeFromPassengerNotifications,
  } = usePassengerNotifications(user?.id?.toString());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), GREETING_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (notificationsInitialized && user?.id) {
      subscribeToPassengerNotifications();
      return () => {
        unsubscribeFromPassengerNotifications();
      };
    }
  }, [notificationsInitialized, user?.id, subscribeToPassengerNotifications, unsubscribeFromPassengerNotifications]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Re-read the signed-in user from GET /auth/profile (the old Firebase session refresh is gone).
      await dispatch(getUserProfile());
    } finally {
      setRefreshing(false);
    }
  }, [dispatch]);

  return (
    <Screen testID="passenger-home">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primaryText} colors={[theme.colors.primary]} />
        }
      >
      <View style={styles.gutter}>
        <HomeHeader
          greeting={greetingFor(now, user?.name)}
          name={user?.name}
          photoUri={user?.profile_image_url}
          location={location}
          onOpenProfile={() => navigation.navigate('PassengerPofile')}
          onOpenNotifications={() => navigation.navigate('PassengerNotifications')}
          onEnableLocation={() => {
            enableLocation();
          }}
        />
      </View>

      <View style={styles.gutter}>
        <WhereToBar onPress={() => navigation.navigate('PassengerMap')} />
      </View>

      <View style={styles.gutter}>
        <ListGroup>
          <ListItem
            testID="home-saved-places"
            icon="bookmark"
            title="Saved places"
            subtitle="Home, work and favourites"
            onPress={() => navigation.navigate('FavoriteLocations')}
          />
          <ListItem
            testID="home-wallet"
            icon="wallet"
            title="Wallet"
            subtitle="Balance and history"
            onPress={() => navigation.navigate('Wallet')}
          />
        </ListGroup>
        {NO_RECENT_RIDES.length === 0 ? (
          <AppText variant="bodySmall" color="textSecondary" style={styles.emptyHint} testID="home-recent-empty">
            Your recent places will appear here.
          </AppText>
        ) : null}
      </View>

      <OffersRow offers={NO_OFFERS} />

      <View style={styles.gutter}>
        <StatGrid stats={NO_STATS} />
      </View>

      <View style={styles.gutter}>
        <RecentRidesCard rides={NO_RECENT_RIDES} onSeeAll={() => navigation.navigate('RideHistory')} />
      </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Clipped so content never scrolls behind the status bar / Dynamic Island.
  scroll: { flex: 1, overflow: 'hidden' },
  content: { width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center', paddingTop: space[2], paddingBottom: space[6], gap: layout.sectionGap },
  gutter: { paddingHorizontal: layout.gutter },
  emptyHint: { marginTop: space[3], marginStart: space[4] },
});
