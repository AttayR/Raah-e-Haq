import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { fetchAutocomplete, fetchPlaceDetails, type PlacesBias } from '../../services/placesService';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { AppText } from '../ui/AppText';
import { Icon, type IconName } from '../ui/Icon';
import { MAX_FONT_SIZE_MULTIPLIER, radius, space, textStyles } from '../../theme';
import { BOOKING_COPY } from '../../features/ride-booking/copy';

type Suggestion = { id: string; title: string; subtitle: string; icon: string; coords: { latitude: number; longitude: number } };

/** "Title, subtitle" of a picked suggestion: the address sent with the ride (T-302). */
export const suggestionAddress = (s: Pick<Suggestion, 'title' | 'subtitle'>): string =>
  s.subtitle && s.subtitle !== s.title ? `${s.title}, ${s.subtitle}` : s.title;

/** Autocomplete state: nothing asked yet, waiting, answered (maybe empty), or failed. */
export type SearchStatus = 'idle' | 'loading' | 'done' | 'error';

type Props = {
  mode: 'pickup' | 'destination';
  query: string;
  onChangeQuery: (q: string) => void;
  onSelect: (s: Suggestion) => void;
  readOnly?: boolean;
  /** Called when the field gains / loses focus (the booking sheet makes room for results). */
  onFocusChange?: (focused: boolean) => void;
  /** Overrides the mode's placeholder (e.g. "Add a stop"). */
  placeholder?: string;
  /** Overrides the leading glyph; `null` hides it (the Raah line dot already marks the row). */
  leadingIcon?: IconName | null;
  /** Shown as a "Set location on map" row after "No places found" or a failed search. */
  onChooseOnMap?: () => void;
  /** Rank suggestions near this point (the rider or the pickup); results stay in Pakistan anyway. */
  near?: PlacesBias;
};

const PLACEHOLDER = { pickup: 'Pickup location', destination: 'Where to?' } as const;
const LEADING_ICON: Record<Props['mode'], IconName> = { pickup: 'origin', destination: 'search' };

/**
 * Address field with Google Places suggestions (passenger-destination-search.md): field 48
 * high on `surfaceAlt`, suggestion rows min 64 with a 40 circle icon, one-line title and
 * subtitle, plus "No places found" and "Search isn't working" states. It searches only for
 * text the passenger typed, never for a prefilled value ("Current location", a ride's
 * address). The lookups themselves are unchanged (T-302/T-303 own them).
 */
