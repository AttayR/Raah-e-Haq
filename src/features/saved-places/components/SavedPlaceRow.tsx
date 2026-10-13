import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, IconButton, ListItem } from '../../../components/ui';
import { t } from '../../../i18n';
import { componentTokens, space } from '../../../theme';
import { savedPlaceIcon, savedPlaceTitle } from '../format';
import type { BookingRole } from '../navigation';
import type { SavedPlace } from '../types';

type Props = {
  place: SavedPlace;
  onUse: (place: SavedPlace, role: BookingRole) => void;
  onEdit: (place: SavedPlace) => void;
  onDelete: (place: SavedPlace) => void;
};

/**
 * One saved place in the list (T-516): the label glyph (home / briefcase / map marker), the title
 * ("Home", "Work" or the name) and the address, Edit and Delete at the end, and the two booking
 * shortcuts under the text.
 */
export function SavedPlaceRow({ place, onUse, onEdit, onDelete }: Props) {
  const title = savedPlaceTitle(place);
  const testID = `saved-place-${place.id}`;
  return (
    <View testID={testID}>
      <ListItem
        variant="content"
        icon={savedPlaceIcon(place.label)}
        title={title}
        subtitle={place.address}
        trailing={
          <View style={styles.trailing}>
            <IconButton
              icon="edit"
              iconColor="textSecondary"
              onPress={() => onEdit(place)}
              accessibilityLabel={t('savedPlaces.editA11y', { name: title })}
              testID={`${testID}-edit`}
            />
            <IconButton
              icon="delete"
              iconColor="danger"
              onPress={() => onDelete(place)}
              accessibilityLabel={t('savedPlaces.deleteA11y', { name: title })}
              testID={`${testID}-delete`}
            />
          </View>
        }
        testID={`${testID}-item`}
      />
      <View style={styles.actions}>
        <Button
          label={t('savedPlaces.setPickup')}
          variant="secondary"
          size="sm"
          fullWidth={false}
          leadingIcon="origin"
          onPress={() => onUse(place, 'pickup')}
          testID={`${testID}-pickup`}
        />
        <Button
          label={t('savedPlaces.setDestination')}
          variant="primary"
          size="sm"
          fullWidth={false}
          leadingIcon="pin"
          onPress={() => onUse(place, 'destination')}
          testID={`${testID}-destination`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  trailing: { flexDirection: 'row', alignItems: 'center' },
  // Aligned with the row's text (after the 40 tile).
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
    paddingStart: componentTokens.listItem.dividerInset.tile,
    paddingEnd: space[4],
    paddingBottom: space[3],
  },
});
