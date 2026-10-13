import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Button, EmptyState, ErrorState, Header, ListGroup, Screen, SkeletonList, type HeaderAction } from '../../../components/ui';
import { confirm } from '../../../core/dialog';
import { toast } from '../../../core/toast';
import { t } from '../../../i18n';
import { layout, space } from '../../../theme';
import { SavedPlaceRow } from '../components/SavedPlaceRow';
import { otherCount, savedPlaceErrorMessage, savedPlaceTitle, takenLabels } from '../format';
import { useSavedPlaces } from '../hooks';
import { bookingParamsFor, type BookingRole, type SavedPlacesNavigator } from '../navigation';
import type { SavedPlace } from '../types';

/**
 * Account → Saved places (T-516, BE-14): the passenger's Home, Work and other places from
 * GET /saved-places, with loading, error and empty states and pull to refresh. Each place can
 * start a booking as the pickup or the destination, be edited, or be deleted (confirm, then an
 * optimistic removal that comes back if the server refuses). "Add place" opens the form.
 */
export default function SavedPlacesScreen() {
  const { theme } = useAppTheme();
  const navigation = useNavigation<SavedPlacesNavigator>();
  const isFocused = useIsFocused();
  const saved = useSavedPlaces(isFocused);
  const { places, maxOther, refresh, reload, remove } = saved;

  // The spinner shows for a pull only, not for the quiet refresh on focus.
  const [pulling, setPulling] = useState(false);
  useEffect(() => {
    if (pulling && saved.status !== 'refreshing') setPulling(false);
  }, [pulling, saved.status]);
  const onRefresh = useCallback(() => {
    setPulling(true);
    refresh();
  }, [refresh]);

  const others = otherCount(places);
  const otherFull = maxOther !== null && others >= maxOther;

  const openEditor = useCallback(
    (place?: SavedPlace) =>
      navigation.navigate('SavedPlaceEditor', {
        place,
        taken: takenLabels(places, place?.id),
        otherFull: otherFull && place?.label !== 'other',
      }),
    [navigation, places, otherFull],
  );

  const onUse = useCallback(
    (place: SavedPlace, role: BookingRole) => navigation.navigate('Booking', bookingParamsFor(place, role)),
    [navigation],
  );

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

  const addAction: HeaderAction = {
    icon: 'add',
    onPress: () => openEditor(),
    accessibilityLabel: t('savedPlaces.addA11y'),
    testID: 'saved-places-add',
  };
  const loaded = saved.data !== null;

  const renderBody = () => {
    if (!loaded && saved.status === 'loading') return <SkeletonList rows={3} testID="saved-places-loading" />;
    if (!loaded) {
      return (
        <ErrorState
          title={t('savedPlaces.loadFailed')}
          body={saved.error ?? undefined}
          placement="center"
          retryLabel={t('savedPlaces.retry')}
          onRetry={reload}
          testID="saved-places-error"
        />
      );
    }
    if (places.length === 0) {
      return (
        <EmptyState
          icon="bookmark"
          placement="center"
          title={t('savedPlaces.emptyTitle')}
          body={t('savedPlaces.emptyBody')}
          action={{ label: t('savedPlaces.add'), onPress: () => openEditor(), testID: 'saved-places-empty-add' }}
          testID="saved-places-empty"
        />
      );
    }
    return (
      <View style={styles.body}>
        {saved.error ? (
          <AppText variant="bodySmall" color="danger" testID="saved-places-refresh-error">
            {saved.error}
          </AppText>
        ) : null}
        <ListGroup testID="saved-places-list">
          {places.map((place) => (
            <SavedPlaceRow key={place.id} place={place} onUse={onUse} onEdit={openEditor} onDelete={onDelete} />
          ))}
        </ListGroup>
        {maxOther !== null ? (
          <AppText variant="caption" color={otherFull ? 'textSecondary' : 'textMuted'} testID="saved-places-count">
            {otherFull
              ? t('savedPlaces.capReached', { max: maxOther })
              : t('savedPlaces.otherCount', { count: others, max: maxOther })}
          </AppText>
        ) : null}
        <Button label={t('savedPlaces.add')} variant="outline" leadingIcon="add" onPress={() => openEditor()} testID="saved-places-add-button" />
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
        actions={loaded ? [addAction] : undefined}
        testID="saved-places"
      />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          loaded ? (
            <RefreshControl refreshing={pulling} onRefresh={onRefresh} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />
          ) : undefined
        }
      >
        {renderBody()}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center', paddingBottom: space[8] },
  body: { paddingHorizontal: layout.gutter, paddingTop: space[3], gap: space[4] },
});
