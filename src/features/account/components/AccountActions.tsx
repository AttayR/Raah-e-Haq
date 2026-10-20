import React from 'react';
import { ListGroup, ListItem } from '../../../components/ui';
import { t } from '../../../i18n';

/**
 * Profile's last group (shared-profile §P6, UI-R18): "Delete account" as a destructive row
 * (store rule: Account → Profile → Delete account in three taps), opening `DeleteAccount`
 * (BE-129). "Change password" joins this group only when the app has that screen.
 */
export function AccountActions({ onDeleteAccount, testID }: { onDeleteAccount: () => void; testID: string }) {
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
