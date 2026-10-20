import React, { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, BottomSheet, ListItem, type BottomSheetHandle } from '../../../components/ui';
import { t } from '../../../i18n';
import { space } from '../../../theme';
import { savedPlaceTitle } from '../format';
import type { SavedPlace } from '../types';

export type SavedPlaceAction = 'ride' | 'pickup' | 'edit' | 'delete';

type Props = {
  /** The place the menu is for; null keeps the sheet closed (one instance per screen). */
  place: SavedPlace | null;
  /** Edit and Delete need the network: dimmed offline (the screen says why on tap). */
  offline: boolean;
  /** Called once the sheet has closed, with the chosen action (none when dismissed). */
  onClose: (place: SavedPlace, action: SavedPlaceAction | null) => void;
};

/**
 * The saved-place row menu (passenger-saved-places §S2): a modal sheet titled with the place and
 * its address, then Ride here, Set as pickup, Edit and Delete (destructive, confirmed by the
 * screen). The action runs after the sheet has animated out.
 */
export function SavedPlaceMenu({ place, offline, onClose }: Props) {
  const sheetRef = useRef<BottomSheetHandle>(null);
  const chosen = useRef<SavedPlaceAction | null>(null);
  if (!place) return null;
  const title = savedPlaceTitle(place);
  const pick = (action: SavedPlaceAction) => {
    chosen.current = action;
    sheetRef.current?.close();
  };
  return (
    <BottomSheet
      ref={sheetRef}
      mode="modal"
      visible
      onClose={() => {
        const action = chosen.current;
        chosen.current = null;
        onClose(place, action);
      }}
      accessibilityLabel={title}
      testID="saved-place-menu"
      header={
        <View style={styles.header}>
          <AppText variant="title" accessibilityRole="header" numberOfLines={1}>
            {title}
          </AppText>
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {place.address}
          </AppText>
        </View>
      }
    >
      <View style={styles.actions}>
        <ListItem iconStyle="plain" icon="pin" title={t('savedPlaces.rideHere')} chevron={false} onPress={() => pick('ride')} testID="saved-place-menu-ride" />
        <ListItem iconStyle="plain" icon="origin" title={t('savedPlaces.setAsPickup')} chevron={false} onPress={() => pick('pickup')} testID="saved-place-menu-pickup" />
        <ListItem
          iconStyle="plain"
          icon="edit"
          title={t('savedPlaces.edit')}
          chevron={false}
          disabled={offline}
          onPress={() => pick('edit')}
          testID="saved-place-menu-edit"
        />
        <ListItem
          iconStyle="plain"
          icon="delete"
          title={t('savedPlaces.delete')}
          destructive
          disabled={offline}
          onPress={() => pick('delete')}
          testID="saved-place-menu-delete"
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space[4], paddingBottom: space[2], gap: space[1] },
  actions: { paddingBottom: space[4] },
});
