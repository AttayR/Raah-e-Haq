import React from 'react';
import { I18nManager, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Icon, type IconName } from '../../../components/ui';
import { usePressScale } from '../../../components/ui/usePressScale';
import { t } from '../../../i18n';
import { componentTokens, radius, space } from '../../../theme';
import type { DriverStrikes } from '../../driver-statements/types';
import { strikeLine, type StrikeLine } from '../strikeLine';

const k = componentTokens.earnings.tile;

type TileProps = {
  icon: IconName;
  title: string;
  status: StrikeLine;
  onPress: () => void;
  testID: string;
};

/** One link tile (§3.2): icon tile + chevron, title, status line. The whole tile is the target. */
export function EarningsLinkTile({ icon, title, status, onPress, testID }: TileProps) {
  const { theme } = useAppTheme();
  const { colors, elevation, borderWidth } = theme;
  const dark = theme.mode === 'dark';
  const press = usePressScale();
  return (
    <Animated.View style={[styles.tileWrap, press.animatedStyle]}>
      <Pressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityLabel={t('earnings.tileA11y', { title, status: status.text })}
        accessibilityHint={t('earnings.tileHint', { title })}
        testID={testID}
        style={({ pressed }) => [
          styles.tile,
          elevation[1],
          // Dark cards read as cards through a 1pt border, as Card does.
          dark ? { borderWidth: borderWidth.thin, borderColor: colors.border } : null,
          { backgroundColor: pressed ? colors.surfacePressed : colors.surface },
        ]}
      >
        <View style={styles.top}>
          <View style={[styles.iconTile, { backgroundColor: colors.surfaceAlt }]}>
            <Icon name={icon} size={k.glyph} color="primaryText" />
          </View>
          <View style={I18nManager.isRTL ? styles.flip : null}>
            <Icon name="chevronEnd" size={k.chevron} color="textMuted" />
          </View>
        </View>
        <AppText variant="bodyStrong" numberOfLines={2} style={styles.title}>
          {title}
        </AppText>
        <View style={styles.status}>
          {status.icon ? (
            <View style={styles.statusIcon}>
              <Icon name={status.icon} size={k.statusIcon} color={status.tone} />
            </View>
          ) : null}
          <AppText variant="caption" color={status.tone} numberOfLines={2} style={styles.statusText} testID={`${testID}-status`}>
            {status.text}
          </AppText>
        </View>
      </Pressable>
    </Animated.View>
  );
}

type Props = {
  /** GET /driver/strikes summary; null while not loaded (or failed): the static line. */
  strikes: DriverStrikes | null;
  onOpenStatements: () => void;
  onOpenStrikes: () => void;
};

const STATEMENTS_STATUS = (): StrikeLine => ({ text: t('earnings.statementsTileBody'), tone: 'textSecondary', icon: null });

/**
 * Earnings › Weekly statements, then Strikes (UI-R17 round 2, driver-earnings.md §3.2): two
 * equal tiles side by side on every width. The strike state comes from the server only.
 */
function EarningsLinkTilesView({ strikes, onOpenStatements, onOpenStrikes }: Props) {
  return (
    <View style={styles.row} testID="earnings-links">
      <EarningsLinkTile
        icon="statement"
        title={t('earnings.statementsTile')}
        status={STATEMENTS_STATUS()}
        onPress={onOpenStatements}
        testID="earnings-statements"
      />
      <EarningsLinkTile
        icon="dispute"
        title={t('earnings.strikesTile')}
        status={strikeLine(strikes)}
        onPress={onOpenStrikes}
        testID="earnings-strikes"
      />
    </View>
  );
}

export const EarningsLinkTiles = React.memo(EarningsLinkTilesView);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space[3] },
  tileWrap: { flex: 1 },
  tile: { flex: 1, minHeight: k.minHeight, padding: space[3], borderRadius: radius.lg },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  iconTile: { width: k.iconTile, height: k.iconTile, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  flip: { transform: [{ scaleX: -1 }] },
  title: { marginTop: space[3] },
  status: { flexDirection: 'row', alignItems: 'flex-start', gap: space[1], marginTop: space[1] / 2 },
  // Keeps the 14 glyph on the first 16-pt caption line.
  statusIcon: { height: space[4], justifyContent: 'center' },
  statusText: { flex: 1 },
});
