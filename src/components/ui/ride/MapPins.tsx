import React, { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Marker, type LatLng } from 'react-native-maps';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { t } from '../../../i18n';
import { componentTokens, radius, space } from '../../../theme';
import { AppText } from '../AppText';
import { useMarkerTracking } from './useMarkerTracking';

const p = componentTokens.ride.pin;

export type PinKind = 'pickup' | 'dropoff' | 'stop';

type GlyphProps = { kind: PinKind; /** 1-based stop number. */ index?: number; testID?: string };

/**
 * The pin glyph alone (DESIGN_SYSTEM §5.21), for map markers and previews:
 * - pickup: 20pt `pickupPin` circle inside a 4pt ring (`routeLineCasing`: white; near-black in dark mode)
 * - drop-off: 20pt `dropoffPin` square (radius 4) with the same ring and a 6pt ring-coloured centre
 * - stop: 22pt `stopPin` circle with the stop number in `numericSmall`
 */
export function PinGlyph({ kind, index, testID }: GlyphProps) {
  const { theme } = useAppTheme();
  const c = theme.colors;
  if (kind === 'stop') {
    return (
      <View
        testID={testID}
        style={[styles.stop, { backgroundColor: c.stopPin, borderColor: c.routeLineCasing }]}
      >
        <AppText variant="numericSmall" color="textInverse" maxFontSizeMultiplier={1}>
          {index ?? ''}
        </AppText>
      </View>
    );
  }
  const dropoff = kind === 'dropoff';
  return (
    <View
      testID={testID}
      style={[
        styles.pin,
        dropoff ? styles.square : styles.circle,
        { backgroundColor: dropoff ? c.dropoffPin : c.pickupPin, borderColor: c.routeLineCasing },
      ]}
    >
      {dropoff ? <View style={[styles.inner, { backgroundColor: c.routeLineCasing }]} /> : null}
    </View>
  );
}

type PinProps = GlyphProps & {
  /** Optional bubble above the pin (`caption` on `surface`, radius 8), e.g. "Pickup · 3 min". */
  label?: string | null;
  onLayout?: (event: LayoutChangeEvent) => void;
};

/** Pin with its optional label bubble, bottom-centred on the pin. */
export function RidePin({ kind, index, label, testID, onLayout }: PinProps) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.column} onLayout={onLayout} testID={testID ? `${testID}-view` : undefined}>
      {label ? (
        <View
          style={[styles.bubble, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          testID={testID ? `${testID}-label` : undefined}
        >
          <AppText variant="caption" numberOfLines={1} maxFontSizeMultiplier={1}>
            {label}
          </AppText>
        </View>
      ) : null}
      <PinGlyph kind={kind} index={index} testID={testID ? `${testID}-glyph` : undefined} />
    </View>
  );
}

/** Pin size including the ring, for anchor maths. */
export const pinSize = (kind: PinKind): number => (kind === 'stop' ? p.stopSize : p.size);

/** Anchor that keeps the pin centre on the coordinate even with a label bubble above it. */
export const pinAnchor = (kind: PinKind, viewHeight: number | null): { x: number; y: number } => {
  if (!viewHeight) return { x: 0.5, y: 0.5 };
  const half = pinSize(kind) / 2;
  return { x: 0.5, y: Math.min(1, Math.max(0, (viewHeight - half) / viewHeight)) };
};

const defaultTitle = (kind: PinKind, index?: number): string =>
  kind === 'pickup' ? t('ride.pickupMarker') : kind === 'dropoff' ? t('ride.dropoffMarker') : t('ride.stopMarker', { n: index ?? '' });

type MarkerProps = PinProps & {
  coordinate: LatLng;
  /** Callout/accessibility title; defaults to "Pickup", "Drop-off" or "Stop n". */
  title?: string;
};

/**
 * A custom ride pin on the map (§5.21; replaces Google's default teardrops). The view is
 * snapshotted once it has drawn (`useMarkerTracking`). Memoised (T-534, PERF-12): a parent
 * render with the same point sends nothing to the native marker.
 */
function RideMarkerBase({ kind, index, label, coordinate, title, testID }: MarkerProps) {
  const { theme } = useAppTheme();
  const [height, setHeight] = useState<number | null>(null);
  const tracks = useMarkerTracking(`${theme.mode}|${label ?? ''}|${index ?? ''}|${height ?? 0}`);
  const name = title ?? defaultTitle(kind, index);
  return (
    <Marker
      testID={testID}
      coordinate={coordinate}
      title={name}
      accessibilityLabel={label ? `${name}, ${label}` : name}
      anchor={pinAnchor(kind, label ? height : null)}
      tracksViewChanges={tracks}
      zIndex={kind === 'stop' ? 2 : 3}
    >
      <RidePin
        kind={kind}
        index={index}
        label={label}
        onLayout={label ? e => setHeight(e.nativeEvent.layout.height) : undefined}
      />
    </Marker>
  );
}

const styles = StyleSheet.create({
  column: { alignItems: 'center', gap: p.labelGap },
  pin: { width: p.size, height: p.size, borderWidth: p.ring, alignItems: 'center', justifyContent: 'center' },
  circle: { borderRadius: radius.pill },
  square: { borderRadius: p.dropoffRadius },
  inner: { width: p.dropoffInner, height: p.dropoffInner },
  stop: {
    width: p.stopSize,
    height: p.stopSize,
    borderRadius: radius.pill,
    borderWidth: p.stopRing,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: { borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: space[2], paddingVertical: space[1], maxWidth: p.labelMaxWidth },
});

export const RideMarker = React.memo(RideMarkerBase);
