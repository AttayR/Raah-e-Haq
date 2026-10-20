import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { AppText, Illustration } from '../../../components/ui';
import { t } from '../../../i18n';
import { componentTokens, space } from '../../../theme';
import { formatDeletionDate } from '../format';

/**
 * §D4 hero (the auth-account-status frame): the `accountRemove` illustration with the danger
 * badge, "Your account is set to be deleted" and the server's date, per role.
 */
export function RestoreHero({ scheduledFor, isDriver }: { scheduledFor: string | null | undefined; isDriver: boolean }) {
  const { height } = useWindowDimensions();
  const compact = height < componentTokens.auth.compactWindowHeight;
  const date = formatDeletionDate(scheduledFor);
  return (
    <View style={styles.wrap} testID="account-restore-hero">
      <Illustration
        icon="accountRemove"
        badge={{ icon: 'failed', tone: 'danger' }}
        size={compact ? 'compact' : 'regular'}
        testID="account-restore-illustration"
      />
      <AppText variant="h2" align="center" accessibilityRole="header" style={styles.title}>
        {t('accountDeletion.restoreTitle')}
      </AppText>
      {date ? (
        <AppText variant="body" color="textSecondary" align="center" style={styles.body} testID="account-restore-body">
          {t(isDriver ? 'accountDeletion.restoreBodyDriver' : 'accountDeletion.restoreBodyPassenger', { date })}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  title: { marginTop: space[6], maxWidth: componentTokens.illustration.textMaxWidth },
  body: { marginTop: space[2], maxWidth: componentTokens.illustration.textMaxWidth },
});
