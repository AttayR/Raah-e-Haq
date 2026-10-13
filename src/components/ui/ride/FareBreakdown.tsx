import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { t } from '../../../i18n';
import { componentTokens, space } from '../../../theme';
import { formatDistance, formatDuration, formatMoney } from '../../../utils/format';
import { AppText, type TextColor } from '../AppText';
import { Card } from '../Card';

const f = componentTokens.ride.fare;

/** The server's fare breakdown (BE-05 `breakdown` / ride `fare_breakdown`), whole rupees. */
export type FareBreakdownInput = {
  base?: number | null;
  distance?: number | null;
  time?: number | null;
  stops?: number | null;
  minFareAdjustment?: number | null;
  /** A promotion/discount amount, positive or negative; shown as a minus in `success`. */
  discount?: number | null;
};

export type FareRow = {
  key: string;
  label: string;
  value: string;
  /** `success` for a discount, `danger` never (fees are not errors). */
  tone?: Extract<TextColor, 'success' | 'textPrimary' | 'textSecondary'>;
  /** Bold row in the same style as the total (driver "Your earnings"). */
  strong?: boolean;
};

const present = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n);

/**
 * The rows the API returned (§5.26): base, distance, time; stops and the minimum-fare
 * adjustment only when > 0; a discount only when present. Nothing is invented.
 */
export function fareBreakdownRows(
  breakdown: FareBreakdownInput | null | undefined,
  context: { distanceKm?: number | null; durationMin?: number | null; currency?: string | null } = {},
): FareRow[] {
  if (!breakdown) return [];
  const money = (n: number) => formatMoney(n, context.currency);
  const rows: FareRow[] = [];
  if (present(breakdown.base)) rows.push({ key: 'base', label: t('ride.fareBase'), value: money(breakdown.base) });
  if (present(breakdown.distance)) {
    rows.push({
      key: 'distance',
      label: present(context.distanceKm)
        ? t('ride.fareDistance', { distance: formatDistance(context.distanceKm) })
        : t('ride.fareDistancePlain'),
      value: money(breakdown.distance),
    });
  }
  if (present(breakdown.time)) {
    rows.push({
      key: 'time',
      label: present(context.durationMin)
        ? t('ride.fareTime', { duration: formatDuration(context.durationMin) })
        : t('ride.fareTimePlain'),
      value: money(breakdown.time),
    });
  }
  if (present(breakdown.stops) && breakdown.stops > 0) rows.push({ key: 'stops', label: t('ride.fareStops'), value: money(breakdown.stops) });
  if (present(breakdown.minFareAdjustment) && breakdown.minFareAdjustment > 0) {
    rows.push({ key: 'minimum', label: t('ride.fareMinimum'), value: money(breakdown.minFareAdjustment) });
  }
  if (present(breakdown.discount) && breakdown.discount !== 0) {
    rows.push({ key: 'discount', label: t('ride.fareDiscount'), value: money(-Math.abs(breakdown.discount)), tone: 'success' });
  }
  return rows;
}

function Row({ row, testID }: { row: FareRow; testID?: string }) {
  return (
    <View style={styles.row} testID={testID}>
      <AppText variant={row.strong ? 'bodyStrong' : 'bodySmall'} color={row.strong ? 'textPrimary' : 'textSecondary'} style={styles.label}>
        {row.label}
      </AppText>
      <AppText variant="numeric" color={row.tone ?? 'textPrimary'} align="end" style={styles.value} selectable>
        {row.value}
      </AppText>
    </View>
  );
}

export type FareBreakdownProps = {
  breakdown: FareBreakdownInput | null | undefined;
  /** The server total (`fare` / `total_fare`). */
  total: number;
  currency?: string | null;
  distanceKm?: number | null;
  durationMin?: number | null;
  /** "Total" by default; "Estimated total", "Final fare" where the screen says so. */
  totalLabel?: string;
  /** Rows after the total: payment, the driver's platform fee and earnings. */
  extraRows?: ReadonlyArray<FareRow>;
  /** Caption under the card, e.g. `t('ride.fareFootnote')` for estimates. */
  footnote?: string | null;
  /** `card` = outlined Card (default); `plain` = rows only, inside another card or sheet. */
  variant?: 'card' | 'plain';
  testID?: string;
};

/**
 * Fare breakdown (DESIGN_SYSTEM §5.26): rows ≥32 high, label `bodySmall` `textSecondary`, value
 * `numeric` (tabular) at the end; hairline; Total in `title` + `numericL`. Money only through
 * `formatMoney`. Rows render only for the fields the API returned.
 */
export function FareBreakdown({
  breakdown,
  total,
  currency,
  distanceKm,
  durationMin,
  totalLabel = t('ride.fareTotal'),
  extraRows = [],
  footnote,
  variant = 'card',
  testID,
}: FareBreakdownProps) {
  const { theme } = useAppTheme();
  const rows = fareBreakdownRows(breakdown, { distanceKm, durationMin, currency });
  const divider = { borderTopWidth: theme.borderWidth.hairline, borderTopColor: theme.colors.border };
  const body = (
    <>
      {rows.map(row => (
        <Row key={row.key} row={row} testID={testID ? `${testID}-${row.key}` : undefined} />
      ))}
      <View style={[styles.totalRow, rows.length > 0 ? divider : null]} testID={testID ? `${testID}-total` : undefined}>
        <AppText variant="title" style={styles.label}>
          {totalLabel}
        </AppText>
        <AppText variant="numericL" align="end" style={styles.value} selectable>
          {formatMoney(total, currency)}
        </AppText>
      </View>
      {extraRows.length > 0 ? (
        <View style={divider}>
          {extraRows.map(row => (
            <Row key={row.key} row={row} testID={testID ? `${testID}-${row.key}` : undefined} />
          ))}
        </View>
      ) : null}
    </>
  );
  return (
    <View testID={testID} style={styles.wrap}>
      {variant === 'card' ? <Card variant="outlined">{body}</Card> : body}
      {footnote ? (
        <AppText variant="caption" color="textMuted" testID={testID ? `${testID}-footnote` : undefined}>
          {footnote}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: f.rowMinHeight },
  totalRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: f.rowMinHeight + space[3], paddingTop: space[1] },
  label: { flex: 1, minWidth: 0 },
  value: { flexShrink: 0, maxWidth: '55%' },
});
