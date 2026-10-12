import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, StatTile, type IconName } from '../../ui';
import { space } from '../../../theme';
import { DRIVER_HOME_COPY } from './copy';

/**
 * Today's figures from GET /me/stats (BE-08), already formatted. `null` = not loaded yet (an
 * honest dash). Online time and acceptance are not tracked server-side yet: `undefined` hides
 * those tiles instead of showing 0.
 */
export type DriverTodayStatsValues = {
  earnings: string | null;
  trips: string | null;
  rating: string | null;
  onlineTime?: string;
  acceptance?: string;
};

type Props = {
  values: DriverTodayStatsValues;
  /** Shown under the tiles when the stats could not be loaded. */
  error?: string | null;
};

type Tile = { key: string; icon: IconName; value: string | null; label: string };

/** "Today" stat tiles: earnings, trips and rating, plus online time / acceptance when tracked. */
export function DriverTodayStats({ values, error }: Props) {
  const tiles: Tile[] = [
    { key: 'earnings', icon: 'savings', value: values.earnings, label: DRIVER_HOME_COPY.statEarnings },
    { key: 'trips', icon: 'rides', value: values.trips, label: DRIVER_HOME_COPY.statRides },
    { key: 'rating', icon: 'star', value: values.rating, label: DRIVER_HOME_COPY.statRating },
  ];
  if (values.onlineTime !== undefined) {
    tiles.push({ key: 'online', icon: 'clock', value: values.onlineTime, label: DRIVER_HOME_COPY.statOnline });
  }
  if (values.acceptance !== undefined) {
    tiles.push({ key: 'acceptance', icon: 'check', value: values.acceptance, label: DRIVER_HOME_COPY.statAcceptance });
  }
  return (
    <View testID="driver-home-today">
      <AppText variant="overline" color="textMuted" accessibilityRole="header" style={styles.header}>
        {DRIVER_HOME_COPY.todayTitle}
      </AppText>
      <View style={styles.row}>
        {tiles.map((tile) => (
          <View key={tile.key} style={styles.cell}>
            <StatTile icon={tile.icon} value={tile.value} label={tile.label} testID={`driver-home-stat-${tile.key}`} />
          </View>
        ))}
      </View>
      {error ? (
        <AppText variant="caption" color="textMuted" style={styles.note} testID="driver-home-stats-error">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: space[2], marginStart: space[4] },
  // Three per row on an iPhone SE; extra tiles wrap to the next row.
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  cell: { flexGrow: 1, flexBasis: '28%', flexDirection: 'row' },
  note: { marginTop: space[2], marginStart: space[4] },
});
