import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { Banner, Button, Screen } from '../../../components/ui';
import { useLogout } from '../../../hooks/useLogout';
import { t } from '../../../i18n';
import type { User } from '../../../services/api';
import { layout, space } from '../../../theme';
import { RestoreHero } from '../components/RestoreHero';
import { useKeepAccount } from '../keepAccount';

type RestoreState = { apiAuth: { user: User | null } };

/**
 * Account restore at sign-in (UI-R18 §D4). AuthFlow shows it before any tab while the signed-in
 * user's `deletion_scheduled_for` is set (login / verify-otp payload or any profile read).
 * "Keep my account" → POST /account/deletion/cancel → the store clears the date and AuthFlow
 * shows the tabs (success Toast); "Sign out" is the normal sign-out (the token still works during
 * the cooling-off period). A failed keep shows a danger Banner with "Try again" in the bar.
 */
export default function AccountRestoreScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const user = useSelector((state: RestoreState) => state.apiAuth.user);
  const { keep, keeping, error } = useKeepAccount();
  const { confirmLogout, isLoggingOut } = useLogout();

  return (
    <Screen edges={['top', 'bottom']} testID="account-restore">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <RestoreHero scheduledFor={user?.deletion_scheduled_for} isDriver={user?.role === 'driver'} />
      </ScrollView>
      <View
        style={[
          styles.actions,
          {
            // §3.2: 8 above the home indicator (Screen pads the inset), at least 16 without one.
            paddingBottom: insets.bottom > 0 ? layout.bottomActionOffset : layout.bottomActionMinOffset,
            borderTopColor: theme.colors.border,
            borderTopWidth: theme.borderWidth.hairline,
            backgroundColor: theme.colors.background,
          },
        ]}
      >
        {error ? (
          <Banner
            tone="danger"
            text={error}
            actionPlacement="below"
            action={{ label: t('accountDeletion.tryAgain'), onPress: keep, testID: 'account-restore-retry' }}
            testID="account-restore-error"
          />
        ) : null}
        <Button
          label={t('accountDeletion.restoreKeep')}
          size="lg"
          onPress={keep}
          loading={keeping}
          disabled={isLoggingOut}
          testID="account-restore-keep"
        />
        <Button
          label={t('accountDeletion.restoreSignOut')}
          variant="ghost"
          size="lg"
          onPress={confirmLogout}
          disabled={keeping || isLoggingOut}
          loading={isLoggingOut}
          testID="account-restore-sign-out"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: layout.gutter,
    paddingVertical: space[6],
  },
  actions: {
    paddingHorizontal: layout.gutter,
    paddingTop: space[3],
    gap: space[3],
  },
});
