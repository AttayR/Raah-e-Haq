import React from 'react';
import { StyleSheet } from 'react-native';
import { Banner, Chip } from '../../../components/ui';
import { BOOKING_COPY } from '../copy';
import type { MapPickTarget } from '../mapTap';

/**
 * Turns on the explicit "choose on map" mode (T-304, PAX-14). UI-R9: a kit Chip with the
 * `map-marker-outline` glyph (passenger-destination-search quick row), not a hand-styled pill.
 */
export const ChooseOnMapButton: React.FC<{ label?: string; onPress: () => void; testID?: string }> = ({
  label = BOOKING_COPY.chooseOnMap,
  onPress,
  testID = 'choose-on-map',
}) => <Chip icon="pinOutline" tone="primary" label={label} onPress={onPress} testID={testID} style={styles.hug} />;

/** While the mode is on: what the next tap does, and a way out (kit info Banner, UI-R9). */
export const MapPickBanner: React.FC<{ target: MapPickTarget; onCancel: () => void }> = ({ target, onCancel }) => (
  <Banner
    tone="info"
    icon="pinOutline"
    text={BOOKING_COPY.mapPickHint(target)}
    action={{ label: BOOKING_COPY.mapPickCancel, onPress: onCancel, testID: 'map-pick-cancel' }}
    testID="map-pick-banner"
  />
);

const styles = StyleSheet.create({
  // In a column it hugs its label instead of stretching to the sheet width.
  hug: { alignSelf: 'flex-start' },
});
