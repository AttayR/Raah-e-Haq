import React from 'react';
import type { User } from '../../../services/api';
import { Badge, Button, ListGroup, ListItem, type IconName } from '../../../components/ui';
import { formatCalendarDate, formatGender } from '../../../components/passenger/settings/format';
import { formatPkPhone } from '../../safety/rules';
import { t } from '../../../i18n';

type InfoState = 'verified' | 'notConfirmed';

export type InfoRow = {
  key: 'phone' | 'email' | 'gender' | 'dob' | 'address' | 'bio';
  icon: IconName;
  label: string;
  value: string;
  state?: InfoState;
  /** Free text (address, bio): shown in full instead of two lines. */
  long?: boolean;
};

/** The rows the server actually sent, in spec order; nulls and blanks are left out (shared-profile §P4). */
export const profileInfoRows = (user: User | null): InfoRow[] => {
  if (!user) return [];
  const rows: InfoRow[] = [];
  if (user.phone) {
    rows.push({
      key: 'phone',
      icon: 'phone',
      label: t('profile.phone'),
      value: formatPkPhone(user.phone),
      state: user.phone_verified_at ? 'verified' : undefined,
    });
  }
  const email = user.email?.trim();
  if (email) {
    const state: InfoState | undefined =
      user.email_verified === true ? 'verified' : user.email_verified === false ? 'notConfirmed' : undefined;
    rows.push({ key: 'email', icon: 'email', label: t('profile.email'), value: email, state });
  }
  const gender = formatGender(user.gender);
  if (gender) rows.push({ key: 'gender', icon: 'account', label: t('profile.gender'), value: gender });
  const dob = formatCalendarDate(user.date_of_birth);
  if (dob) rows.push({ key: 'dob', icon: 'calendar', label: t('profile.dateOfBirth'), value: dob });
  const address = user.address?.trim();
  if (address) rows.push({ key: 'address', icon: 'pin', label: t('profile.address'), value: address, long: true });
  const bio = user.bio?.trim();
  if (bio) rows.push({ key: 'bio', icon: 'info', label: t('profile.about'), value: bio, long: true });
  return rows;
};

const stateLabel = (state: InfoState): string => (state === 'verified' ? t('profile.verified') : t('profile.emailNotConfirmed'));

/**
 * "Personal info" (shared-profile §P4), both roles: read-only two-line rows with no chevrons
 * (editing is Profile → Edit). Phone and email carry "Verified" when the server says so; an email
 * the server marks unproven says "Not confirmed" (the account-check Banner says what to do).
 * With no rows at all, one ghost button opens the edit form.
 */
export const ProfileInfoList = React.memo(function ProfileInfoList({
  user,
  onAddDetails,
  testIDPrefix,
}: {
  user: User | null;
  onAddDetails: () => void;
  testIDPrefix: string;
}) {
  const rows = profileInfoRows(user);
  if (rows.length === 0) {
    return (
      <Button
        variant="ghost"
        size="md"
        label={t('profile.addDetails')}
        onPress={onAddDetails}
        testID={`${testIDPrefix}-add-details`}
      />
    );
  }
  return (
    <ListGroup title={t('profile.personalInfo')} testID={`${testIDPrefix}-info`}>
      {rows.map((row) => (
        <ListItem
          key={row.key}
          icon={row.icon}
          title={row.label}
          subtitle={row.value}
          subtitleNumberOfLines={row.long ? 0 : undefined}
          accessibilityLabel={[row.label, row.value, row.state ? stateLabel(row.state) : null].filter(Boolean).join(', ')}
          trailing={
            row.state ? (
              <Badge tone={row.state === 'verified' ? 'success' : 'warning'} label={stateLabel(row.state)} testID={`${testIDPrefix}-${row.key}-state`} />
            ) : undefined
          }
          testID={`${testIDPrefix}-${row.key}`}
        />
      ))}
    </ListGroup>
  );
});
