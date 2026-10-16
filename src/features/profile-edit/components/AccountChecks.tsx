import React, { useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppDispatch } from '../../../store';
import {
  isStaleSessionRejection,
  resendEmailConfirmation,
  updateUserProfile,
} from '../../../store/thunks/apiThunks';
import type { User } from '../../../services/api';
import { Banner } from '../../../components/ui';
import { rejectionMessage } from '../../../core/api/errors';
import { confirm } from '../../../core/dialog';
import { toast } from '../../../core/toast';
import { formatPkPhone } from '../../safety/rules';
import { t } from '../../../i18n';
import { space } from '../../../theme';

type Props = {
  user: User | null;
  /** Opens Change number / Verify your number. */
  onOpenPhone: () => void;
  /** Account tab: only the number banner (the email ones live on Profile). */
  phoneOnly?: boolean;
  testID?: string;
};

/**
 * What the account still needs, from the profile the server sent (T-504b):
 * - no verified number (BE-35, BE-44: also after a first email proof cleared it): "Verify your number"
 * - a number waiting for its code: "Enter code" (the account keeps its number until then)
 * - an email waiting for its link (BE-38): "Cancel change" sends the current email back
 * - an unconfirmed email (BE-40, safe since BE-47): "Send link", after a warning that opening it
 *   signs out and may remove the number (BE-44); the 401 that follows is the one T-104 logout
 * Nothing shows when nothing is needed. No request is made until a banner is tapped.
 */
export function AccountChecks({ user, onOpenPhone, phoneOnly = false, testID = 'account-checks' }: Props) {
  const dispatch = useAppDispatch();
  const busy = useRef(false);

  const once = useCallback(async (task: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await task();
    } finally {
      busy.current = false;
    }
  }, []);

  const currentEmail = user?.email?.trim() ?? '';

  const cancelEmailChange = useCallback(
    () =>
      once(async () => {
        // BE-38: sending the current email back cancels the pending change (no password needed).
        const result = await dispatch(updateUserProfile({ email: currentEmail }));
        if (updateUserProfile.fulfilled.match(result)) {
          toast.success(t('accountChecks.pendingEmailCancelled'));
        } else if (!isStaleSessionRejection(result.payload)) {
          toast.error(rejectionMessage(result.payload, t('accountChecks.pendingEmailCancelFailed')));
        }
      }),
    [once, dispatch, currentEmail],
  );

  const sendConfirmation = useCallback(
    () =>
      once(async () => {
        const ok = await confirm({
          title: t('accountChecks.confirmEmailDialogTitle'),
          body: t('accountChecks.confirmEmailDialogBody'),
          confirmLabel: t('accountChecks.confirmEmailDialogConfirm'),
          cancelLabel: t('common.cancel'),
        });
        if (!ok) return;
        const result = await dispatch(resendEmailConfirmation());
        if (resendEmailConfirmation.fulfilled.match(result)) {
          toast.success(result.payload.message ?? t('accountChecks.confirmEmailSent'));
          return;
        }
        const payload = result.payload;
        if (isStaleSessionRejection(payload)) return;
        toast.error(
          payload?.status === 429 || payload?.kind === 'rate_limited'
            ? t('accountChecks.confirmEmailLimited')
            : rejectionMessage(payload, t('accountChecks.confirmEmailFailed')),
        );
      }),
    [once, dispatch],
  );

  if (!user) return null;

  const banners: React.ReactNode[] = [];
  const pendingPhone = user.pending_phone ?? null;
  if (pendingPhone) {
    banners.push(
      <Banner
        key="pending-phone"
        tone={user.phone ? 'info' : 'warning'}
        title={t('accountChecks.pendingPhoneTitle')}
        text={t('accountChecks.pendingPhoneBody', { phone: formatPkPhone(pendingPhone) })}
        action={{ label: t('accountChecks.pendingPhoneAction'), onPress: onOpenPhone, testID: `${testID}-pending-phone-action` }}
        testID={`${testID}-pending-phone`}
      />,
    );
  } else if (!user.phone) {
    banners.push(
      <Banner
        key="verify-phone"
        tone="warning"
        title={t('accountChecks.verifyPhoneTitle')}
        text={t('accountChecks.verifyPhoneBody')}
        action={{ label: t('accountChecks.verifyPhoneAction'), onPress: onOpenPhone, testID: `${testID}-verify-phone-action` }}
        testID={`${testID}-verify-phone`}
      />,
    );
  }

  if (!phoneOnly && user.pending_email && currentEmail) {
    banners.push(
      <Banner
        key="pending-email"
        tone="info"
        title={t('accountChecks.pendingEmailTitle')}
        text={t('accountChecks.pendingEmailBody', { email: user.pending_email })}
        action={{ label: t('accountChecks.pendingEmailAction'), onPress: cancelEmailChange, testID: `${testID}-pending-email-action` }}
        testID={`${testID}-pending-email`}
      />,
    );
  }
  if (!phoneOnly && user.email_verified === false && currentEmail) {
    banners.push(
      <Banner
        key="confirm-email"
        tone="warning"
        title={t('accountChecks.confirmEmailTitle')}
        text={t('accountChecks.confirmEmailBody', { email: currentEmail })}
        action={{ label: t('accountChecks.confirmEmailAction'), onPress: sendConfirmation, testID: `${testID}-confirm-email-action` }}
        testID={`${testID}-confirm-email`}
      />,
    );
  }

  if (banners.length === 0) return null;
  return (
    <View style={styles.stack} testID={testID}>
      {banners}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space[3] },
});
