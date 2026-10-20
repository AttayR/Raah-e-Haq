import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, BottomSheet, ListItem, type BottomSheetHandle } from '../../../components/ui';
import { toast } from '../../../core/toast';
import { t } from '../../../i18n';
import { space } from '../../../theme';
import { otherCount, takenLabels } from '../../saved-places/format';
import type { SavedPlaceEditorParams } from '../../saved-places/navigation';
import type { PickedLocation, SavedPlace } from '../../saved-places/types';
import { hideRecent } from '../hiddenRecents';
import type { RecentDestination } from '../recentDestinations';

export type RecentPlaceAction = 'home' | 'work' | 'place' | 'remove';

type Props = {
  /** The recent the menu is for; null keeps it closed (one instance on Home). */
  recent: RecentDestination | null;
  /** Other places are at the server's cap: "Save place" is dimmed. */
  otherFull: boolean;
  /** Called once the sheet has closed, with the chosen action (none when dismissed). */
  onClose: (recent: RecentDestination, action: RecentPlaceAction | null) => void;
};

/**
 * UI-R9b (passenger-home Interactions): long press on a recent destination chip opens this modal
 * sheet: the place and its address, then Save as Home, Save as Work, Save place and Remove from
 * recents. The action runs after the sheet has animated out.
 */
export function RecentPlaceMenu({ recent, otherFull, onClose }: Props) {
  const sheetRef = useRef<BottomSheetHandle>(null);
  const chosen = useRef<RecentPlaceAction | null>(null);
  // T-565 modal rule: always mounted, opened by `visible`; the last recent keeps its content on
  // screen while the sheet slides out.
  const shown = useRef<RecentDestination | null>(recent);
  if (recent) shown.current = recent;
  const item = shown.current;
  const title = item?.title ?? '';
  const address = item ? item.place.address ?? item.title : '';
  const pick = (action: RecentPlaceAction) => {
    chosen.current = action;
    sheetRef.current?.close();
  };
  return (
    <BottomSheet
      ref={sheetRef}
      mode="modal"
      visible={recent !== null}
      onClose={() => {
        const action = chosen.current;
        chosen.current = null;
        if (item) onClose(item, action);
      }}
      accessibilityLabel={title}
      testID="recent-place-menu"
      header={
        <View style={styles.header}>
          <AppText variant="title" accessibilityRole="header" numberOfLines={1}>
            {title}
          </AppText>
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {address}
          </AppText>
        </View>
      }
    >
      <View style={styles.actions}>
        <ListItem iconStyle="plain" icon="home" title={t('home.recentSaveHome')} chevron={false} onPress={() => pick('home')} testID="recent-place-menu-home" />
        <ListItem iconStyle="plain" icon="work" title={t('home.recentSaveWork')} chevron={false} onPress={() => pick('work')} testID="recent-place-menu-work" />
        <ListItem
          iconStyle="plain"
          icon="bookmark"
          title={t('home.recentSavePlace')}
          chevron={false}
          disabled={otherFull}
          onPress={() => pick('place')}
          testID="recent-place-menu-place"
        />
        <ListItem
          iconStyle="plain"
          icon="delete"
          title={t('home.recentRemove')}
          destructive
          onPress={() => pick('remove')}
          testID="recent-place-menu-remove"
        />
      </View>
    </BottomSheet>
  );
}

/**
 * The saved-place form for a recent (nothing is written until the passenger taps Save there):
 * Save as Home / Work edits the saved Home / Work with this location (a replace), or starts a new
 * one with that label; Save place starts a new "other" place, the name still to be typed.
 */
export const editorParamsForRecent = (
  recent: RecentDestination,
  action: Exclude<RecentPlaceAction, 'remove'>,
  places: ReadonlyArray<SavedPlace>,
  maxOther: number | null,
): SavedPlaceEditorParams => {
  const location: PickedLocation = {
    address: recent.place.address ?? recent.title,
    lat: recent.place.latitude,
    lng: recent.place.longitude,
    placeId: null,
  };
  const label = action === 'place' ? 'other' : action;
  const existing = label === 'other' ? undefined : places.find((place) => place.label === label);
  if (existing) return { place: existing, location };
  return {
    label,
    location,
    taken: takenLabels(places),
    otherFull: maxOther !== null && otherCount(places) >= maxOther,
  };
};

type MenuNavigator = { navigate: (name: 'SavedPlaceEditor', params: SavedPlaceEditorParams) => void };

/** Home's long-press menu state and what each action does (UI-R9b). Stable handlers. */
export function useRecentPlaceMenu(
  navigation: MenuNavigator,
  places: ReadonlyArray<SavedPlace>,
  maxOther: number | null,
) {
  const [recent, setRecent] = useState<RecentDestination | null>(null);
  const latest = useRef({ places, maxOther });
  latest.current = { places, maxOther };
  const open = useCallback((item: RecentDestination) => setRecent(item), []);
  const onClose = useCallback(
    (item: RecentDestination, action: RecentPlaceAction | null) => {
      setRecent(null);
      if (!action) return;
      if (action === 'remove') {
        hideRecent(item.key);
        toast.success(t('home.recentRemoved'));
        return;
      }
      navigation.navigate('SavedPlaceEditor', editorParamsForRecent(item, action, latest.current.places, latest.current.maxOther));
    },
    [navigation],
  );
  const otherFull = maxOther !== null && otherCount(places) >= maxOther;
  return { recent, open, onClose, otherFull };
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space[4], paddingBottom: space[2], gap: space[1] },
  actions: { paddingBottom: space[4] },
});
