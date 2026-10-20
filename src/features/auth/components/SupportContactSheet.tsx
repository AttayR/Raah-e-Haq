import React, { useCallback } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { AppText, BottomSheet, ListItem } from '../../../components/ui';
import { toast } from '../../../core/toast';
import { t } from '../../../i18n';
import { formatPkPhone } from '../../safety/rules';
import { phoneDigits } from '../../support/format';
import { useSupportContacts } from '../../support/hooks';
import { space } from '../../../theme';
import { ACCOUNT_STATUS_COPY as COPY } from '../copy/accountStatus';

type Props = { visible: boolean; onClose: () => void };

/**
 * "Contact support" sheet of the account-status screen (UI-R8, auth-account-status): one row per
 * support channel GET /settings/public sends (UI-R18: the same session-cached read as Help & support),
 * the phone first; before it answers, the configured email (config/support.ts).
 */
export function SupportContactSheet({ visible, onClose }: Props) {
  const { contacts } = useSupportContacts(visible);
  const { supportEmail, supportPhone } = contacts;
  const email = useCallback(() => {
    if (!supportEmail) return;
    onClose();
    Linking.openURL(`mailto:${supportEmail}`).catch(() => toast.info(COPY.emailFailed(supportEmail)));
  }, [onClose, supportEmail]);
  const call = useCallback(() => {
    if (!supportPhone) return;
    onClose();
    Linking.openURL(`tel:${phoneDigits(supportPhone)}`).catch(() => toast.info(t('support.openFailed', { value: supportPhone })));
  }, [onClose, supportPhone]);

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
        {supportPhone ? (
          <ListItem
            icon="phone"
            title={t('support.callSupport')}
            subtitle={formatPkPhone(supportPhone)}
            onPress={call}
            testID="account-status-support-phone"
          />
        ) : null}
        {supportEmail ? (
          <ListItem
            icon="email"
            title={COPY.emailSupport(supportEmail)}
            onPress={email}
            accessibilityHint={COPY.emailSupportHint}
            testID="account-status-support-email"
          />
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: space[4] },
  title: { paddingHorizontal: space[4], paddingBottom: space[2] },
});
