import React, { useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PassengerStackParamList } from '../../../app/navigation/stacks/PassengerStack';
import LocationSearch, { suggestionAddress } from '../../../components/passenger/LocationSearch';
import { AppText, Banner, Button, Card, FieldLabel, Header, Icon, Screen, SegmentedControl, TextField } from '../../../components/ui';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { firstFieldMessages, toApiError } from '../../../core/api/errors';
import { toast } from '../../../core/toast';
import { t } from '../../../i18n';
import { componentTokens, layout, radius, space } from '../../../theme';
import { savedPlaceErrorMessage } from '../format';
import { saveSavedPlace } from '../hooks';
import type { SavedPlaceEditorParams, SavedPlacesNavigator } from '../navigation';
import type { PickedLocation, SavedPlaceLabel } from '../types';

/** Server limit on `name` (BE-14). */
export const SAVED_PLACE_NAME_MAX = 40;

type Suggestion = Parameters<React.ComponentProps<typeof LocationSearch>['onSelect']>[0];

/** A new place may not take a Home/Work slot that is already saved (edit it from the list). */
const isTaken = (params: SavedPlaceEditorParams, label: SavedPlaceLabel): boolean =>
  !params.place && (label === 'home' || label === 'work') && !!params.taken?.[label];

const initialLabel = (params: SavedPlaceEditorParams): SavedPlaceLabel => {
  if (params.place) return params.place.label;
  if (params.label && !isTaken(params, params.label)) return params.label;
  if (!params.taken?.home) return 'home';
  if (!params.taken?.work) return 'work';
  return params.otherFull ? 'home' : 'other';
};

/** A save error goes under its control (label / name) when the server names one, else in the Banner. */
const splitError = (cause: unknown): { label?: string; name?: string; form?: string } => {
  const apiError = toApiError(cause);
  if (apiError.kind === 'validation') {
    const fields = firstFieldMessages(apiError.fieldErrors);
    if (fields.label) return { label: fields.label };
    if (fields.name) return { name: fields.name };
  }
  return { form: savedPlaceErrorMessage(cause, t('savedPlaces.saveFailed')) };
};

/**
 * Add or edit one saved place (passenger-saved-places §S3; data T-516 / BE-14). The location
 * comes from the places search (autocomplete, then details for the coordinates and the place
 * id) and then shows in full; then the label (a Home/Work slot already saved is not offered for
 * a new place) and, for Other, a name with a counter. "Save place" sits in a sticky footer and
 * stays disabled until the form is complete. A 422 shows under its control, anything else in a
 * Banner; an outside-service-area answer is a warning toast (the place is saved anyway).
 */
