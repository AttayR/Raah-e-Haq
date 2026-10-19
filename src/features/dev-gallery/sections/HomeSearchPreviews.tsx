import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import SafeMapView from '../../../components/SafeMapView';
import DualLocationPicker from '../../../components/passenger/DualLocationPicker';
import { BottomSheet, MapControls, type SheetSnap } from '../../../components/ui';
import { HomeSheetBody, HomeSheetHeader, homePeekHeight } from '../../passenger-home/components/HomeSheet';
import { greetingFor } from '../../passenger-home/greeting';
import { toHomeRecentRides } from '../../ride-history/recentRides';
import { BookingSheet } from '../../ride-booking/components/BookingSheet';
import { PlaceShortcutList } from '../../ride-booking/components/PlaceShortcuts';
import { HOME_RECENT_DESTINATIONS, recentDestinations, SEARCH_RECENT_DESTINATIONS } from '../../passenger-home/recentDestinations';
import type { HomeRidesState } from '../../passenger-home/components/HomeRidesSection';
import { BOOKING_COPY } from '../../ride-booking/copy';
import { galleryRecentRides, gallerySavedPlaces } from '../fixtures/homeFixtures';
import { galleryRegion } from '../fixtures/rideFixtures';

/**
 * Debug kit gallery (UI-R9 evidence): the passenger Home sheet and the place search full screen
 * over the styled map, built from the product components with API-shaped saved places and rides.
 * Shown with `-RHKitGallerySection screen-home` (and `-half`, `-empty`, `-loading`, `-error`, `screen-search`), so
 * small-device and dark-mode screenshots need no sign-in. Product screens never import this.
 */
const noop = () => {};
const MORNING = new Date(2026, 9, 19, 9, 0, 0);

function HomeMap() {
  const { theme } = useAppTheme();
  return <SafeMapView style={StyleSheet.absoluteFill} initialRegion={galleryRegion} customMapStyle={theme.mapStyle} />;
}

/** `loading`: first reads in flight; `error`: the rides read failed with nothing cached. */
type HomeState = 'loaded' | 'empty' | 'loading' | 'error';

export function HomeSheetPreview({ snap, state = 'loaded' }: { snap: SheetSnap; state?: HomeState }) {
  const { theme } = useAppTheme();
  const loaded = state === 'loaded';
  const places = loaded ? gallerySavedPlaces : [];
  const rides = loaded ? toHomeRecentRides(galleryRecentRides) : [];
  const recents = loaded ? recentDestinations(galleryRecentRides, gallerySavedPlaces, HOME_RECENT_DESTINATIONS) : [];
  const ridesState: HomeRidesState = state === 'loading' ? 'loading' : state === 'error' ? 'failed' : 'ready';
  return (
    <View style={[styles.fill, { backgroundColor: theme.colors.background }]} testID="gallery-screen-home">
      <HomeMap />
      <MapControls avatar={{ name: 'Ali Raza', onPress: noop, accessibilityLabel: 'Profile' }} onLocate={noop} />
      <BottomSheet
        peekHeight={homePeekHeight(false)}
        initialSnap={snap}
        snapPoints={['peek', 'half', 'full']}
        header={<HomeSheetHeader greeting={greetingFor(MORNING, 'Ali Raza')} />}
      >
        <HomeSheetBody
          onWhereTo={noop}
          savedPlaces={places}
          savedPlacesLoading={state === 'loading'}
          savedPlacesLoaded={state !== 'loading'}
          recents={recents}
          onRecent={noop}
          onSavedPlace={noop}
          onAddPlace={noop}
          onSavedPlaces={noop}
          locationOff={false}
          onEnableLocation={noop}
          recentRides={rides}
          recentRidesState={ridesState}
          onRetryRides={noop}
          onOpenRide={noop}
          onSeeAllRides={noop}
        />
      </BottomSheet>
    </View>
  );
}

export function PlaceSearchPreview() {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.fill, { backgroundColor: theme.colors.background }]} testID="gallery-screen-search">
      <HomeMap />
      <BookingSheet>
        <DualLocationPicker
          pickup={{ latitude: 31.5104, longitude: 74.3442 }}
          destination={null}
          pickupQuery={BOOKING_COPY.currentLocation}
          destQuery=""
          onSelectPickup={noop}
          onSelectDestination={noop}
          onUseCurrentLocation={noop}
          onSwap={noop}
          onChooseOnMapChip={noop}
          renderShortcuts={() => (
            <PlaceShortcutList
              places={gallerySavedPlaces}
              recents={recentDestinations(galleryRecentRides, gallerySavedPlaces, SEARCH_RECENT_DESTINATIONS)}
              loading={false}
              onPick={noop}
            />
          )}
        />
      </BookingSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