const LocationSearch: React.FC<Props> = ({
  mode,
  query,
  onChangeQuery,
  onSelect,
  readOnly,
  onFocusChange,
  placeholder,
  leadingIcon,
  onChooseOnMap,
  near,
}) => {
  const { theme } = useAppTheme();
  const c = theme.colors;
  const [remote, setRemote] = useState<Suggestion[]>([]);
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [focused, setFocused] = useState(false);
  // True once the passenger types in this field; prefilled text is not searched.
  const [edited, setEdited] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  // Read when a search starts; a new GPS fix must not search again.
  const nearRef = useRef(near);
  nearRef.current = near;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (readOnly || !edited || query.length < 2) {
        setRemote([]);
        setStatus('idle');
        return;
      }
      setStatus('loading');
      try {
        const results = await fetchAutocomplete(query, nearRef.current);
        if (cancelled) return;
        const mapped: Suggestion[] = results.map((r) => ({
          id: r.place_id,
          title: r.structured_formatting?.main_text || r.description,
          subtitle: r.structured_formatting?.secondary_text || r.description,
          icon: 'place',
          coords: { latitude: 0, longitude: 0 },
        }));
        setRemote(mapped);
        setStatus('done');
      } catch {
        if (cancelled) return;
        setRemote([]);
        setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [query, readOnly, edited]);

  const pick = async (s: Suggestion) => {
    if (s.coords.latitude === 0) {
      setSelectingId(s.id);
      try {
        const details = await fetchPlaceDetails(s.id);
        if (details) {
          setEdited(false);
          onSelect({ ...s, coords: { latitude: details.latitude, longitude: details.longitude } });
        }
      } finally {
        setSelectingId(null);
      }
      return;
    }
    setEdited(false);
    onSelect(s);
  };

  const setFocus = (value: boolean) => {
    setFocused(value);
    onFocusChange?.(value);
  };

  const glyph = leadingIcon === undefined ? LEADING_ICON[mode] : leadingIcon;
  const showNoResults = status === 'done' && remote.length === 0;
  const showError = status === 'error';

  return (
    <View>
      <View
        style={[
          styles.field,
          { backgroundColor: focused ? c.surface : c.surfaceAlt },
          focused ? { borderColor: c.focusRing } : styles.fieldIdle,
        ]}
      >
        {glyph ? <Icon name={glyph} size={20} color={glyph === 'locate' ? 'primaryText' : 'textSecondary'} /> : null}
        <TextInput
          testID={`location-search-${mode}`}
          accessibilityLabel={mode === 'pickup' ? 'Pickup location' : 'Destination'}
          style={[styles.input, { color: c.textPrimary }]}
          placeholder={placeholder ?? PLACEHOLDER[mode]}
          value={query}
          onChangeText={(q) => {
            setEdited(true);
            onChangeQuery(q);
          }}
          placeholderTextColor={c.textMuted}
          editable={!readOnly}
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          returnKeyType="search"
          autoCorrect={false}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
        />
        {status === 'loading' ? <ActivityIndicator size="small" color={c.textSecondary} testID="location-search-spinner" /> : null}
        {query.length > 0 && !readOnly ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear"
            onPress={() => {
              setEdited(true);
              onChangeQuery('');
            }}
            hitSlop={space[3]}
          >
            <Icon name="clear" size={20} color="textMuted" />
          </Pressable>
        ) : null}
      </View>

      {showError ? (
        <View testID="location-search-error" accessibilityLiveRegion="polite" style={[styles.banner, { backgroundColor: c.dangerSoft }]}>
          <Icon name="warning" size={20} color="danger" />
          <AppText variant="bodySmall" color="danger" style={styles.flex}>
            {BOOKING_COPY.searchFailed}
          </AppText>
        </View>
      ) : null}

      {showNoResults ? (
        <View testID="location-search-empty" accessibilityLiveRegion="polite" style={styles.suggestionItem}>
          <View style={[styles.suggestionIcon, { backgroundColor: c.surfaceAlt }]}>
            <Icon name="search" size={20} color="textSecondary" />
          </View>
          <View style={styles.suggestionText}>
            <AppText variant="title" numberOfLines={1}>
              {BOOKING_COPY.noPlacesTitle}
            </AppText>
            <AppText variant="bodySmall" color="textSecondary" numberOfLines={2}>
              {BOOKING_COPY.noPlacesBody}
            </AppText>
          </View>
        </View>
      ) : null}

      {(showError || showNoResults) && onChooseOnMap ? (
        <Pressable
          testID="location-search-on-map"
          accessibilityRole="button"
          accessibilityLabel={BOOKING_COPY.setLocationOnMap}
          onPress={onChooseOnMap}
          style={({ pressed }) => [styles.suggestionItem, pressed ? { backgroundColor: c.surfacePressed } : null]}
        >
          <View style={[styles.suggestionIcon, { backgroundColor: c.primarySoft }]}>
            <Icon name="pin" size={20} color="primaryText" />
          </View>
          <AppText variant="title" color="primaryText" numberOfLines={1} style={styles.flex}>
            {BOOKING_COPY.setLocationOnMap}
          </AppText>
        </Pressable>
      ) : null}

      {remote.length > 0 ? (
        <View style={styles.suggestionList}>
          {remote.map((s, idx) => (
            <Pressable
              key={s.id}
              testID={`location-suggestion-${idx}`}
              accessibilityRole="button"
              accessibilityLabel={suggestionAddress(s)}
              style={({ pressed }) => [styles.suggestionItem, pressed ? { backgroundColor: c.surfacePressed } : null]}
              onPress={() => pick(s)}
            >
              <View style={[styles.suggestionIcon, { backgroundColor: c.surfaceAlt }]}>
                <Icon name="pin" size={20} color="textSecondary" />
              </View>
              <View style={styles.suggestionText}>
                <AppText variant="title" numberOfLines={1}>
                  {s.title}
                </AppText>
                <AppText variant="bodySmall" color="textSecondary" numberOfLines={1}>
                  {s.subtitle}
                </AppText>
              </View>
              {selectingId === s.id ? <ActivityIndicator size="small" color={c.primaryText} /> : null}
              {idx < remote.length - 1 ? (
                <View style={[styles.divider, { backgroundColor: c.border, height: theme.borderWidth.hairline }]} />
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  field: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 2,
    paddingHorizontal: space[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  fieldIdle: { borderColor: 'transparent' },
  input: { fontSize: textStyles.body.fontSize, fontWeight: textStyles.body.fontWeight, flex: 1, paddingVertical: space[2] },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    borderRadius: radius.md,
    padding: space[3],
    marginTop: space[2],
  },
  flex: { flex: 1 },
  suggestionList: { marginTop: space[1] },
  suggestionItem: {
    minHeight: 64,
    paddingVertical: space[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  suggestionIcon: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  suggestionText: { flex: 1, minWidth: 0 },
  divider: { position: 'absolute', bottom: 0, start: 52, end: 0 },
});

export default LocationSearch;
