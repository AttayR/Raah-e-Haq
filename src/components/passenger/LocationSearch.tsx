import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { fetchAutocomplete, fetchPlaceDetails, type PlacesBias } from '../../services/placesService';
import { MIN_AUTOCOMPLETE_CHARS, newPlacesSessionToken } from '../../services/placesSession';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { AppText } from '../ui/AppText';
import { Icon, type IconName } from '../ui/Icon';
import { MAX_FONT_SIZE_MULTIPLIER, radius, space, textStyles } from '../../theme';
import { BOOKING_COPY } from '../../features/ride-booking/copy';

type Suggestion = { id: string; title: string; subtitle: string; icon: string; coords: { latitude: number; longitude: number } };

/** "Title, subtitle" of a picked suggestion: the address sent with the ride (T-302). */
export const suggestionAddress = (s: Pick<Suggestion, 'title' | 'subtitle'>): string =>
  s.subtitle && s.subtitle !== s.title ? `${s.title}, ${s.subtitle}` : s.title;

/**
 * The field's text after the passenger edits a label that typing replaces ("Current location",
 * T-551): text typed before, after or inside the label keeps only what was typed, one deleted
 * character (Backspace) empties the field, anything else (the selected label replaced) is kept.
 */
export const replaceLabelEdit = (label: string, typed: string): string => {
  if (typed.length > label.length) {
    let start = 0;
    while (start < label.length && typed[start] === label[start]) start += 1;
    const tail = label.slice(start);
    return typed.endsWith(tail) ? typed.slice(start, typed.length - tail.length) : typed;
  }
  if (typed.length === label.length - 1) {
    let start = 0;
    while (start < typed.length && typed[start] === label[start]) start += 1;
    if (label.slice(start + 1) === typed.slice(start)) return '';
  }
  return typed;
};

/** Autocomplete state: nothing asked yet, waiting, answered (maybe empty), or failed. */
export type SearchStatus = 'idle' | 'loading' | 'done' | 'error';

type Props = {
  mode: 'pickup' | 'destination';
  /**
   * The text the field shows when the screen sets it ("Current location", a ride's address, a
   * reset). What the passenger types stays in this component (T-534, PERF-10): a new `query`
   * (or a new `queryRevision`) replaces it.
   */
  query: string;
  /** Bump to put `query` back in the field even when its text did not change (e.g. a reset). */
  queryRevision?: number;
  /** Optional: every keystroke, for small screens that keep the text themselves. */
  onChangeQuery?: (q: string) => void;
  onSelect: (s: Suggestion) => void;
  readOnly?: boolean;
  /** Called when the field gains / loses focus (the booking sheet makes room for results). */
  onFocusChange?: (focused: boolean) => void;
  /** Overrides the mode's placeholder (e.g. "Add a stop"). */
  placeholder?: string;
  /**
   * Overrides the leading glyph; `null` hides it (the Raah line dot already marks the row). A
   * function gets the field's current text.
   */
  leadingIcon?: IconName | null | ((text: string) => IconName | null);
  /** Shown as a "Set location on map" row after "No places found" or a failed search. */
  onChooseOnMap?: () => void;
  /** Rank suggestions near this point (the rider or the pickup); results stay in Pakistan anyway. */
  near?: PlacesBias;
  /**
   * Labels, not addresses ("Current location", "Pinned on map"): while the field shows one, focus
   * selects it and typing replaces it instead of adding to it (T-551).
   */
  replaceOnType?: string | readonly string[];
};

const PLACEHOLDER = { pickup: 'Pickup location', destination: 'Where to?' } as const;
const LEADING_ICON: Record<Props['mode'], IconName> = { pickup: 'origin', destination: 'search' };
/** T-534 (PERF-10): one lookup after the passenger pauses typing, not one per keystroke. */
export const AUTOCOMPLETE_DEBOUNCE_MS = 300;

/**
 * Address field with Google Places suggestions (passenger-destination-search.md): field 48
 * high on `surfaceAlt`, suggestion rows min 64 with a 40 circle icon, one-line title and
 * subtitle, plus "No places found" and "Search isn't working" states. It searches only for
 * text the passenger typed, never for a prefilled value ("Current location", a ride's
 * address).
 *
 * T-534 (PERF-10): the typed text lives here, so a keystroke re-renders only this field. A
 * lookup waits for a 300 ms pause and 3 characters, a newer query aborts the older request,
 * and the lookups of one search (autocomplete + details) share a Places session token.
 */
