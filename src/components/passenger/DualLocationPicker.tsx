import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import LocationSearch, { suggestionAddress, type LocationSearchHandle } from './LocationSearch';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { AppText } from '../ui/AppText';
import { Chip } from '../ui/Chip';
import { IconButton } from '../ui/IconButton';
import type { IconName } from '../ui/Icon';
import { componentTokens, radius, space } from '../../theme';
import { BOOKING_COPY, isCurrentLocationLabel, locationFieldLabels } from '../../features/ride-booking/copy';

type Coords = { latitude: number; longitude: number } | null;

type Props = {
  pickup: Coords;
  destination: Coords;
  /** Text the screen puts in the fields; typed text stays in the fields (T-534). */
  pickupQuery: string;
  destQuery: string;
  /** Bumped by the screen to put its text back in a field (e.g. after a reset). */
  pickupRevision?: number;
  destRevision?: number;
  /** `address` is the picked suggestion's text, sent with the ride (T-302). */
  onSelectPickup: (c: { latitude: number; longitude: number }, address: string) => void;
  onSelectDestination: (c: { latitude: number; longitude: number }, address: string) => void;
  onUseCurrentLocation?: () => void;
  onSwap?: () => void;
  /** While a field is focused: hide the title so the suggestions get the room. */
  compact?: boolean;
  onFocusChange?: (focused: boolean) => void;
  /** "Set location on map" from the search results (no results / search failed). */
  onChooseOnMap?: (target: 'pickup' | 'destination') => void;
  /** Focus the destination field on mount (the planner opened from "Where to?", T-576). */
  autoFocusDestination?: boolean;
  /** UI-R9: "Choose on map" in the quick row under the fields (hidden while typing). */
  onChooseOnMapChip?: () => void;
  /**
   * UI-R9 (passenger-destination-search block 4): saved and recent places for the field being
   * filled, shown while that field has no typed text (the destination until one is chosen, or
   * the focused field). Typing hands the room to the Places suggestions. `onPick` is stable per
   * target and finishes the pick like a suggestion pick before `onShortcutPick` runs.
   */
  renderShortcuts?: (target: PickerField, onPick: (place: ShortcutPlace) => void) => React.ReactNode;
  /** A shortcut row was picked for `target` (after the field's session ended and it blurred). */
  onShortcutPick?: (target: PickerField, place: ShortcutPlace) => void;
};

export type PickerField = 'pickup' | 'destination';
/** A saved or recent place: its point and address (sent with the ride, T-302). */
export type ShortcutPlace = { latitude: number; longitude: number; address: string };

/** True when the passenger typed real text (not cleared, not a label such as "Current location"). */
const isTyped = (q: string): boolean => q.trim().length > 0 && !locationFieldLabels().includes(q);

/** The pickup field shows the locate glyph while it reads "Current location". */
const currentLocationGlyph = (text: string): IconName | null => (isCurrentLocationLabel(text) ? 'locate' : null);

