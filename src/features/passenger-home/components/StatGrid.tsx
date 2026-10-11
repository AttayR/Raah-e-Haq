import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SectionHeader } from '../../../components/ui/SectionHeader';
import { StatTile } from '../../../components/ui/StatTile';
import { space } from '../../../theme';
import type { HomeStat } from '../types';

/**
 * Stat tiles (DESIGN_SYSTEM 5.29) in a two-column grid that sizes from the container, not
 * the screen width, so it fits iPhone SE to Pro Max. No trend chips.
 */
export const StatGrid: React.FC<{ stats: HomeStat[] }> = ({ stats }) => {
  if (stats.length === 0) return null;
  return (
    <View style={styles.section} testID="home-stats">
      <SectionHeader title="Your rides" />
      <View style={styles.grid}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.cell} testID={`home-stat-${stat.icon}`}>
            <StatTile icon={stat.icon} value={stat.value} label={stat.label} />
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: { gap: space[2] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  // Two per row on every phone width; the tile inside flexes to fill the cell.
  cell: { flexGrow: 1, flexBasis: '40%', flexDirection: 'row' },
});

export default StatGrid;
