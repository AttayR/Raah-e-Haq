import React, { memo, useCallback, useRef } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type SharedValue } from 'react-native-reanimated';
import { AppText, Banner, Button, Chip } from '../../../components/ui';
import { SavedPlaceChips } from '../../saved-places/components/SavedPlaceChips';
import type { SavedPlace } from '../../saved-places/types';
import { t } from '../../../i18n';
import { layout, space } from '../../../theme';
import type { HomeRecentRide } from '../types';
import type { RecentDestination } from '../recentDestinations';
import { HomeRidesSection, type HomeRidesState } from './HomeRidesSection';
import { HomeServiceRow } from './HomeServiceRow';

type BodyProps = {
  /** GET /saved-places (T-516): one chip each; empty while loading or when there are none. */
  savedPlaces: ReadonlyArray<SavedPlace>;
  /** UI-R9: first read of the saved places with nothing cached: skeleton chips. */
  savedPlacesLoading?: boolean;
  /** UI-R9 review: the saved-places read succeeded (cached or answered); gates the Add chip. */
  savedPlacesLoaded?: boolean;
  /** UI-R9: recent destinations from the passenger's finished rides (chips after the places). */
  recents?: ReadonlyArray<RecentDestination>;
  /** A recent destination chip: Booking with it as the destination. */
  onRecent?: (recent: RecentDestination) => void;
  /** A saved place chip: Booking with it as the destination. */
  onSavedPlace: (place: SavedPlace) => void;
  /** "+ Add" ("Add home" while no Home is saved: starts the form on that label). */
  onAddPlace: (label?: 'home') => void;
  /** "Saved places": the full list. */
  onSavedPlaces: () => void;
  /** Location refused or switched off: a chip at peek and the explanation at half. */
  locationOff: boolean;
  onEnableLocation: () => void;
  /** The last rides from GET /rides (none until the API returns some). */
  recentRides: HomeRecentRide[];
  /** UI-R9: skeleton on the first read, ErrorState when it failed with nothing cached. */
  recentRidesState?: HomeRidesState;
  onRetryRides?: () => void;
  onOpenRide: (id: string) => void;
  onSeeAllRides: () => void;
  /**
   * A ride still in progress (T-543): "Return to your ride" takes the place of "Where to?" (a
   * second booking is not possible anyway), with the ride's status line under it. T-559: a
   * parcel says "Track your parcel" with the parcel's own status words (`parcel: true`).
   */
  liveRide?: { status: string; parcel?: boolean } | null;
  onReturnToRide?: () => void;
  /** UI-R20b (V6): the parcel tier is on (S7 value) and nothing is live: the service row shows. */
  servicesVisible: boolean;
  /** Ride card: the "Where to?" handler. Parcel card: Send a parcel. */
  onRide: () => void;
  onParcel: () => void;
  /** The service row counts toward the peek (HomeServiceRow `onShown`). */
  onServicesShown: (shown: boolean) => void;
  /** The service row's natural height with its gap. */
  onServiceRowHeight: (height: number) => void;
  /** The peek group's height above the service row (chips, and "Return" while live), V1. */
  onPeekGroupHeight: (height: number, kind: 'plain' | 'live') => void;
  /** True while the sheet is dragged (the service row's swap waits). */
  hold?: SharedValue<boolean>;
  /** Cold-open entrance (V7). */
  chipsStyle?: StyleProp<ViewStyle>;
  rideStyle?: StyleProp<ViewStyle>;
  parcelStyle?: StyleProp<ViewStyle>;
};

const noop = () => {};

/**
 * Home sheet body (UI-R4 structure, UI-R9 content, UI-R20b order; passenger-home V1): the peek
 * group first (the edge-to-edge outline chip row: "Turn on location" first, T-580; saved places,
 * T-516; recent destinations; "+ Add" / "Add home"; the full list; and while a ride is live
 * "Return to your ride" above it, T-577), then the Ride and Parcel service cards while the
 * parcel tier is on, then at `half`/`full` the location notice and recent rides with their
 * loading and error states. "Where to?" lives in the pinned header (HomeSheetTop). Memoised, so
 * a sheet drag or a map camera move never re-renders it.
 */