/** Pickup and destination fields on the Raah line (DESIGN_SYSTEM 5.23), with swap. */
const DualLocationPicker: React.FC<Props> = ({
  destination,
  pickupQuery,
  destQuery,
  pickupRevision,
  destRevision,
  onSelectPickup,
  onSelectDestination,
  onUseCurrentLocation,
  onSwap,
  compact = false,
  onFocusChange,
  onChooseOnMap,
  autoFocusDestination = false,
  onChooseOnMapChip,
  renderShortcuts,
  onShortcutPick,
}) => {
  const { theme } = useAppTheme();
  const c = theme.colors;
  // Which field is being filled, and whether it holds typed text: a boolean per field, so a
  // keystroke re-renders this picker only when that flips (T-534: the text stays in the field).
  const [focused, setFocused] = useState<PickerField | null>(autoFocusDestination ? 'destination' : null);
  const [typed, setTyped] = useState<Record<PickerField, boolean>>({ pickup: false, destination: false });
  const markTyped = useCallback((field: PickerField, q: string) => {
    const next = isTyped(q);
    setTyped((prev) => (prev[field] === next ? prev : { ...prev, [field]: next }));
  }, []);
  // The screen set a field (a pick, a swap, a reset): it holds no typed text any more.
  useEffect(() => markTyped('pickup', ''), [pickupQuery, pickupRevision, markTyped]);
  useEffect(() => markTyped('destination', ''), [destQuery, destRevision, markTyped]);
  const focusChange = (field: PickerField) => (value: boolean) => {
    setFocused((prev) => (value ? field : prev === field ? null : prev));
    onFocusChange?.(value);
  };
  // UI-R9 review: a shortcut pick behaves like a suggestion pick, in this one place: the field's
  // Places session ends, the field blurs and the keyboard closes, then the screen gets the place.
  // After a pickup the destination is the field being filled again.
  const fieldRefs = useRef<Record<PickerField, LocationSearchHandle | null>>({ pickup: null, destination: null });
  const onShortcutPickRef = useRef(onShortcutPick);
  onShortcutPickRef.current = onShortcutPick;
  const onFocusChangeRef = useRef(onFocusChange);
  onFocusChangeRef.current = onFocusChange;
  const finishPick = useCallback((field: PickerField, place: ShortcutPlace) => {
    fieldRefs.current[field]?.finishOutsidePick();
    Keyboard.dismiss();
    setFocused(null);
    onFocusChangeRef.current?.(false);
    onShortcutPickRef.current?.(field, place);
  }, []);
  const pickPickup = useCallback((place: ShortcutPlace) => finishPick('pickup', place), [finishPick]);
  const pickDestination = useCallback((place: ShortcutPlace) => finishPick('destination', place), [finishPick]);
  const target: PickerField = focused ?? 'destination';
  // Spec block 3 / small device: the quick row (chips + swap) gives way while the focused field
  // holds typed text, and returns when typing stops or a result is picked.
  const typing = focused !== null && typed[focused];
  // UI-R9: "Use current location" only when the pickup is somewhere else (one line on an SE).
  const offerCurrentLocation =
    onUseCurrentLocation && !isCurrentLocationLabel(pickupQuery) && pickupQuery !== BOOKING_COPY.resolvingAddress
      ? onUseCurrentLocation
      : undefined;
  const showShortcuts = !!renderShortcuts && !typed[target] && (focused !== null || !destination);
  return (
    <View style={styles.container} testID="dual-location-picker">
      {!compact && (
        <AppText variant="h3" accessibilityRole="header">
          {BOOKING_COPY.planTitle}
        </AppText>
      )}
      <View style={styles.row}>
        <View style={[styles.pickupDot, { backgroundColor: c.pickupPin }]} />
        <View style={styles.field}>
          <LocationSearch
            ref={(handle) => {
              fieldRefs.current.pickup = handle;
            }}
            mode="pickup"
            query={pickupQuery}
            queryRevision={pickupRevision}
            onSelect={(s) => onSelectPickup(s.coords, suggestionAddress(s))}
            readOnly={pickupQuery === BOOKING_COPY.resolvingAddress}
            leadingIcon={currentLocationGlyph}
            replaceOnType={locationFieldLabels()}
            onChooseOnMap={onChooseOnMap ? () => onChooseOnMap('pickup') : undefined}
            onFocusChange={focusChange('pickup')}
            onChangeQuery={(q) => markTyped('pickup', q)}
          />
        </View>
      </View>
      <View style={styles.row}>
        <View style={[styles.dropoffSquare, { backgroundColor: c.dropoffPin }]} />
        <View style={styles.field}>
          <LocationSearch
            ref={(handle) => {
              fieldRefs.current.destination = handle;
            }}
            mode="destination"
            query={destQuery}
            queryRevision={destRevision}
            onSelect={(s) => onSelectDestination(s.coords, suggestionAddress(s))}
            replaceOnType={locationFieldLabels()}
            onFocusChange={focusChange('destination')}
            onChangeQuery={(q) => markTyped('destination', q)}
            onChooseOnMap={onChooseOnMap ? () => onChooseOnMap('destination') : undefined}
            autoFocus={autoFocusDestination}
            // T-582 (QA 2026-10-19): less room above it than the row gap, so the pickup row
            // scrolls fully out of view under the handle while typing (no sliver).
            revealTopMargin={DESTINATION_REVEAL_TOP}
          />
        </View>
      </View>
      {!typing && (offerCurrentLocation || onChooseOnMapChip || onSwap) ? (
        <View style={styles.actions}>
          {/* UI-R9 quick row: the chips wrap (Roman Urdu labels are long), swap stays at the end. */}
          <View style={styles.chips}>
            {offerCurrentLocation ? (
              <Chip label={BOOKING_COPY.useCurrentLocation} icon="locate" tone="primary" onPress={offerCurrentLocation} testID="use-current-location" />
            ) : null}
            {onChooseOnMapChip ? (
              <Chip label={BOOKING_COPY.chooseOnMap} icon="pinOutline" tone="primary" onPress={onChooseOnMapChip} testID="choose-on-map" />
            ) : null}
          </View>
          {onSwap ? (
            <IconButton icon="swap" variant="tonal" iconColor="primaryText" accessibilityLabel={BOOKING_COPY.swapA11y} onPress={onSwap} testID="swap-locations" />
          ) : null}
        </View>
      ) : null}
      {showShortcuts ? <View style={styles.shortcuts}>{renderShortcuts?.(target, target === 'pickup' ? pickPickup : pickDestination)}</View> : null}
    </View>
  );
};

const rail = componentTokens.ride.addressPair;
/** Room above the destination field when the sheet reveals it: under the rows' gap (space 2). */
export const DESTINATION_REVEAL_TOP = space[1];
/** Half the 48 field (space 6 = 24) minus half the glyph. */
const FIELD_CENTER = space[6] - rail.pickup / 2;

const styles = StyleSheet.create({
  container: { gap: space[2] },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  field: { flex: 1, minWidth: 0 },
  // The Raah line glyphs (§5.23 tokens), centred on the 48 field.
  pickupDot: { width: rail.pickup, height: rail.pickup, borderRadius: radius.pill, marginTop: FIELD_CENTER },
  dropoffSquare: { width: rail.dropoff, height: rail.dropoff, borderRadius: rail.dropoffRadius, marginTop: FIELD_CENTER },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[2] },
  chips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[2] },
  shortcuts: { marginTop: space[2] },
});

export default DualLocationPicker;
