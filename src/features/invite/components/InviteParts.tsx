import React from 'react';
import { StyleSheet, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Card, IconButton } from '../../../components/ui';
import { haptics } from '../../../core/haptics';
import { toast } from '../../../core/toast';
import { t } from '../../../i18n';
import { componentTokens, layout, radius, space } from '../../../theme';
import { formatCount, formatMoney } from '../../../utils/format';
import type { InviteStats } from '../api';
import { spelledCode } from '../format';

const k = componentTokens.invite;

/** Copies the code (Toast + selection haptic). */
export const copyInviteCode = (code: string): void => {
  Clipboard.setString(code);
  haptics.selection();
  toast.success(t('invite.copied'));
};

/**
 * The code row inside the invite card (§I2.1): the code large and spaced, selectable (long-press
 * copy works without the module), one line at any text size; Copy at the end.
 */
export function InviteCodeRow({ code }: { code: string }) {
  const { theme } = useAppTheme();
  const spelled = spelledCode(code);
  return (
    <View
      style={[styles.codeRow, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: theme.borderWidth.thin }]}
      testID="invite-code-row"
    >
      <AppText
        variant="numericL"
        selectable
        numberOfLines={1}
        maxFontSizeMultiplier={k.codeMaxFontScale}
        accessibilityLabel={t('invite.codeA11y', { code: spelled })}
        style={styles.code}
        testID="invite-code"
      >
        {code}
      </AppText>
      <IconButton
        icon="copy"
        variant="tonal"
        iconColor="primaryText"
        onPress={() => copyInviteCode(code)}
        accessibilityLabel={t('invite.copyA11y', { code: spelled })}
        testID="invite-copy"
      />
    </View>
  );
}

/** "How it works" (§I2.3): numbered rows in one card, and the expiry line when sent. */
export function InviteSteps({ steps, expires }: { steps: string[]; expires: string | null }) {
  const { theme } = useAppTheme();
  return (
    <View testID="invite-steps">
      <AppText variant="overline" color="textMuted" accessibilityRole="header" style={styles.overline}>
        {t('invite.howOverline')}
      </AppText>
      <Card padding="none">
        {steps.map((step, index) => (
          <View key={step} style={styles.step} testID={`invite-step-${index + 1}`}>
            <View style={[styles.stepCircle, { backgroundColor: theme.colors.primarySoft }]}>
              <AppText variant="numericSmall" color="onPrimarySoft">
                {String(index + 1)}
              </AppText>
            </View>
            <AppText variant="body" style={styles.flex}>
              {step}
            </AppText>
          </View>
        ))}
      </Card>
      {expires ? (
        <AppText variant="caption" color="textMuted" style={styles.expires} testID="invite-expires">
          {expires}
        </AppText>
      ) : null}
    </View>
  );
}

/** "Your invites" (§I2.4): Joined · Took a ride · Earned. The caller hides it at zero. */
export function InviteStatsStrip({ stats, currency }: { stats: InviteStats; currency: string | null }) {
  const { theme } = useAppTheme();
  const cells = [
    { key: 'joined', label: t('invite.statJoined'), value: formatCount(stats.joined) },
    { key: 'rode', label: t('invite.statRode'), value: formatCount(stats.rode) },
    { key: 'earned', label: t('invite.statEarned'), value: formatMoney(stats.earned, currency) },
  ];
  return (
    <View testID="invite-stats">
      <AppText variant="overline" color="textMuted" accessibilityRole="header" style={styles.overline}>
        {t('invite.statsOverline')}
      </AppText>
      <Card style={styles.strip}>
        <View style={styles.cells}>
          {cells.map((cell, index) => (
            <React.Fragment key={cell.key}>
              {index > 0 ? <View style={[styles.rule, { backgroundColor: theme.colors.border, width: theme.borderWidth.hairline }]} /> : null}
              <View
                style={styles.cell}
                accessible
                accessibilityLabel={t('invite.statA11y', { label: cell.label, value: cell.value })}
                testID={`invite-stat-${cell.key}`}
              >
                <AppText variant="numericL" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                  {cell.value}
                </AppText>
                <AppText variant="caption" color="textSecondary" align="center" numberOfLines={2}>
                  {cell.label}
                </AppText>
              </View>
            </React.Fragment>
          ))}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  codeRow: {
    height: k.codeRowHeight,
    borderRadius: radius.md,
    paddingStart: space[4],
    paddingEnd: space[1],
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space[3] - space[1],
  },
  code: { flex: 1, letterSpacing: k.codeLetterSpacing, writingDirection: 'ltr' },
  overline: { marginBottom: layout.sectionHeaderGap, marginStart: space[4] },
  step: { minHeight: k.stepMinHeight, paddingVertical: space[3], paddingHorizontal: space[4], flexDirection: 'row', alignItems: 'center', gap: space[3] },
  stepCircle: { width: k.stepCircle, height: k.stepCircle, borderRadius: k.stepCircle / 2, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  expires: { marginTop: space[2], marginHorizontal: space[4] },
  strip: { paddingVertical: space[4], paddingHorizontal: space[2] },
  cells: { flexDirection: 'row', alignItems: 'center' },
  cell: { flex: 1, alignItems: 'center', gap: space[1] / 2 },
  rule: { height: space[10], alignSelf: 'center' },
});
