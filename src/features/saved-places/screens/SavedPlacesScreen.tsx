import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import {
  AppText,
  Banner,
  Button,
  ErrorState,
  Header,
  ListGroup,
  OfflineBanner,
  Screen,
  useIsOffline,
  type HeaderAction,
} from '../../../components/ui';
import { confirm } from '../../../core/dialog';
import { toast } from '../../../core/toast';
import { t } from '../../../i18n';
import { componentTokens, layout, motion, space } from '../../../theme';
import { SavedPlaceMenu, type SavedPlaceAction } from '../components/SavedPlaceMenu';
import { SavedPlaceRow, SavedPlaceSlotRow } from '../components/SavedPlaceRow';
import { SavedPlacesSkeleton } from '../components/SavedPlacesSkeleton';
import { otherCount, savedPlaceErrorMessage, savedPlaceTitle, takenLabels } from '../format';
import { useSavedPlaces } from '../hooks';
import { bookingParamsFor, type BookingRole, type SavedPlacesNavigator } from '../navigation';
import type { SavedPlace, SavedPlaceLabel } from '../types';

const rowExit = FadeOut.duration(motion.exit.duration);
const rowLayout = LinearTransition.duration(motion.base.duration);

/**
 * Account → Saved places (passenger-saved-places.md, UI-R16; data T-516 / BE-14). Home and Work
 * are slots that always show ("Add home" when empty); other places follow under their own
 * heading. A row tap books a ride there; one `more` menu holds Ride here, Set as pickup, Edit and
 * Delete (confirm, optimistic removal that comes back if the server refuses). A failed refresh
 * keeps the list under a Banner with Retry; a failed first load is an ErrorState.
 */
