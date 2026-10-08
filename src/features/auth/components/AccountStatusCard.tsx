import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Typography } from '../../../theme/typography';
import type { AppTheme } from '../../../theme';
import { SUPPORT_EMAIL } from '../../../config/support';
import { ACCOUNT_STATUS_COPY } from '../copy/accountStatus';
import type { AccountStatusView } from '../accountStatus';
import { RADIUS, SPACING, toneColor } from './accountStatusStyles';

interface Props {
  view: AccountStatusView;
  colors: AppTheme['colors'];
}

/** The status card: icon, title, message, rejection reason (memory only), notes, support. */
export default function AccountStatusCard({ view, colors }: Props) {
  const accent = toneColor(view.tone, colors);
  return (
    <View
      testID={`account-status-${view.variant}`}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={[styles.iconRing, { borderColor: accent }]}>
        <Icon name={view.icon} size={40} color={accent} />
      </View>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        {view.title}
      </Text>
      <Text style={[styles.message, { color: colors.mutedText }]}>{view.message}</Text>

      {view.reason ? (
        <View testID="account-status-reason" style={[styles.reason, { borderColor: accent }]}>
          <Text style={[styles.reasonLabel, { color: accent }]}>{ACCOUNT_STATUS_COPY.reasonLabel}</Text>
          <Text style={[styles.reasonText, { color: colors.text }]}>{view.reason}</Text>
        </View>
      ) : null}

      <View style={styles.notes}>
        {view.notes.map(note => (
          <View key={note} style={styles.noteRow}>
            <Icon name="chevron-right" size={18} color={colors.mutedText} />
            <Text style={[styles.noteText, { color: colors.mutedText }]}>{note}</Text>
          </View>
        ))}
        {view.showSupport ? (
          <View style={styles.noteRow}>
            <Icon name="mail-outline" size={18} color={colors.mutedText} />
            <Text style={[styles.noteText, { color: colors.mutedText }]}>
              {`${ACCOUNT_STATUS_COPY.supportPrefix} ${SUPPORT_EMAIL}`}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  iconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    ...Typography.title,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  message: {
    ...Typography.body,
    textAlign: 'center',
  },
  reason: {
    alignSelf: 'stretch',
    borderLeftWidth: 3,
    paddingLeft: SPACING.md,
    paddingVertical: SPACING.xs,
    marginTop: SPACING.lg,
  },
  reasonLabel: {
    ...Typography.small,
    marginBottom: SPACING.xs,
  },
  reasonText: {
    ...Typography.body,
  },
  notes: {
    alignSelf: 'stretch',
    marginTop: SPACING.lg,
    gap: SPACING.sm,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
  },
  noteText: {
    ...Typography.subtitle,
    flex: 1,
  },
});
