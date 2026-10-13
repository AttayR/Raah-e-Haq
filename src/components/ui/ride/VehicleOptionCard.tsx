import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { haptics } from '../../../core/haptics';
import { t } from '../../../i18n';
import { componentTokens, space } from '../../../theme';
import { AppText } from '../AppText';
import { Card } from '../Card';
import { Icon, type IconName } from '../Icon';
import { Skeleton, SkeletonGroup } from '../Skeleton';

const v = componentTokens.ride.vehicle;

/** Catalogue key (BE-05 `icon`) → MDI vehicle glyph (§4); unknown keys fall back to the car. */
export const vehicleIconName = (key: string | null | undefined): IconName => {
  switch (key) {
    case 'bike':
    case 'motorbike':
      return 'bike';
    case 'rickshaw':
      return 'rickshaw';
    case 'van':
    case 'truck':
      return 'van';
    default:
      return 'car';
  }
};

/** "4 seats · 6 min", or "4 seats" until the server sends a pickup ETA (§5.25). */
export const vehicleMeta = (capacity: number | null | undefined, etaMinutes?: number | null): string | null => {
  if (!capacity) return null;
  const seats = capacity === 1 ? t('ride.vehicleSeat') : t('ride.vehicleSeats', { n: capacity });
  return typeof etaMinutes === 'number' && Number.isFinite(etaMinutes)
    ? t('ride.vehicleMeta', { seats, minutes: Math.max(1, Math.round(etaMinutes)) })
    : seats;
};

export type VehicleOptionCardProps = {
  /** Catalogue key (`car`, `bike`, `rickshaw`, `van`): picks the glyph. */
  vehicleKey: string;
  name: string;
  /** Second line (`vehicleMeta`): seats and ETA. */
  meta?: string | null;
  /** Formatted fare (`formatMoney`), or a short "no price" text; hidden when null. */
  fare?: string | null;
  selected?: boolean;
  /** Not bookable right now (no quote, no drivers): 40% and "Unavailable". */
  unavailable?: boolean;
  onPress: () => void;
  testID?: string;
};

/**
 * Vehicle option card (DESIGN_SYSTEM §5.25, §12.5): ≥72 high, radius 16, MDI glyph at 32 in a
 * 56pt `surfaceAlt` tile, name `title` + `caption` meta, fare `numericL` at the end. Selected =
 * `Card selected` (2pt `primary` border, `primarySoft`). A radio for screen readers; haptic
 * `selection` on choose.
 */
export function VehicleOptionCard({
  vehicleKey,
  name,
  meta,
  fare,
  selected = false,
  unavailable = false,
  onPress,
  testID,
}: VehicleOptionCardProps) {
  const { theme } = useAppTheme();
  const label = [name, meta, unavailable ? t('ride.unavailable') : fare].filter(Boolean).join(', ');
  return (
    <Card
      variant={selected ? 'selected' : 'outlined'}
      padding="none"
      onPress={() => {
        if (unavailable) return;
        haptics.selection();
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityLabel={label}
      disabled={unavailable}
      testID={testID}
      style={[styles.card, selected ? styles.selectedInset : styles.outlinedInset, unavailable && styles.unavailable]}
    >
      <View style={[styles.tile, { backgroundColor: selected ? theme.colors.surface : theme.colors.surfaceAlt }]}>
        <Icon name={vehicleIconName(vehicleKey)} size={32} color="textPrimary" />
      </View>
      <View style={styles.text}>
        <AppText variant="title" numberOfLines={1}>
          {name}
        </AppText>
        {meta ? (
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {meta}
          </AppText>
        ) : null}
      </View>
      {unavailable ? (
        <AppText variant="caption" color="textMuted" numberOfLines={1}>
          {t('ride.unavailable')}
        </AppText>
      ) : fare ? (
        <AppText variant="numericL" numberOfLines={1} style={styles.fare} testID={testID ? `${testID}-fare` : undefined}>
          {fare}
        </AppText>
      ) : null}
    </Card>
  );
}

/** Loading list: three card-shaped skeletons, 8 apart (§5.25). */
export function VehicleOptionSkeleton({ testID }: { testID?: string }) {
  return (
    <SkeletonGroup testID={testID} style={styles.list}>
      {Array.from({ length: v.skeletonCount }, (_, i) => (
        <Skeleton key={i} shape="card" height={v.minHeight} />
      ))}
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: v.minHeight },
  // Padding 12/16 minus the border so content does not move when the card becomes selected.
  outlinedInset: { paddingVertical: v.paddingVertical - 1, paddingHorizontal: v.paddingHorizontal - 1 },
  selectedInset: { paddingVertical: v.paddingVertical - 2, paddingHorizontal: v.paddingHorizontal - 2 },
  unavailable: { opacity: v.unavailableOpacity },
  tile: { width: v.tile, height: v.tile, borderRadius: v.tileRadius, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0, gap: 2 },
  fare: { flexShrink: 0 },
  list: { gap: v.listGap },
});
