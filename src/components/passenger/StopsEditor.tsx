import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import LocationSearch, { suggestionAddress } from './LocationSearch';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { AppText } from '../ui/AppText';
import { IconButton } from '../ui/IconButton';
import { radius, space } from '../../theme';

type Coords = { latitude: number; longitude: number; address?: string | null };

type Props = {
  stops: Coords[];
  /** `address` is the picked suggestion's text, sent with the ride (T-302). */
  onAddStop: (c: Coords, address: string) => void;
  onRemoveStop: (index: number) => void;
  maxStops?: number;
  onFocusChange?: (focused: boolean) => void;
};

/** Extra stops between pickup and drop-off: listed with remove, plus a search to add one. */
const StopsEditor: React.FC<Props> = ({ stops, onAddStop, onRemoveStop, maxStops = 5, onFocusChange }) => {
  const { theme } = useAppTheme();
  const [query, setQuery] = useState('');
  return (
    <View style={styles.wrap}>
      {stops.map((s, idx) => (
        <View key={`stop-${idx}`} style={styles.row}>
          <View style={[styles.dot, { backgroundColor: theme.colors.stopPin }]} />
          <AppText variant="bodySmall" numberOfLines={1} style={styles.stopText}>
            {`Stop ${idx + 1}: ${s.address || `${s.latitude.toFixed(4)}, ${s.longitude.toFixed(4)}`}`}
          </AppText>
          <IconButton icon="close" iconColor="textSecondary" accessibilityLabel={`Remove stop ${idx + 1}`} onPress={() => onRemoveStop(idx)} />
        </View>
      ))}
      {stops.length < maxStops && (
        <LocationSearch
          mode="destination"
          placeholder="Add a stop"
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
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  stopText: { flex: 1, minWidth: 0 },
});

export default StopsEditor;
