import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Card } from '../../../components/ui';
import { space } from '../../../theme';

/** One label / amount line of a statement card, with a hairline between lines. */
export function StatementRow({
  label,
  value,
  strong = false,
  first = false,
  testID,
}: {
  label: string;
  value: string;
  strong?: boolean;
  first?: boolean;
  testID?: string;
}) {
  const { theme } = useAppTheme();
  return (
    <View
      style={[styles.row, first ? null : { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border }]}
      testID={testID}
    >
      <AppText variant={strong ? 'bodyStrong' : 'bodySmall'} color={strong ? 'textPrimary' : 'textSecondary'} style={styles.label}>
        {label}
      </AppText>
      <AppText variant={strong ? 'numeric' : 'numericSmall'} align="end" selectable>
        {value}
      </AppText>
    </View>
  );
}

/** A titled card of statement rows (`rows` with a falsy entry are skipped). */
export function StatementCard({
  title,
  rows,
  footer,
  testID,
}: {
  title: string;
  rows: ReadonlyArray<{ key: string; label: string; value: string; strong?: boolean } | null | false>;
  footer?: React.ReactNode;
  testID?: string;
}) {
  const shown = rows.filter((row): row is { key: string; label: string; value: string; strong?: boolean } => !!row);
  return (
    <Card testID={testID}>
      <AppText variant="overline" color="textMuted" accessibilityRole="header" style={styles.title}>
        {title}
      </AppText>
      {shown.map((row, index) => (
        <StatementRow
          key={row.key}
          label={row.label}
          value={row.value}
          strong={row.strong}
          first={index === 0}
          testID={testID ? `${testID}-${row.key}` : undefined}
        />
      ))}
      {footer}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[2], minHeight: 36 },
  label: { flex: 1, minWidth: 0 },
  title: { marginBottom: space[1] },
});
