import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Chip } from '../../../components/ui';
import { t } from '../../../i18n';
import { space } from '../../../theme';
import { savedPlaceIcon, savedPlaceTitle } from '../format';
import type { SavedPlace } from '../types';

type Props = {
  /** From GET /saved-places (home, work, then others); empty while loading or on failure. */
  places: ReadonlyArray<SavedPlace>;
  /** A place chip: book a ride to it. */
  onPlace: (place: SavedPlace) => void;
  /** "+ Add": the add-place form. */
  onAdd: () => void;
  /** "Saved places": the full list (edit, delete, set as pickup). */
  onOpenAll: () => void;
  /** Chips placed before the saved places (e.g. "Turn on location"). */
  leading?: React.ReactNode;
};

/**
 * Home sheet shortcut row (T-516): one chip per saved place (house / briefcase / map marker and
 * its title), then "+ Add" and "Saved places". One line that scrolls sideways, so the sheet's
 * peek height does not change with the number of places.
 */
export function SavedPlaceChips({ places, onPlace, onAdd, onOpenAll, leading }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.row}
      accessibilityLabel={t('savedPlaces.chipsA11y')}
      testID="home-saved-places-row"
    >
      {leading}
      {places.map((place) => {
        const title = savedPlaceTitle(place);
        return (
          <Chip
            key={place.id}
            icon={savedPlaceIcon(place.label)}
            label={title}
            onPress={() => onPlace(place)}
            accessibilityLabel={`${title}, ${place.address}`}
            testID={`home-saved-place-${place.id}`}
          />
        );
      })}
      <Chip
        icon="add"
        tone="primary"
        label={t('savedPlaces.addShort')}
        onPress={onAdd}
        accessibilityLabel={t('savedPlaces.addA11y')}
        testID="home-saved-place-add"
      />
      <Chip
        icon="bookmark"
        label={t('home.savedPlaces')}
        onPress={onOpenAll}
        accessibilityLabel={t('home.savedPlacesA11y')}
        testID="home-saved-places"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
});
