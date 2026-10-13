import React, { useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { PassengerStackParamList } from '../../../app/navigation/stacks/PassengerStack';
import LocationSearch, { suggestionAddress } from '../../../components/passenger/LocationSearch';
import { AppText, Banner, Button, Header, ListGroup, ListItem, Screen, SegmentedControl, TextField } from '../../../components/ui';
import { toast } from '../../../core/toast';
import { t } from '../../../i18n';
import { layout, space } from '../../../theme';
import { savedPlaceErrorMessage } from '../format';
import { saveSavedPlace } from '../hooks';
import type { SavedPlaceEditorParams, SavedPlacesNavigator } from '../navigation';
import type { PickedLocation, SavedPlaceLabel } from '../types';

/** Server limit on `name` (BE-14). */
export const SAVED_PLACE_NAME_MAX = 40;

type Suggestion = Parameters<React.ComponentProps<typeof LocationSearch>['onSelect']>[0];

const initialLabel = (params: SavedPlaceEditorParams): SavedPlaceLabel => {
  if (params.place) return params.place.label;
  if (params.label) return params.label;
  if (!params.taken?.home) return 'home';
  if (!params.taken?.work) return 'work';
  return params.otherFull ? 'home' : 'other';
};

/**
 * Add or edit one saved place (T-516, BE-14). The location comes from the places search
 * (autocomplete, then place details for the coordinates and the place id); then the label
 * (Home / Work / Other) and, for Other, a name. Saving POSTs a new place or PUTs the edit; a 422
 * (label taken, other places at the cap, name) shows under the form, an outside-service-area
 * answer is a warning toast (the place is saved anyway).
 */
export default function SavedPlaceEditorScreen() {
  const navigation = useNavigation<SavedPlacesNavigator>();
  const route = useRoute<RouteProp<PassengerStackParamList, 'SavedPlaceEditor'>>();
  const params: SavedPlaceEditorParams = route.params ?? {};
  const editing = params.place ?? null;

  const [location, setLocation] = useState<PickedLocation | null>(
    editing ? { address: editing.address, lat: editing.lat, lng: editing.lng, placeId: editing.placeId } : null,
  );
  const [searching, setSearching] = useState(!editing);
  const [query, setQuery] = useState('');
  const [label, setLabel] = useState<SavedPlaceLabel>(() => initialLabel(params));
  const [name, setName] = useState(editing?.name ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);

  const labelOptions = useMemo(() => {
    const options: { value: SavedPlaceLabel; label: string }[] = [
      { value: 'home', label: t('savedPlaces.home') },
      { value: 'work', label: t('savedPlaces.work') },
    ];
    if (!params.otherFull || label === 'other') options.push({ value: 'other', label: t('savedPlaces.other') });
    return options;
  }, [params.otherFull, label]);

  // A new home/work replaces the saved one (POST); an edit onto a taken label is a 422 instead.
  const replaces = !editing && (label === 'home' || label === 'work') ? params.taken?.[label] : undefined;

  const onPick = (s: Suggestion) => {
    setLocation({ address: suggestionAddress(s), lat: s.coords.latitude, lng: s.coords.longitude, placeId: s.id || null });
    setSearching(false);
    setQuery('');
    setFormError(null);
  };

  const onSave = async () => {
    if (inFlight.current) return;
    if (!location) {
      setFormError(t('savedPlaces.locationRequired'));
      return;
    }
    const trimmed = name.trim();
    if (label === 'other' && !trimmed) {
      setNameError(t('savedPlaces.nameRequired'));
      return;
    }
    inFlight.current = true;
    setSaving(true);
    setFormError(null);
    try {
      const result = await saveSavedPlace({ ...location, label, name: label === 'other' ? trimmed : null }, editing);
      if (result.outsideServiceArea) {
        toast.warning(t('savedPlaces.outsideTitle'), t('savedPlaces.outsideBody'));
      } else {
        toast.success(t(editing || result.replaced ? 'savedPlaces.updated' : 'savedPlaces.saved'));
      }
      navigation.goBack();
    } catch (cause: unknown) {
      setFormError(savedPlaceErrorMessage(cause, t('savedPlaces.saveFailed')));
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
          <AppText variant="label" color="textSecondary">
            {t('savedPlaces.locationLabel')}
          </AppText>
          {searching || !location ? (
            <LocationSearch
              mode="destination"
              query={query}
              onChangeQuery={setQuery}
              onSelect={onPick}
              placeholder={t('savedPlaces.searchPlaceholder')}
            />
          ) : (
            <ListGroup>
              <ListItem
                icon="pin"
                title={location.address}
                trailing={
                  <Button
                    label={t('savedPlaces.changeLocation')}
                    variant="ghost"
                    size="sm"
                    fullWidth={false}
                    onPress={() => setSearching(true)}
                    accessibilityLabel={t('savedPlaces.changeLocationA11y')}
                    testID="saved-place-change-location"
                  />
                }
                testID="saved-place-location"
              />
            </ListGroup>
          )}
        </View>

        <View style={styles.field}>
          <AppText variant="label" color="textSecondary">
            {t('savedPlaces.labelLabel')}
          </AppText>
          <SegmentedControl<SavedPlaceLabel>
            options={labelOptions}
            value={label}
            onChange={(next) => {
              setLabel(next);
              setFormError(null);
            }}
            accessibilityLabel={t('savedPlaces.labelLabel')}
            testID="saved-place-label"
          />
        </View>

        {label === 'other' ? (
          <TextField
            label={t('savedPlaces.nameLabel')}
            placeholder={t('savedPlaces.namePlaceholder')}
            value={name}
            onChangeText={(text) => {
              setName(text);
              setNameError(null);
            }}
            maxLength={SAVED_PLACE_NAME_MAX}
            autoCapitalize="words"
            returnKeyType="done"
            error={nameError}
            testID="saved-place-name"
          />
        ) : null}

        {replaces ? (
          <Banner
            tone="info"
            icon="info"
            text={t(label === 'home' ? 'savedPlaces.replacesHome' : 'savedPlaces.replacesWork', { address: replaces })}
            testID="saved-place-replaces"
          />
        ) : null}

        {formError ? (
          <AppText variant="bodySmall" color="danger" accessibilityRole="alert" testID="saved-place-error">
            {formError}
          </AppText>
        ) : null}

        <Button
          label={t('savedPlaces.save')}
          onPress={() => {
            onSave();
          }}
          loading={saving}
          testID="saved-place-save"
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.gutter,
    paddingTop: space[3],
    paddingBottom: space[8],
    gap: space[5],
  },
  field: { gap: space[2] },
});
