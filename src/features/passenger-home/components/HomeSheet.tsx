import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Banner, Chip } from '../../../components/ui';
import { SavedPlaceChips } from '../../saved-places/components/SavedPlaceChips';
import type { SavedPlace } from '../../saved-places/types';
import { t } from '../../../i18n';
import { layout, space } from '../../../theme';
import type { HomeRecentRide } from '../types';
import { RecentRidesCard } from './RecentRidesCard';
import { WhereToBar } from './WhereToBar';

/**
 * §8.3 peek: 24 handle area + greeting 22 + 12 + "Where to?" 52 + 12 + chip row 32 + 16. The
 * sheet sits above the tab bar, so the tab bar is not part of it.
 */
export const HOME_PEEK_HEIGHT = 170;

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
  /** A saved place chip: Booking with it as the destination. */
  onSavedPlace: (place: SavedPlace) => void;
  /** "+ Add": the add-place form. */
  onAddPlace: () => void;
  /** "Saved places": the full list. */
  onSavedPlaces: () => void;
  /** Location refused or switched off: a chip at peek and the explanation at half. */
  locationOff: boolean;
  onEnableLocation: () => void;
  /** The last rides from GET /rides (none until the API returns some). */
  recentRides: HomeRecentRide[];
  onOpenRide: (id: string) => void;
  onSeeAllRides: () => void;
};

/**
 * Home sheet body (UI-R4 structure; UI-R9 refines the content): "Where to?" (pushes Booking),
 * the shortcut chip row, then at `half`/`full` the location notice and recent rides, only when
 * the API returned some. The chip row holds the saved places (T-516, BE-14), "+ Add" and the
 * full list.
 */
export function HomeSheetBody({
  onWhereTo,
  savedPlaces,
  onSavedPlace,
  onAddPlace,
  onSavedPlaces,
  locationOff,
  onEnableLocation,
  recentRides,
  onOpenRide,
  onSeeAllRides,
}: BodyProps) {
  return (
    <View style={styles.body}>
      <WhereToBar onPress={onWhereTo} />
      <View style={styles.chips}>
        <SavedPlaceChips
          places={savedPlaces}
          onPlace={onSavedPlace}
          onAdd={onAddPlace}
          onOpenAll={onSavedPlaces}
          leading={
            locationOff ? (
              <Chip
                icon="locationOff"
                tone="primary"
                label={t('home.turnOnLocation')}
                onPress={onEnableLocation}
                testID="home-location-chip"
              />
            ) : null
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
        <RecentRidesCard rides={recentRides} onSeeAll={onSeeAllRides} onOpen={onOpenRide} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: layout.gutter },
  body: { paddingHorizontal: layout.gutter, paddingTop: space[3] },
  chips: { marginTop: space[3] },
  more: { paddingTop: space[6], gap: space[4] },
});
