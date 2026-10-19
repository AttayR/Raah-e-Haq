import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Banner, Button, Header, Screen } from '../../../components/ui';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { layout, space } from '../../../theme';
import { ACCOUNT_STATUS_COPY } from '../copy/accountStatus';
import type { AccountStatusView } from '../accountStatus';
import { AccountStatusHero } from './AccountStatusHero';
import { SupportContactSheet } from './SupportContactSheet';

export type AccountStatusLayoutProps = {
  view: AccountStatusView;
  name?: string | null;
  /** The pending driver's documents list (DriverDocumentsList), or nothing. */
  documents?: React.ReactNode;
  checking: boolean;
  /** Inline Check status error (danger Banner at the top of the action bar). */
  error: string | null;
  isLoggingOut: boolean;
  onCheckStatus: () => void;
  onSignOut: () => void;
  /** Debug gallery only: open with the support sheet up. */
  initialSupportOpen?: boolean;
};

/**
 * Account-status layout (UI-R8, auth-account-status), state in, events out (the screen owns the
 * hooks): header "Sign out" (disabled while signing out), scrolling hero + documents with pull to
 * refresh = Check status, and the sticky action bar (check error Banner, "Check status",
 * "Contact support" → SupportContactSheet).
 */
export function AccountStatusLayout({
  view,
  name,
  documents,
  checking,
  error,
  isLoggingOut,
  onCheckStatus,
  onSignOut,
  initialSupportOpen = false,
}: AccountStatusLayoutProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  // §3.2: sticky actions sit 8 above the home indicator, at least 16 from the edge without one.
  const actionsBottom = insets.bottom > 0 ? layout.bottomActionOffset : layout.bottomActionMinOffset;
  const [supportOpen, setSupportOpen] = useState(initialSupportOpen);
  const openSupport = useCallback(() => setSupportOpen(true), []);
  const closeSupport = useCallback(() => setSupportOpen(false), []);

  return (
    <Screen edges={['top', 'bottom']} testID="account-status">
      <Header
        tone="background"
        trailingText={{
          label: isLoggingOut ? ACCOUNT_STATUS_COPY.signingOut : ACCOUNT_STATUS_COPY.signOut,
          onPress: onSignOut,
          disabled: isLoggingOut,
          testID: 'account-status-sign-out',
        }}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          view.canCheckStatus ? (
            <RefreshControl
              refreshing={checking}
              onRefresh={onCheckStatus}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          ) : undefined
        }
      >
        <AccountStatusHero view={view} name={name} />
        {documents ? <View style={styles.documents}>{documents}</View> : null}
      </ScrollView>
      <View
        style={[
          styles.actions,
          { paddingBottom: actionsBottom, borderTopColor: theme.colors.border, backgroundColor: theme.colors.background },
        ]}
      >
        {error ? <Banner tone="danger" text={error} testID="account-status-check-error" /> : null}
        {view.canCheckStatus ? (
          <Button
            label={ACCOUNT_STATUS_COPY.checkStatus}
            onPress={onCheckStatus}
            size="lg"
            loading={checking}
            disabled={isLoggingOut}
            accessibilityHint={ACCOUNT_STATUS_COPY.checkStatusHint}
            testID="account-status-check"
          />
        ) : null}
        <Button
          label={ACCOUNT_STATUS_COPY.contactSupport}
          onPress={openSupport}
          variant="outline"
          size="lg"
          leadingIcon="support"
          testID="account-status-contact-support"
        />
      </View>
      <SupportContactSheet visible={supportOpen} onClose={closeSupport} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: layout.gutter,
    paddingTop: space[6],
    paddingBottom: space[6],
  },
  documents: { marginTop: space[8] },
  actions: {
    paddingHorizontal: layout.gutter,
    paddingTop: space[3],
    gap: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
