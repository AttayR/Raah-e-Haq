import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { Card, ListItem } from '../../../components/ui';
import { t } from '../../../i18n';

type Props = {
  onOpenStatements: () => void;
  onOpenStrikes: () => void;
};

/** Earnings › Weekly statements and Strikes (T-521): two rows that open their screens. */
export function EarningsLinksCard({ onOpenStatements, onOpenStrikes }: Props) {
  const { theme } = useAppTheme();
  return (
    <Card padding="none" testID="earnings-links">
      <ListItem
        icon="statement"
        title={t('earnings.statementsEntry')}
        subtitle={t('earnings.statementsEntryBody')}
        onPress={onOpenStatements}
        testID="earnings-statements"
      />
      <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
      <ListItem
        icon="dispute"
        title={t('earnings.strikesEntry')}
        subtitle={t('earnings.strikesEntryBody')}
        onPress={onOpenStrikes}
        testID="earnings-strikes"
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  divider: { height: StyleSheet.hairlineWidth },
});
