import React from 'react';
import { ListGroup, ListItem } from '../../../components/ui';
import { t } from '../../../i18n';

/**
 * UI-R18 hook-up point (shared-profile §P6): Profile's last group, "Delete account" as a
 * destructive row (store rule: Account → Profile → Delete account in three taps). It renders
 * only when the caller passes `onDeleteAccount`, which UI-R18 does once BE-129 ships and the
 * `DeleteAccount` route exists. Until then nothing is drawn (no row that opens nothing).
 * "Change password" joins this group only when the app has that screen.
 */
export function AccountActions({ onDeleteAccount, testID }: { onDeleteAccount?: () => void; testID: string }) {
  if (!onDeleteAccount) return null;
  return (
    <ListGroup testID={testID}>
      <ListItem
        icon="accountRemove"
        title={t('profile.deleteAccount')}
        destructive
        onPress={onDeleteAccount}
        testID={`${testID}-delete`}
      />
    </ListGroup>
  );
}
