import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, StatTile } from '../../ui';
import { space } from '../../../theme';
import { DRIVER_HOME_COPY } from './copy';

/** Today's figures as the API gives them (GET /me/stats, BE-08); `null` = not available. */
export type DriverTodayStatsValues = {
  rides: string | null;
  onlineTime: string | null;
  rating: string | null;
};

type Props = { values: DriverTodayStatsValues };

/**
 * "Today" row of three stat tiles. Until BE-08/T-507 wire the numbers every tile shows an
 * honest dash plus one line saying so; no invented figures.
 */
export function DriverTodayStats({ values }: Props) {
  const hasAny = values.rides !== null || values.onlineTime !== null || values.rating !== null;
  return (
    <View testID="driver-home-today">
      <AppText variant="overline" color="textMuted" accessibilityRole="header" style={styles.header}>
        {DRIVER_HOME_COPY.todayTitle}
      </AppText>
      <View style={styles.row}>
        <StatTile icon="rides" value={values.rides} label={DRIVER_HOME_COPY.statRides} testID="driver-home-stat-rides" />
        <StatTile
          icon="clock"
          value={values.onlineTime}
          label={DRIVER_HOME_COPY.statOnline}
          testID="driver-home-stat-online"
        />
        <StatTile icon="star" value={values.rating} label={DRIVER_HOME_COPY.statRating} testID="driver-home-stat-rating" />
      </View>
      {hasAny ? null : (
        <AppText variant="caption" color="textMuted" style={styles.note}>
          {DRIVER_HOME_COPY.statsUnavailable}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: space[2], marginStart: space[4] },
  row: { flexDirection: 'row', gap: space[3] },
  note: { marginTop: space[2], marginStart: space[4] },
});