function HomeSheetBodyBase({
  savedPlaces,
  savedPlacesLoading = false,
  savedPlacesLoaded = true,
  recents,
  onRecent,
  onSavedPlace,
  onAddPlace,
  onSavedPlaces,
  locationOff,
  onEnableLocation,
  recentRides,
  recentRidesState = 'ready',
  onRetryRides = noop,
  onOpenRide,
  onSeeAllRides,
  liveRide = null,
  onReturnToRide,
  servicesVisible,
  onRide,
  onParcel,
  onServicesShown,
  onServiceRowHeight,
  onPeekGroupHeight,
  hold,
  chipsStyle,
  rideStyle,
  parcelStyle,
}: BodyProps) {
  const live = liveRide !== null && onReturnToRide !== undefined;
  const groupKind = live ? 'live' : 'plain';
  const lastGroup = useRef<{ kind: 'plain' | 'live'; height: number } | null>(null);
  const onGroupLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const height = e.nativeEvent.layout.height;
      const prev = lastGroup.current;
      if (prev && prev.kind === groupKind && Math.abs(prev.height - height) < 1) return;
      lastGroup.current = { kind: groupKind, height };
      onPeekGroupHeight(height, groupKind);
    },
    [groupKind, onPeekGroupHeight],
  );
  return (
    <View style={styles.body}>
      <View onLayout={onGroupLayout} style={styles.group} testID="home-peek-group">
        {liveRide && onReturnToRide ? (
          <View style={styles.live} testID="home-live-ride">
            <Button
              label={liveRide.parcel ? t('parcel.homeReturn') : t('home.returnToRide')}
              size="lg"
              leadingIcon={liveRide.parcel ? 'parcel' : 'rides'}
              onPress={onReturnToRide}
              haptic="impactLight"
              accessibilityHint={liveRide.status}
              testID="home-return-to-ride"
            />
            <AppText variant="bodySmall" color="textSecondary" align="center" numberOfLines={1} testID="home-live-ride-status">
              {liveRide.status}
            </AppText>
          </View>
        ) : null}
        <Animated.View style={chipsStyle}>
          <SavedPlaceChips
            places={savedPlaces}
            loading={savedPlacesLoading && savedPlaces.length === 0}
            loaded={savedPlacesLoaded}
            onPlace={onSavedPlace}
            recents={recents}
            onRecent={onRecent}
            onAdd={onAddPlace}
            onOpenAll={onSavedPlaces}
            leading={
              locationOff ? (
                <Chip
                  variant="outline"
                  icon="locationOff"
                  iconColor="warning"
                  label={t('home.turnOnLocation')}
                  onPress={onEnableLocation}
                  testID="home-location-chip"
                />
              ) : null
            }
          />
        </Animated.View>
      </View>
      <HomeServiceRow
        visible={servicesVisible && !live}
        onRide={onRide}
        onParcel={onParcel}
        onShown={onServicesShown}
        onHeight={onServiceRowHeight}
        hold={hold}
        rideStyle={rideStyle}
        parcelStyle={parcelStyle}
      />
      <View style={styles.more}>
        {locationOff ? (
          <Banner
            tone="warning"
            icon="locationOff"
            title={t('home.locationOffTitle')}
            text={t('home.locationOffBody')}
            action={{ label: t('home.turnOnLocation'), onPress: onEnableLocation, testID: 'home-location-enable' }}
            testID="home-location-banner"
          />
        ) : null}
        <HomeRidesSection
          state={recentRidesState}
          rides={recentRides}
          onOpenRide={onOpenRide}
          onSeeAll={onSeeAllRides}
          onRetry={onRetryRides}
          emptyHint={(recents?.length ?? 0) === 0}
        />
      </View>
    </View>
  );
}

export const HomeSheetBody = memo(HomeSheetBodyBase);

const styles = StyleSheet.create({
  body: { paddingHorizontal: layout.gutter },
  // Chips (32) + 12; while live, "Return" (56) + 8 + status (20) + 12 above them (V1).
  group: { gap: space[3], paddingBottom: space[3] },
  live: { gap: space[2] },
  // 16 under the chip row / cards to the first block at `half` (12 gap already above).
  more: { paddingTop: space[1], gap: space[4] },
});
