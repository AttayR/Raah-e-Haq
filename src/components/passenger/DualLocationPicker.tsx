import React from 'react';
import { StyleSheet, View } from 'react-native';
import LocationSearch, { suggestionAddress } from './LocationSearch';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { AppText } from '../ui/AppText';
import { Chip } from '../ui/Chip';
import { IconButton } from '../ui/IconButton';
import type { IconName } from '../ui/Icon';
import { radius, space } from '../../theme';
import { BOOKING_COPY } from '../../features/ride-booking/copy';

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
  /** While typing: hide the title and actions so the suggestions get the room. */
  compact?: boolean;
  onFocusChange?: (focused: boolean) => void;
  /** "Set location on map" from the search results (no results / search failed). */
  onChooseOnMap?: (target: 'pickup' | 'destination') => void;
};

/** The pickup field shows the locate glyph while it reads "Current location". */
const currentLocationGlyph = (text: string): IconName | null => (text === BOOKING_COPY.currentLocation ? 'locate' : null);

/** Pickup and destination fields on the Raah line (DESIGN_SYSTEM 5.23), with swap. */
const DualLocationPicker: React.FC<Props> = ({
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
}) => {
  const { theme } = useAppTheme();
  const c = theme.colors;
  return (
    <View style={styles.container} testID="dual-location-picker">
      {!compact && (
        <AppText variant="title" accessibilityRole="header">
          Plan your trip
        </AppText>
      )}
      <View style={styles.row}>
        <View style={[styles.pickupDot, { backgroundColor: c.pickupPin }]} />
        <View style={styles.field}>
          <LocationSearch
            mode="pickup"
            query={pickupQuery}
            queryRevision={pickupRevision}
            onSelect={(s) => onSelectPickup(s.coords, suggestionAddress(s))}
            readOnly={pickupQuery === BOOKING_COPY.resolvingAddress}
            leadingIcon={currentLocationGlyph}
            onChooseOnMap={onChooseOnMap ? () => onChooseOnMap('pickup') : undefined}
            onFocusChange={onFocusChange}
          />
        </View>
      </View>
      <View style={styles.row}>
        <View style={[styles.dropoffSquare, { backgroundColor: c.dropoffPin }]} />
        <View style={styles.field}>
          <LocationSearch
            mode="destination"
            query={destQuery}
            queryRevision={destRevision}
            onSelect={(s) => onSelectDestination(s.coords, suggestionAddress(s))}
            onFocusChange={onFocusChange}
            onChooseOnMap={onChooseOnMap ? () => onChooseOnMap('destination') : undefined}
          />
        </View>
      </View>
      {!compact && (onUseCurrentLocation || onSwap) ? (
        <View style={styles.actions}>
          {onUseCurrentLocation ? (
            <Chip label="Use current location" icon="locate" tone="primary" onPress={onUseCurrentLocation} testID="use-current-location" />
          ) : (
            <View />
          )}
          {onSwap ? (
            <IconButton icon="swap" variant="tonal" iconColor="primaryText" accessibilityLabel="Swap pickup and destination" onPress={onSwap} testID="swap-locations" />
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const FIELD_CENTER = 24 - 5;

const styles = StyleSheet.create({
  container: { gap: space[2] },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  field: { flex: 1, minWidth: 0 },
  pickupDot: { width: 10, height: 10, borderRadius: radius.pill, marginTop: FIELD_CENTER },
  dropoffSquare: { width: 10, height: 10, borderRadius: 2, marginTop: FIELD_CENTER },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[2] },
});

export default DualLocationPicker;
