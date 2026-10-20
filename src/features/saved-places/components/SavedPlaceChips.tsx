import React, { memo, useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { Chip, LinearFade, Skeleton, SkeletonGroup } from '../../../components/ui';
import { t } from '../../../i18n';
import { componentTokens, layout, space } from '../../../theme';
import type { RecentDestination } from '../../passenger-home/recentDestinations';
import { savedPlaceIcon, savedPlaceTitle } from '../format';
import type { SavedPlace } from '../types';

type Props = {
  /** From GET /saved-places (home, work, then others); empty while loading or on failure. */
  places: ReadonlyArray<SavedPlace>;
  /** First load of the saved places with nothing to show yet: skeleton chips (§12.6). */
  loading?: boolean;
  /**
   * The saved-places read succeeded (ready / refreshing / cached). Only then is the Add chip
   * shown: after a failed read a passenger whose Home exists is never offered "Add home".
   */
  loaded?: boolean;
  /** A place chip: book a ride to it. */
  onPlace: (place: SavedPlace) => void;
  /** UI-R9: where the passenger went lately (their finished rides); one chip each after the places. */
  recents?: ReadonlyArray<RecentDestination>;
  onRecent?: (recent: RecentDestination) => void;
  /**
   * "+ Add": the add-place form. Without a saved Home it reads "Add home" and `onAdd('home')`
   * starts the form on that label (passenger-home "Empty (new account)").
   */
  onAdd: (label?: 'home') => void;
  /** "Saved places": the full list (edit, delete, set as pickup). */
  onOpenAll: () => void;
  /** Chips placed before the saved places (e.g. "Turn on location"). */
  leading?: React.ReactNode;
};

/** At most 2 place chips (passenger-home 4.3); the full list is one tap away. */
export const MAX_PLACE_CHIPS = 2;
const LABEL_ORDER = { home: 0, work: 1, other: 2 } as const;

/** Home and Work first, then the others in server order, capped at 2. */
export const placeChips = (places: ReadonlyArray<SavedPlace>): SavedPlace[] =>
  places
    .map((place, index) => ({ place, index }))
    .sort((a, b) => LABEL_ORDER[a.place.label] - LABEL_ORDER[b.place.label] || a.index - b.index)
    .slice(0, MAX_PLACE_CHIPS)
    .map(({ place }) => place);

/** Skeleton chip widths: short, medium, short (mirrors Home / Work / Add). */
const SKELETON_WIDTHS = [space[16] + space[2], space[16] + space[6], space[16]] as const;

/**
 * Home sheet shortcut row (T-516, UI-R9; DESIGN_SYSTEM §8.3 chip row): the leading chips, up to
 * 2 saved places (Home and Work first; house / briefcase / map marker and its title), up to 3 recent
 * destinations (history glyph, first part of the address), then "+ Add" ("Add home" while no Home
 * is saved; only once the saved places loaded) and "Saved places". One line that scrolls sideways edge to edge (it bleeds past the
 * sheet gutter so a cut chip reads as "more"), so the peek height never changes with the count.
 */
function SavedPlaceChipsBase({ places, loading = false, loaded = true, onPlace, recents = [], onRecent, onAdd, onOpenAll, leading }: Props) {
  const { theme } = useAppTheme();
  const hasHome = places.some(place => place.label === 'home');
  // UI-R20b (V5): the trailing fade shows only while the chips are wider than the row.
  const [rowWidth, setRowWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const onRowLayout = useCallback((e: LayoutChangeEvent) => setRowWidth(Math.round(e.nativeEvent.layout.width)), []);
  const onContentSize = useCallback((width: number) => setContentWidth(Math.round(width)), []);
  const overflowing = rowWidth > 0 && contentWidth > rowWidth;
  return (
    <View style={styles.bleed} onLayout={onRowLayout}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.row}
        onContentSizeChange={onContentSize}
        accessibilityLabel={t('savedPlaces.chipsA11y')}
        testID="home-saved-places-row"
      >
        {leading}
        {loading ? (
          <SkeletonGroup style={styles.skeletons} accessibilityLabel={t('home.shortcutsLoadingA11y')} testID="home-saved-places-loading">
            {SKELETON_WIDTHS.map((width, index) => (
              <Skeleton key={index} width={width} height={componentTokens.chip.height} shape="pill" />
            ))}
          </SkeletonGroup>
        ) : (
          placeChips(places).map(place => {
            const title = savedPlaceTitle(place);
            return (
              <Chip
                key={place.id}
                variant="outline"
                icon={savedPlaceIcon(place.label)}
                label={title}
                onPress={() => onPlace(place)}
                accessibilityLabel={`${title}, ${place.address}`}
                testID={`home-saved-place-${place.id}`}
              />
            );
          })
        )}
        {onRecent
          ? recents.map((recent, index) => (
              <Chip
                key={recent.key}
                variant="outline"
                icon="history"
                style={styles.recent}
                label={recent.title}
                onPress={() => onRecent(recent)}
                accessibilityLabel={t('home.recentPlaceA11y', { address: recent.place.address ?? recent.title })}
                testID={`home-recent-place-${index}`}
              />
            ))
          : null}
        {loading || !loaded ? null : hasHome ? (
          <Chip
            variant="outline"
            icon="add"
            tone="primary"
            label={t('savedPlaces.addShort')}
            onPress={() => onAdd()}
            accessibilityLabel={t('savedPlaces.addA11y')}
            testID="home-saved-place-add"
          />
        ) : (
          <Chip
            variant="outline"
            icon="homeAdd"
            tone="primary"
            label={t('savedPlaces.addHome')}
            onPress={() => onAdd('home')}
            accessibilityLabel={t('home.addHomeA11y')}
            testID="home-saved-place-add"
          />
        )}
        <Chip
          variant="outline"
          icon="bookmark"
          label={t('home.savedPlaces')}
          onPress={onOpenAll}
          accessibilityLabel={t('home.savedPlacesA11y')}
          testID="home-saved-places"
        />
      </ScrollView>
      {overflowing ? (
        <LinearFade color={theme.colors.surface} direction="toEnd" style={styles.fade} testID="home-saved-places-fade" />
      ) : null}
    </View>
  );
}

/** Memoised: the Home map's camera and sheet height changes never re-render the chip row. */
export const SavedPlaceChips = memo(SavedPlaceChipsBase);

const styles = StyleSheet.create({
  bleed: { marginHorizontal: -layout.gutter },
  // UI-R20b (V5): exactly the content inset wide, so it never covers the last chip at the scroll end.
  fade: { position: 'absolute', top: 0, bottom: 0, end: 0, width: componentTokens.home.chipFadeWidth },
  recent: { maxWidth: componentTokens.home.recentChipMaxWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2], paddingHorizontal: layout.gutter },
  skeletons: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
});