export default function SavedPlacesScreen() {
  const { theme } = useAppTheme();
  const navigation = useNavigation<SavedPlacesNavigator>();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const offline = useIsOffline();
  const reduced = useReducedMotion();
  const saved = useSavedPlaces(isFocused);
  const { places, maxOther, refresh, reload, remove } = saved;
  const [menuPlace, setMenuPlace] = useState<SavedPlace | null>(null);

  // The spinner shows for a pull only, not for the quiet refresh on focus.
  const [pulling, setPulling] = useState(false);
  useEffect(() => {
    if (pulling && saved.status !== 'refreshing') setPulling(false);
  }, [pulling, saved.status]);
  const onRefresh = useCallback(() => {
    setPulling(true);
    refresh();
  }, [refresh]);

  const others = useMemo(
    () => places.filter((p) => p.label === 'other').sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
    [places],
  );
  const homePlace = places.find((p) => p.label === 'home') ?? null;
  const workPlace = places.find((p) => p.label === 'work') ?? null;
  const otherFull = maxOther !== null && otherCount(places) >= maxOther;

  const openEditor = useCallback(
    (place?: SavedPlace, label?: SavedPlaceLabel) => {
      if (offline) {
        toast.warning(t('savedPlaces.offline'));
        return;
      }
      navigation.navigate('SavedPlaceEditor', {
        place,
        label,
        taken: takenLabels(places, place?.id),
        otherFull: otherFull && place?.label !== 'other',
      });
    },
    [navigation, places, otherFull, offline],
  );

  const book = useCallback(
    (place: SavedPlace, role: BookingRole) => navigation.navigate('Booking', bookingParamsFor(place, role)),
    [navigation],
  );
  const onRide = useCallback((place: SavedPlace) => book(place, 'destination'), [book]);

  const onDelete = useCallback(
    async (place: SavedPlace) => {
      const name = savedPlaceTitle(place);
      const yes = await confirm({
        title: t('savedPlaces.deleteTitle', { name }),
        body: t('savedPlaces.deleteBody'),
        confirmLabel: t('savedPlaces.delete'),
        destructive: true,
      });
      if (!yes) return;
      try {
        await remove(place);
        toast.success(t('savedPlaces.deleted'));
      } catch (cause: unknown) {
        toast.error(savedPlaceErrorMessage(cause, t('savedPlaces.deleteFailed')));
      }
    },
    [remove],
  );

  const onMenuClosed = useCallback(
    (place: SavedPlace, action: SavedPlaceAction | null) => {
      setMenuPlace(null);
      if (action === 'ride') book(place, 'destination');
      else if (action === 'pickup') book(place, 'pickup');
      else if (action === 'edit') openEditor(place);
      else if (action === 'delete') onDelete(place);
    },
    [book, openEditor, onDelete],
  );

  const loaded = saved.data !== null;
  const addAction: HeaderAction = {
    icon: 'add',
    onPress: () => openEditor(undefined, 'other'),
    accessibilityLabel: t('savedPlaces.addA11y'),
    testID: 'saved-places-add',
  };

  const renderRow = (place: SavedPlace) => (
    <Animated.View key={place.id} exiting={reduced ? undefined : rowExit} layout={reduced ? undefined : rowLayout} testID={`saved-place-${place.id}`}>
      <SavedPlaceRow place={place} onRide={onRide} onMore={setMenuPlace} />
    </Animated.View>
  );

  const renderBody = () => {
    if (!loaded && saved.status === 'loading') return <SavedPlacesSkeleton />;
    if (!loaded) {
      return (
        <ErrorState
          title={t('savedPlaces.loadFailed')}
          body={saved.error ?? undefined}
          retryLabel={t('savedPlaces.retry')}
          onRetry={reload}
          testID="saved-places-error"
        />
      );
    }
    return (
      <View style={styles.body}>
        {saved.error ? (
          <Banner
            tone="warning"
            text={t('savedPlaces.refreshFailed')}
            action={{ label: t('savedPlaces.refreshRetry'), onPress: onRefresh, testID: 'saved-places-refresh-retry' }}
            testID="saved-places-refresh-error"
          />
        ) : null}
        <ListGroup testID="saved-places-slots">
          {homePlace ? renderRow(homePlace) : <SavedPlaceSlotRow label="home" onAdd={(label) => openEditor(undefined, label)} />}
          {workPlace ? renderRow(workPlace) : <SavedPlaceSlotRow label="work" onAdd={(label) => openEditor(undefined, label)} />}
        </ListGroup>
        {others.length > 0 ? (
          <ListGroup title={t('savedPlaces.otherGroup')} testID="saved-places-list">
            {others.map(renderRow)}
          </ListGroup>
        ) : null}
        {places.length === 0 ? (
          <View style={styles.intro} testID="saved-places-empty">
            <AppText variant="bodySmall" color="textSecondary" align="center" style={styles.introText}>
              {t('savedPlaces.intro')}
            </AppText>
            <Button
              variant="secondary"
              size="md"
              fullWidth={false}
              label={t('savedPlaces.addAnother')}
              onPress={() => openEditor(undefined, 'other')}
              testID="saved-places-empty-add"
            />
          </View>
        ) : maxOther !== null ? (
          <AppText variant="caption" color="textSecondary" style={styles.caption} testID="saved-places-count">
            {otherFull
              ? t('savedPlaces.capReached', { max: maxOther })
              : t('savedPlaces.otherCount', { count: others.length, max: maxOther })}
          </AppText>
        ) : null}
      </View>
    );
  };

  return (
    <Screen testID="saved-places-screen">
      <Header
        tone="background"
        title={t('savedPlaces.title')}
        backLabel={t('savedPlaces.back')}
        onBack={() => navigation.goBack()}
        actions={loaded && !otherFull ? [addAction] : undefined}
        testID="saved-places"
      />
      <OfflineBanner style={styles.offline} testID="saved-places-offline" />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + space[2], space[8]) }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          loaded ? (
            <RefreshControl refreshing={pulling} onRefresh={onRefresh} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />
          ) : undefined
        }
      >
        {renderBody()}
      </ScrollView>
      <SavedPlaceMenu place={menuPlace} offline={offline} onClose={onMenuClosed} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  offline: { marginHorizontal: layout.gutter, marginBottom: space[2] },
  content: { flexGrow: 1, width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center' },
  body: { paddingHorizontal: layout.gutter, paddingTop: space[2], gap: layout.sectionGap },
  caption: { marginTop: space[2] - layout.sectionGap, paddingHorizontal: space[4] },
  intro: { alignItems: 'center', gap: space[4], marginTop: space[4] - layout.sectionGap },
  introText: { maxWidth: componentTokens.emptyState.maxWidth },
});
