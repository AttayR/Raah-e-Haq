import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, ListItem, SkeletonGroup, SkeletonListItem } from '../../../components/ui';
import { t } from '../../../i18n';
import { componentTokens, layout, space } from '../../../theme';
import { HOME_RECENT_RIDES } from '../../ride-history/recentRides';
import { useRecentRides } from '../../ride-history/hooks';
import { useSavedPlaces } from '../../saved-places/hooks';
import { savedPlaceIcon, savedPlaceTitle, toBookingPlace } from '../../saved-places/format';
import type { SavedPlace } from '../../saved-places/types';
import { recentDestinations, SEARCH_RECENT_DESTINATIONS, type RecentDestination } from '../../passenger-home/recentDestinations';
import { useHiddenRecents } from '../../passenger-home/hiddenRecents';
import type { BookingPlace } from '../buildRideRequest';

/** A shortcut row picked: the point with its address (sent with the ride, T-302). */
export type PlaceShortcutPick = (place: BookingPlace & { address: string }) => void;

type ListProps = {
  places: ReadonlyArray<SavedPlace>;
  recents: ReadonlyArray<RecentDestination>;
  /** First read of the saved places with nothing cached: two skeleton rows. */
  loading: boolean;
  onPick: PlaceShortcutPick;
};

function Divider() {
  const { theme } = useAppTheme();
  return <View style={[styles.divider, { backgroundColor: theme.colors.border, height: theme.borderWidth.hairline }]} />;
}

/**
 * The place search's "Saved places" and "Recent" sections (passenger-destination-search block 4,
 * UI-R9): `overline` headers, content rows (72, 40 tile with house / briefcase / marker or the
 * history glyph, title = label or first part of the address, one-line rest of the address),
 * dividers inset 72. A section with no rows is left out; with neither, nothing renders (the
 * "Choose on map" chip is still there). Pure view, memoised; the data comes from the container.
 */
function PlaceShortcutListBase({ places, recents, loading, onPick }: ListProps) {
  if (!loading && places.length === 0 && recents.length === 0) return null;
  return (
    <View style={styles.wrap} testID="place-shortcuts">
      {loading ? (
        <SkeletonGroup style={styles.bleed} accessibilityLabel={t('placeSearch.loadingA11y')} testID="place-shortcuts-loading">
          <SkeletonListItem />
          <SkeletonListItem />
        </SkeletonGroup>
      ) : places.length > 0 ? (
        <View>
          <AppText variant="overline" color="textMuted" accessibilityRole="header" style={styles.header}>
            {t('placeSearch.savedTitle')}
          </AppText>
          <View style={styles.bleed}>
            {places.map((place, index) => {
              const title = savedPlaceTitle(place);
              return (
                <React.Fragment key={place.id}>
                  {index > 0 ? <Divider /> : null}
                  <ListItem
                    variant="content"
                    icon={savedPlaceIcon(place.label)}
                    title={title}
                    subtitle={place.address}
                    subtitleNumberOfLines={1}
                    chevron={false}
                    onPress={() => onPick({ ...toBookingPlace(place), address: place.address })}
                    accessibilityLabel={t('placeSearch.savedRowA11y', { name: title, address: place.address })}
                    testID={`place-shortcut-saved-${place.id}`}
                  />
                </React.Fragment>
              );
            })}
          </View>
        </View>
      ) : null}
      {recents.length > 0 ? (
        <View>
          <AppText variant="overline" color="textMuted" accessibilityRole="header" style={styles.header}>
            {t('placeSearch.recentTitle')}
          </AppText>
          <View style={styles.bleed}>
            {recents.map((recent, index) => {
              const address = recent.place.address ?? recent.title;
              return (
                <React.Fragment key={recent.key}>
                  {index > 0 ? <Divider /> : null}
                  <ListItem
                    variant="content"
                    icon="history"
                    title={recent.title}
                    subtitle={recent.subtitle || undefined}
                    subtitleNumberOfLines={1}
                    chevron={false}
                    onPress={() => onPick({ ...recent.place, address })}
                    accessibilityLabel={t('placeSearch.recentRowA11y', { address })}
                    testID={`place-shortcut-recent-${index}`}
                  />
                </React.Fragment>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export const PlaceShortcutList = memo(PlaceShortcutListBase);

/**
 * The data side: saved places (GET /saved-places, cached 60 s, T-516) and recent destinations from
 * the latest rides. `reuseCached` takes Home's read of a moment ago (UI-R9), so opening the search
 * from Home costs no request; a read failure just leaves that section out.
 */
function PlaceShortcutsBase({ onPick }: { onPick: PlaceShortcutPick }) {
  const saved = useSavedPlaces(true);
  const rides = useRecentRides(HOME_RECENT_RIDES + 1, true, { reuseCached: true });
  const rideItems = rides.data;
  // UI-R9b: a recent removed on Home is not listed here either.
  const hidden = useHiddenRecents();
  const recents = React.useMemo(
    () => recentDestinations(rideItems ?? [], saved.places, SEARCH_RECENT_DESTINATIONS, hidden),
    [rideItems, saved.places, hidden],
  );
  return (
    <PlaceShortcutList
      places={saved.places}
      recents={recents}
      loading={saved.status === 'loading' && saved.places.length === 0}
      onPick={onPick}
    />
  );
}

export const PlaceShortcuts = memo(PlaceShortcutsBase);

const styles = StyleSheet.create({
  wrap: { gap: space[4] },
  header: { marginBottom: space[1] },
  // Rows pad themselves (16): they run to the sheet's edges like a list.
  bleed: { marginHorizontal: -layout.gutter },
  divider: { marginStart: componentTokens.listItem.dividerInset.tile },
});