export default function SavedPlaceEditorScreen() {
  const navigation = useNavigation<SavedPlacesNavigator>();
  const route = useRoute<RouteProp<PassengerStackParamList, 'SavedPlaceEditor'>>();
  const params: SavedPlaceEditorParams = route.params ?? {};
  const editing = params.place ?? null;
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();

  const [location, setLocation] = useState<PickedLocation | null>(
    params.location ??
      (editing ? { address: editing.address, lat: editing.lat, lng: editing.lng, placeId: editing.placeId } : null),
  );
  const [searching, setSearching] = useState(!editing && !params.location);
  const [query, setQuery] = useState('');
  const [label, setLabel] = useState<SavedPlaceLabel>(() => initialLabel(params));
  const [name, setName] = useState(editing?.name ?? '');
  const [errors, setErrors] = useState<{ label?: string; name?: string; form?: string }>({});
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);

  const labelOptions: { value: SavedPlaceLabel; label: string; disabled?: boolean }[] = [
    { value: 'home', label: t('savedPlaces.home'), disabled: isTaken(params, 'home') },
    { value: 'work', label: t('savedPlaces.work'), disabled: isTaken(params, 'work') },
  ];
  if (!params.otherFull || label === 'other') labelOptions.push({ value: 'other', label: t('savedPlaces.other') });

  const takenHelpers = [
    isTaken(params, 'home') ? t('savedPlaces.takenHome') : null,
    isTaken(params, 'work') ? t('savedPlaces.takenWork') : null,
  ].filter((line): line is string => !!line);

  const trimmed = name.trim();
  const complete = !!location && (label !== 'other' || trimmed.length > 0);

  const onPick = (s: Suggestion) => {
    setLocation({ address: suggestionAddress(s), lat: s.coords.latitude, lng: s.coords.longitude, placeId: s.id || null });
    setSearching(false);
    setQuery('');
    setErrors({});
  };

  const onSave = async () => {
    if (inFlight.current || !location || !complete) return;
    inFlight.current = true;
    setSaving(true);
    setErrors({});
    try {
      const result = await saveSavedPlace({ ...location, label, name: label === 'other' ? trimmed : null }, editing);
      if (result.outsideServiceArea) {
        toast.warning(t('savedPlaces.outsideTitle'), t('savedPlaces.outsideBody'));
      } else {
        toast.success(t(editing || result.replaced ? 'savedPlaces.updated' : 'savedPlaces.saved'));
      }
      navigation.goBack();
    } catch (cause: unknown) {
      setErrors(splitError(cause));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  return (
    <Screen testID="saved-place-editor" keyboardAvoiding>
      <Header
        tone="background"
        title={t(editing ? 'savedPlaces.editTitle' : 'savedPlaces.addTitle')}
        backLabel={t('savedPlaces.back')}
        onBack={() => navigation.goBack()}
        testID="saved-place-editor-header"
      />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.field}>
          <FieldLabel>{t('savedPlaces.locationLabel')}</FieldLabel>
          {searching || !location ? (
            <LocationSearch
              mode="destination"
              query={query}
              onChangeQuery={setQuery}
              onSelect={onPick}
              placeholder={t('savedPlaces.searchPlaceholder')}
            />
          ) : (
            <Card testID="saved-place-location">
              <View style={styles.locationRow}>
                <View style={[styles.tile, { backgroundColor: theme.colors.surfaceAlt }]}>
                  <Icon name="pin" />
                </View>
                <AppText variant="body" style={styles.address}>
                  {location.address}
                </AppText>
                <Button
                  label={t('savedPlaces.changeLocation')}
                  variant="ghost"
                  size="sm"
                  fullWidth={false}
                  onPress={() => setSearching(true)}
                  accessibilityLabel={t('savedPlaces.changeLocationA11y')}
                  testID="saved-place-change-location"
                />
              </View>
            </Card>
          )}
        </View>

        <View style={styles.field}>
          <FieldLabel>{t('savedPlaces.labelLabel')}</FieldLabel>
          <SegmentedControl<SavedPlaceLabel>
            options={labelOptions}
            value={label}
            onChange={(next) => {
              setLabel(next);
              setErrors({});
            }}
            accessibilityLabel={t('savedPlaces.labelLabel')}
            testID="saved-place-label"
          />
          {errors.label ? (
            <AppText variant="bodySmall" color="danger" accessibilityRole="alert" testID="saved-place-error">
              {errors.label}
            </AppText>
          ) : null}
          {takenHelpers.map((line) => (
            <AppText key={line} variant="caption" color="textSecondary" testID="saved-place-taken">
              {line}
            </AppText>
          ))}
        </View>

        {label === 'other' ? (
          <View>
            <TextField
              label={t('savedPlaces.nameLabel')}
              placeholder={t('savedPlaces.namePlaceholder')}
              value={name}
              onChangeText={(text) => {
                setName(text);
                setErrors((current) => ({ ...current, name: undefined }));
              }}
              maxLength={SAVED_PLACE_NAME_MAX}
              autoCapitalize="words"
              returnKeyType="done"
              error={errors.name ?? null}
              testID="saved-place-name"
            />
            <AppText variant="caption" color="textMuted" style={styles.counter} testID="saved-place-name-counter">
              {t('common.counter', { count: name.length, max: SAVED_PLACE_NAME_MAX })}
            </AppText>
          </View>
        ) : null}

        {errors.form ? <Banner tone="danger" text={errors.form} actionPlacement="below" testID="saved-place-error" /> : null}
      </ScrollView>
      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom + layout.bottomActionOffset, layout.bottomActionMinOffset),
            borderTopColor: theme.colors.border,
            borderTopWidth: theme.borderWidth.hairline,
            backgroundColor: theme.colors.background,
          },
        ]}
      >
        <Button
          label={t('savedPlaces.save')}
          size="lg"
          onPress={() => {
            onSave();
          }}
          disabled={!complete}
          loading={saving}
          testID="saved-place-save"
        />
      </View>
    </Screen>
  );
}

const k = componentTokens.listItem;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.gutter,
    paddingTop: space[2],
    paddingBottom: space[6],
    gap: space[6],
  },
  field: { gap: space[2] },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  tile: { width: k.tile, height: k.tile, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  address: { flex: 1, minWidth: 0 },
  counter: { alignSelf: 'flex-end', marginTop: space[1] },
  footer: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.gutter,
    paddingTop: space[2],
  },
});
