import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import LocationSearch, { suggestionAddress } from './LocationSearch';
import { AppText } from '../ui/AppText';
import { IconButton } from '../ui/IconButton';
import { PinGlyph } from '../ui/ride/MapPins';
import { space } from '../../theme';
import { BOOKING_COPY } from '../../features/ride-booking/copy';

type Coords = { latitude: number; longitude: number; address?: string | null };

type Props = {
  stops: Coords[];
  /** `address` is the picked suggestion's text, sent with the ride (T-302). */
  onAddStop: (c: Coords, address: string) => void;
  onRemoveStop: (index: number) => void;
  maxStops?: number;
  onFocusChange?: (focused: boolean) => void;
  /** UI-R10: the add-a-stop search shows only once "Add a stop" was tapped (default: shown). */
  searchVisible?: boolean;
};

/** Extra stops between pickup and drop-off: listed with remove, plus a search to add one. */
const StopsEditor: React.FC<Props> = ({ stops, onAddStop, onRemoveStop, maxStops = 5, onFocusChange, searchVisible = true }) => {
  const [query, setQuery] = useState('');
  return (
    <View style={styles.wrap}>
      {stops.map((s, idx) => (
        <View key={`stop-${idx}`} style={styles.row}>
          {/* UI-R10: the same numbered glyph as the stop's map pin. */}
          <PinGlyph kind="stop" index={idx + 1} testID={`stop-row-glyph-${idx + 1}`} />
          <AppText variant="bodySmall" numberOfLines={1} style={styles.stopText}>
            {BOOKING_COPY.stopLine(idx + 1, s.address || BOOKING_COPY.pinnedOnMap)}
          </AppText>
          <IconButton
            icon="close"
            iconColor="textSecondary"
            accessibilityLabel={BOOKING_COPY.removeStopA11y(idx + 1)}
            onPress={() => onRemoveStop(idx)}
            testID={`remove-stop-${idx + 1}`}
          />
        </View>
      ))}
      {searchVisible && stops.length < maxStops && (
        <LocationSearch
          mode="destination"
          placeholder={BOOKING_COPY.addStop}
          query={query}
          onChangeQuery={setQuery}
          onFocusChange={onFocusChange}
          onSelect={(sel) => {
            onAddStop(sel.coords, suggestionAddress(sel));
            setQuery('');
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  stopText: { flex: 1, minWidth: 0 },
});

export default StopsEditor;
