import React, { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { t } from '../../../i18n';
import { componentTokens, radius, space } from '../../../theme';
import { AppText } from '../AppText';

const a = componentTokens.ride.addressPair;

export type AddressStop = {
  address: string;
  /** Stable key (API stop id); the index is used otherwise. */
  key?: string | number;
  /** Caption instead of "Stop n" (e.g. "Next stop" on the driver's trip). */
  label?: string;
  testID?: string;
};

export type AddressPairProps = {
  pickup: string;
  dropoff: string;
  /** Intermediate stops in order (§5.23: 8pt `stopPin` circles on the rail). */
  stops?: ReadonlyArray<AddressStop>;
  /** Show "Pickup" / "Stop n" / "Drop-off" captions above the addresses. */
  labels?: boolean;
  /**
   * `regular` rows are ≥48 (booking, details, trip sheets); `compact` rows (≥32) are for list cards
   * (history, recent rides) where the pair is the card body.
   */
  density?: 'regular' | 'compact';
  /** `lg` uses the 20pt `h3` style for driving screens (§12.7: 20pt minimum address text). */
  size?: 'md' | 'lg';
  /** Lines per address: 1 (ellipsis, default) or 0 for unlimited (ride details). */
  numberOfLines?: number;
  /** Hairline dividers inset to the text start, for rows that act as fields. */
  dividers?: boolean;
  /** Addresses are selectable (ride details, receipts). */
  selectable?: boolean;
  /** testIDs on the pickup and drop-off address text (screen tests read them). */
  pickupTestID?: string;
  dropoffTestID?: string;
  testID?: string;
};

type Kind = 'pickup' | 'stop' | 'dropoff';

/** A vertical run of 2×2 dots (dash 2 / gap 3), sized to the space it is given. */
function DottedSegment({ visible }: { visible: boolean }) {
  const { theme } = useAppTheme();
  const [height, setHeight] = useState(0);
  const count = visible ? Math.max(0, Math.floor((height + a.dotGap) / (a.dot + a.dotGap))) : 0;
  return (
    <View style={styles.segment} onLayout={(e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height)}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.dot, { backgroundColor: theme.colors.borderStrong }]} />
      ))}
    </View>
  );
}

function RailGlyph({ kind }: { kind: Kind }) {
  const { theme } = useAppTheme();
  const c = theme.colors;
  if (kind === 'pickup') return <View testID="address-rail-pickup" style={[styles.pickup, { backgroundColor: c.pickupPin }]} />;
  if (kind === 'dropoff') return <View testID="address-rail-dropoff" style={[styles.dropoff, { backgroundColor: c.dropoffPin }]} />;
  return <View testID="address-rail-stop" style={[styles.stop, { backgroundColor: c.stopPin }]} />;
}

/**
 * Address pair, the "Raah line" (DESIGN_SYSTEM §5.23, brand signature): pickup (10pt `pickupPin`
 * circle), stops (8pt `stopPin` circles) and drop-off (10pt `dropoffPin` square) on a 20pt rail,
 * joined by a 2pt dotted `borderStrong` line. One component everywhere (booking, history, details,
 * incoming request, trip sheets). The rail sits on the start side, so it moves to the end in RTL.
 */
export function AddressPair({
  pickup,
  dropoff,
  stops = [],
  labels = false,
  density = 'regular',
  size = 'md',
  numberOfLines = 1,
  dividers = false,
  selectable = false,
  pickupTestID,
  dropoffTestID,
  testID,
}: AddressPairProps) {
  const { theme } = useAppTheme();
  const rows: Array<{ kind: Kind; address: string; key: string; label: string; a11y: string; testID?: string }> = [
    { kind: 'pickup', address: pickup, key: 'pickup', label: t('ride.pickup'), a11y: t('ride.pickupA11y', { address: pickup }), testID: pickupTestID },
    ...stops.map((stop, i) => ({
      kind: 'stop' as const,
      address: stop.address,
      key: `stop-${stop.key ?? i}`,
      label: stop.label ?? t('ride.stop', { n: i + 1 }),
      a11y: t('ride.stopA11y', { n: i + 1, address: stop.address }),
      testID: stop.testID,
    })),
    { kind: 'dropoff', address: dropoff, key: 'dropoff', label: t('ride.dropoff'), a11y: t('ride.dropoffA11y', { address: dropoff }), testID: dropoffTestID },
  ];
  const lines = numberOfLines > 0 ? numberOfLines : undefined;
  return (
    <View testID={testID}>
      {rows.map((row, i) => (
        <View
          key={row.key}
          accessible
          accessibilityLabel={row.a11y}
          style={[styles.row, { minHeight: a.rowMinHeight[density] }]}
        >
          <View style={styles.rail}>
            <DottedSegment visible={i > 0} />
            <RailGlyph kind={row.kind} />
            <DottedSegment visible={i < rows.length - 1} />
          </View>
          <View
            style={[
              styles.text,
              density === 'compact' ? styles.textCompact : styles.textRegular,
              // §5.23: the divider starts at the text (x = 48), never across the rail.
              dividers && i > 0 ? { borderTopWidth: theme.borderWidth.hairline, borderTopColor: theme.colors.border } : null,
            ]}
          >
            {labels ? (
              <AppText variant="caption" color="textMuted" numberOfLines={1}>
                {row.label}
              </AppText>
            ) : null}
            <AppText
              variant={size === 'lg' ? 'h3' : 'body'}
              numberOfLines={lines}
              ellipsizeMode="tail"
              selectable={selectable}
              testID={row.testID}
            >
              {row.address}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch', gap: space[3] },
  rail: { width: a.railWidth, alignItems: 'center' },
  segment: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center', gap: a.dotGap, overflow: 'hidden' },
  dot: { width: a.dot, height: a.dot, borderRadius: radius.pill },
  pickup: { width: a.pickup, height: a.pickup, borderRadius: radius.pill },
  dropoff: { width: a.dropoff, height: a.dropoff, borderRadius: a.dropoffRadius },
  stop: { width: a.stop, height: a.stop, borderRadius: radius.pill },
  text: { flex: 1, minWidth: 0, justifyContent: 'center' },
  textRegular: { paddingVertical: space[2] },
  textCompact: { paddingVertical: space[1] },
});
