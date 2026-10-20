import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { t } from '../../../i18n';
import { componentTokens, space } from '../../../theme';
import { AppText, type TextColor } from '../AppText';
import { Icon, type IconName } from '../Icon';
import { useChangeFade } from './useCrossfade';

const k = componentTokens.tripSheet;

/** The ETA tile's number: 1…99, "99+" above (shared-trip-sheet TS3); null hides the tile. */
export const etaTileValue = (minutes: number | null | undefined): string | null => {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes)) return null;
  const whole = Math.max(1, Math.ceil(minutes));
  return whole > k.etaMax ? t('ride.etaMore') : String(whole);
};

/**
 * The ETA as spoken ("5 minutes away"), or null without one. It is read with the subtitle, never
 * with the title: the title is the live region and must announce state changes only (TS3).
 */
export const etaA11y = (minutes: number | null | undefined): string | null => {
  if (etaTileValue(minutes) === null) return null;
  const n = Math.max(1, Math.ceil(minutes as number));
  return n === 1 ? t('ride.etaAwayA11yOne') : t('ride.etaAwayA11y', { n: String(Math.min(n, k.etaMax)) });
};

/**
 * ETA tile (shared-trip-sheet TS3, kit): 56 × 56, radius `md`, `primarySoft`, the minutes in
 * `numericL` over "min", both `onPrimarySoft`. Not focusable (the header reads it). Nothing is
 * drawn without an ETA: never a dash or a guess.
 */
export function EtaTile({
  minutes,
  readable = false,
  testID = 'eta-tile',
}: {
  minutes: number | null | undefined;
  /** Focusable with its spoken ETA (only when there is no subtitle to carry it). */
  readable?: boolean;
  testID?: string;
}) {
  const { theme } = useAppTheme();
  const value = etaTileValue(minutes);
  const fade = useChangeFade(value);
  if (value === null) return null;
  return (
    <View
      style={[styles.tile, { backgroundColor: theme.colors.primarySoft }]}
      {...(readable
        ? { accessible: true, accessibilityLabel: etaA11y(minutes) ?? undefined }
        : { importantForAccessibility: 'no-hide-descendants' as const, accessibilityElementsHidden: true })}
      testID={testID}
    >
      <Animated.View style={fade}>
        <AppText variant="numericL" color="onPrimarySoft" align="center" numberOfLines={1} testID={`${testID}-value`}>
          {value}
        </AppText>
      </Animated.View>
      <AppText variant="caption" color="onPrimarySoft" align="center" numberOfLines={1}>
        {t('ride.etaUnit')}
      </AppText>
    </View>
  );
}

export type TripStatusHeaderProps = {
  /** A status sentence ("Driver is on the way"), `h2`, up to 2 lines. */
  title: string;
  subtitle?: string | null;
  /** `textSecondary` by default; `textMuted` (stale location), `warning` (offline), `danger`. */
  subtitleTone?: Extract<TextColor, 'textSecondary' | 'textMuted' | 'warning' | 'danger'>;
  /** A 16 glyph before the subtitle in its tone (offline: `offline`). */
  subtitleIcon?: IconName | null;
  /** AC / Parcel / women-mode badges at the start of the subtitle row, never in the title row. */
  badges?: React.ReactNode;
  /** The server ETA (BE-128 `eta.minutes`); null or absent hides the tile. */
  etaMinutes?: number | null;
  testID?: string;
};

/**
 * Trip sheet status header (shared-trip-sheet TS3, kit, both roles): status sentence `h2` and a
 * `bodySmall` subtitle (badges first), with the 56 ETA tile at the end while an ETA is known; 56
 * high with the tile. The title fades in on a change of state; the tile's number on a new ETA.
 */
export function TripStatusHeader({
  title,
  subtitle,
  subtitleTone = 'textSecondary',
  subtitleIcon,
  badges,
  etaMinutes,
  testID = 'trip-status-header',
}: TripStatusHeaderProps) {
  const titleFade = useChangeFade(title);
  const hasEta = etaTileValue(etaMinutes) !== null;
  const hasSubtitleRow = !!subtitle || !!badges;
  const eta = etaA11y(etaMinutes);
  return (
    <View style={[styles.row, hasEta ? styles.withTile : null]} testID={testID}>
      <View style={styles.text}>
        <Animated.View style={titleFade}>
          {/* The live region is the title alone (Android; iOS announces stage changes itself), so
              ETA and subtitle ticks ("Arriving at …", "Location updated …") are never announced. */}
          <AppText variant="h2" numberOfLines={2} accessibilityRole="header" accessibilityLiveRegion="polite" testID="active-ride-title">
            {title}
          </AppText>
        </Animated.View>
        {hasSubtitleRow ? (
          <View style={styles.subtitleRow}>
            {badges}
            {subtitle ? (
              <View style={styles.subtitle}>
                {subtitleIcon ? <Icon name={subtitleIcon} size={16} color={subtitleTone} /> : null}
                <AppText
                  variant="bodySmall"
                  color={subtitleTone}
                  numberOfLines={2}
                  style={styles.flex}
                  accessibilityLabel={eta ? `${eta}. ${subtitle}` : undefined}
                  testID="active-ride-subtitle"
                >
                  {subtitle}
                </AppText>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      <EtaTile minutes={etaMinutes} readable={!subtitle} testID={`${testID}-eta`} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: k.headerGap },
  withTile: { minHeight: k.headerMinHeight },
  text: { flex: 1, minWidth: 0, gap: k.titleGap },
  subtitleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[2] },
  subtitle: { flexDirection: 'row', alignItems: 'center', gap: space[1], flexShrink: 1, minWidth: 0 },
  flex: { flexShrink: 1 },
  tile: {
    width: k.etaTile,
    height: k.etaTile,
    borderRadius: k.etaTileRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
