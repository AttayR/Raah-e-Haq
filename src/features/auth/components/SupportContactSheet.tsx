import React, { useCallback } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { AppText, BottomSheet, ListItem } from '../../../components/ui';
import { SUPPORT_EMAIL } from '../../../config/support';
import { toast } from '../../../core/toast';
import { space } from '../../../theme';
import { ACCOUNT_STATUS_COPY as COPY } from '../copy/accountStatus';

type Props = { visible: boolean; onClose: () => void };

/**
 * "Contact support" sheet of the account-status screen (UI-R8, auth-account-status): one row per
 * support channel the app knows. Today that is the support email (config/support.ts); the spec's
 * phone row stays hidden until a support phone exists (GET /settings/public has none yet).
 */
export function SupportContactSheet({ visible, onClose }: Props) {
  const email = useCallback(() => {
    onClose();
    Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => toast.info(COPY.emailFailed(SUPPORT_EMAIL)));
  }, [onClose]);

  return (
    <BottomSheet
      mode="modal"
      visible={visible}
      onClose={onClose}
      accessibilityLabel={COPY.supportSheetTitle}
      testID="account-status-support-sheet"
    >
      <View style={styles.body}>
        <AppText variant="h3" accessibilityRole="header" style={styles.title}>
          {COPY.supportSheetTitle}
        </AppText>
        <ListItem
          icon="email"
          title={COPY.emailSupport(SUPPORT_EMAIL)}
          onPress={email}
          accessibilityHint={COPY.emailSupportHint}
          testID="account-status-support-email"
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: space[4] },
  title: { paddingHorizontal: space[4], paddingBottom: space[2] },
});
