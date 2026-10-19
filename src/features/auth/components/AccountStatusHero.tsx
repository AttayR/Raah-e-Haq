import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { AppText, Card, Illustration } from '../../../components/ui';
import { componentTokens, space } from '../../../theme';
import { ACCOUNT_STATUS_COPY } from '../copy/accountStatus';
import type { AccountStatusView } from '../accountStatus';

type Props = {
  view: AccountStatusView;
  /** The profile name; pending accounts get "Hi {first name}." in front of the message. */
  name?: string | null;
};

const firstName = (name?: string | null): string => (name ?? '').trim().split(/\s+/)[0] ?? '';

/**
 * Top of the account-status screen (UI-R8, auth-account-status): duotone illustration, `h1` title
 * (max 320), one `body` paragraph in `textSecondary`, and for rejected / suspended accounts the
 * server's reason (memory only, T-106) in an outlined card; with a reason the paragraph reads
 * "Contact support if you have questions." (UI-R8 review).
 */
export function AccountStatusHero({ view, name }: Props) {
  const { height } = useWindowDimensions();
  const compact = height < componentTokens.auth.compactWindowHeight;
  const first = firstName(name);
  const pending = view.variant === 'pendingDriver' || view.variant === 'pendingPassenger';
  const message = view.reason
    ? ACCOUNT_STATUS_COPY.reasonFollowUp
    : pending && first
      ? `${ACCOUNT_STATUS_COPY.greeting(first)} ${view.message}`
      : view.message;
  return (
    <View style={styles.wrap} testID={`account-status-${view.variant}`}>
      <Illustration
        icon={view.icon}
        badge={view.badge ?? undefined}
        size={compact ? 'compact' : 'regular'}
        testID="account-status-illustration"
      />
      <AppText variant="h1" align="center" accessibilityRole="header" style={styles.title}>
        {view.title}
      </AppText>
      <AppText variant="body" color="textSecondary" align="center" style={styles.body}>
        {message}
      </AppText>
      {view.reason ? (
        <Card variant="outlined" style={styles.reason} testID="account-status-reason">
          <AppText variant="label" color="textSecondary">
            {ACCOUNT_STATUS_COPY.reasonLabel}
          </AppText>
          <AppText variant="body" style={styles.reasonText}>
            {view.reason}
          </AppText>
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  title: { marginTop: space[6], maxWidth: componentTokens.illustration.textMaxWidth },
  body: { marginTop: space[2], maxWidth: componentTokens.illustration.textMaxWidth },
  reason: { alignSelf: 'stretch', marginTop: space[6] },
  reasonText: { marginTop: space[1] },
});