const LocationSearch: React.FC<Props> = ({
  mode,
  query,
  queryRevision,
  onChangeQuery,
  onSelect,
  readOnly,
  onFocusChange,
  placeholder,
  leadingIcon,
  onChooseOnMap,
  near,
  replaceOnType,
}) => {
  const { theme } = useAppTheme();
  const c = theme.colors;
  const [text, setTextState] = useState(query);
  const textRef = useRef(query);
  const [remote, setRemote] = useState<Suggestion[]>([]);
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [focused, setFocused] = useState(false);
  // True once the passenger types in this field; prefilled text is not searched.
  const [edited, setEdited] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  // Read when a search starts; a new GPS fix must not search again.
  const nearRef = useRef(near);
  nearRef.current = near;
  // One Places session per search: made by the first lookup, ended by the pick.
  const sessionRef = useRef<string | null>(null);

  const setText = useCallback((value: string) => {
    textRef.current = value;
    setTextState(value);
  }, []);

  // The screen set the field (or reset it): its text replaces what was typed.
  const appliedRevision = useRef(queryRevision);
  useEffect(() => {
    const revised = appliedRevision.current !== queryRevision;
    appliedRevision.current = queryRevision;
    if (!revised && query === textRef.current) return;
    setText(query);
    setEdited(false);
  }, [query, queryRevision, setText]);

  useEffect(() => {
    if (readOnly || !edited || text.trim().length < MIN_AUTOCOMPLETE_CHARS) {
      setRemote([]);
      setStatus('idle');
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    // The spinner shows once the lookup starts, not on every keystroke of the pause.
    const timer = setTimeout(async () => {
      setStatus('loading');
      if (!sessionRef.current) sessionRef.current = newPlacesSessionToken();
      try {
        const results = await fetchAutocomplete(text, nearRef.current, {
          sessionToken: sessionRef.current,
          signal: controller.signal,
        });
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
    }, AUTOCOMPLETE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [text, readOnly, edited]);

  const pick = async (s: Suggestion) => {
    if (s.coords.latitude === 0) {
      setSelectingId(s.id);
      try {
        const details = await fetchPlaceDetails(s.id, { sessionToken: sessionRef.current ?? undefined });
        sessionRef.current = null;
        if (details) {
          setEdited(false);
          onSelect({ ...s, coords: { latitude: details.latitude, longitude: details.longitude } });
        }
      } finally {
        setSelectingId(null);
      }
      return;
    }
    sessionRef.current = null;
    setEdited(false);
    onSelect(s);
  };

  const labels: readonly string[] = replaceOnType === undefined ? [] : typeof replaceOnType === 'string' ? [replaceOnType] : replaceOnType;
  // Read at focus time: the label is selected, so the first keystroke replaces it.
  const showsLabel = !edited && labels.includes(text);

  const changeText = (typed: string) => {
    // Covers a lost selection (a tap that placed the cursor): typing never adds to the label.
    const label = edited ? undefined : labels.find((l) => l === textRef.current);
    const q = label ? replaceLabelEdit(label, typed) : typed;
    setEdited(true);
    setText(q);
    onChangeQuery?.(q);
  };

  const setFocus = (value: boolean) => {
    setFocused(value);
    onFocusChange?.(value);
  };

  const glyph =
    leadingIcon === undefined ? LEADING_ICON[mode] : typeof leadingIcon === 'function' ? leadingIcon(text) : leadingIcon;
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
          value={text}
          onChangeText={changeText}
          placeholderTextColor={c.textMuted}
          editable={!readOnly}
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          returnKeyType="search"
          autoCorrect={false}
          selectTextOnFocus={showsLabel}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
        />
        {status === 'loading' ? <ActivityIndicator size="small" color={c.textSecondary} testID="location-search-spinner" /> : null}
        {text.length > 0 && !readOnly ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear"
            onPress={() => changeText('')}
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
