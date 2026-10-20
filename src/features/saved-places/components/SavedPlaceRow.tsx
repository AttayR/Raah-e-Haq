import React from 'react';
import { IconButton, ListItem, type IconName } from '../../../components/ui';
import { t } from '../../../i18n';
import { savedPlaceTitle } from '../format';
import type { SavedPlace, SavedPlaceLabel } from '../types';

const LIST_ICONS: Record<SavedPlaceLabel, IconName> = { home: 'home', work: 'work', other: 'bookmark' };

type RowProps = {
  place: SavedPlace;
  /** Row tap: book a ride to this place (the commonest intent, passenger-saved-places §S2). */
  onRide: (place: SavedPlace) => void;
  /** The one `more` menu: Ride here, Set as pickup, Edit, Delete. */
  onMore: (place: SavedPlace) => void;
};

/**
 * One saved place (passenger-saved-places §S2): label glyph tile, "Home" / "Work" or the name,
 * the address (2 lines), and a single `more` button. No buttons under the row and no destructive
 * control on the list itself.
 */
export const SavedPlaceRow = React.memo(function SavedPlaceRow({ place, onRide, onMore }: RowProps) {
  const title = savedPlaceTitle(place);
  const testID = `saved-place-${place.id}`;
  return (
    <ListItem
      variant="content"
      icon={LIST_ICONS[place.label]}
      title={title}
      subtitle={place.address}
      onPress={() => onRide(place)}
      accessibilityLabel={`${title}, ${place.address}`}
      accessibilityHint={t('savedPlaces.rideHere')}
      trailing={
        <IconButton
          icon="more"
          iconColor="textSecondary"
          onPress={() => onMore(place)}
          accessibilityLabel={t('savedPlaces.moreA11y', { name: title })}
          testID={`${testID}-more`}
        />
      }
      testID={`${testID}-item`}
    />
  );
});

/**
 * An empty Home or Work slot (§S2.1): always shown, so the house and the briefcase sit in the
 * same place every time. "Add home" / "Add work" opens the form with that label preset.
 */
export function SavedPlaceSlotRow({ label, onAdd }: { label: 'home' | 'work'; onAdd: (label: 'home' | 'work') => void }) {
  const title = savedPlaceTitle({ label, name: null });
  const action = t(label === 'home' ? 'savedPlaces.addHome' : 'savedPlaces.addWork');
  return (
    <ListItem
      variant="content"
      icon={label === 'home' ? 'homeAdd' : 'work'}
      title={title}
      subtitle={action}
      subtitleColor="primaryText"
      onPress={() => onAdd(label)}
      accessibilityLabel={action}
      testID={`saved-places-slot-${label}`}
    />
  );
}
