import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Banner, Button, Chip } from '../../../components/ui';
import { SavedPlaceChips } from '../../saved-places/components/SavedPlaceChips';
import type { SavedPlace } from '../../saved-places/types';
import { t } from '../../../i18n';
import { componentTokens, layout, space, textStyles } from '../../../theme';
import type { HomeRecentRide } from '../types';
import type { RecentDestination } from '../recentDestinations';
import { HomeRidesSection, type HomeRidesState } from './HomeRidesSection';
import { WHERE_TO_HEIGHT, WhereToBar } from './WhereToBar';

/**
 * §8.3 peek: 24 handle area + greeting 22 + 12 + "Where to?" 52 + 12 + chip row 32 + 16. The
 * sheet sits above the tab bar, so the tab bar is not part of it.
 */
export const HOME_PEEK_HEIGHT = 170;

/**
 * T-577: with a ride in progress "Return to your ride" (56) + 8 + its status line (20) take the
 * place of "Where to?" (52), so the peek grows by the difference and the chip row stays above
 * the tab bar instead of being cut off by it.
 */
export const HOME_LIVE_PEEK_EXTRA =
  componentTokens.button.height.lg + space[2] + textStyles.bodySmall.lineHeight - WHERE_TO_HEIGHT;

/** The Home sheet's peek height: taller while "Return to your ride" shows. */
export const homePeekHeight = (liveRide: boolean): number => HOME_PEEK_HEIGHT + (liveRide ? HOME_LIVE_PEEK_EXTRA : 0);

/** Sheet header (the drag area under the handle): the time-of-day greeting in `title`. */
export function HomeSheetHeader({ greeting }: { greeting: string }) {
  return (
    <View style={styles.header}>
      <AppText variant="title" numberOfLines={1} accessibilityRole="header" testID="home-greeting">
        {greeting}
      </AppText>
    </View>
  );
}

type BodyProps = {
  onWhereTo: () => void;
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
  /** BE-88: "Send a parcel", only while the parcel tier is on (and no ride is in progress). */
  onSendParcel?: () => void;
};

const noop = () => {};

/**
 * Home sheet body (UI-R4 structure, UI-R9 content; passenger-home, DESIGN_SYSTEM §8.3): "Where
 * to?" (pushes Booking), the edge-to-edge shortcut chip row (location off and "Send a parcel"
 * first, T-561/T-580; saved places, T-516; recent destinations; "+ Add" / "Add home"; the full
 * list), then at `half`/`full` the location notice and recent rides with their loading and error
 * states. Memoised, so a sheet drag or a map camera move never re-renders it.
 */
function HomeSheetBodyBase({
  onWhereTo,
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
  onSendParcel,
}: BodyProps) {
  return (
    <View style={styles.body}>
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
      ) : (
        <WhereToBar onPress={onWhereTo} />
      )}
      <View style={styles.chips}>
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
            <>
              {locationOff ? (
                <Chip
                  icon="locationOff"
                  tone="primary"
                  label={t('home.turnOnLocation')}
                  onPress={onEnableLocation}
                  testID="home-location-chip"
                />
              ) : null}
              {/* T-561: in the peek chip row, so it shows without expanding the sheet. */}
              {onSendParcel && !liveRide ? (
                <Chip
                  icon="parcel"
                  tone="primary"
                  label={t('parcel.homeEntryTitle')}
                  onPress={onSendParcel}
                  accessibilityLabel={`${t('parcel.homeEntryTitle')}, ${t('parcel.homeEntrySubtitle')}`}
                  testID="home-send-parcel"
                />
              ) : null}
            </>
          }
        />
      </View>
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
  header: { paddingHorizontal: layout.gutter },
  body: { paddingHorizontal: layout.gutter, paddingTop: space[3] },
  chips: { marginTop: space[3] },
  live: { gap: space[2] },
  more: { paddingTop: space[4], gap: space[4] },
});
