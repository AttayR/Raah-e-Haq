import React from 'react';
import type { User } from '../../../services/api';
import { AppText, Badge, Card, ListGroup, ListItem, type IconName } from '../../ui';
import { PASSENGER_SETTINGS_COPY as COPY } from './copy';
import { formatCalendarDate, formatGender } from './format';

type InfoRow = { key: string; icon: IconName; label: string; value: string; verified?: boolean };

/** The rows the server actually sent; nulls and blanks are left out (shared-profile §4). */
export const profileInfoRows = (user: User | null): InfoRow[] => {
  if (!user) {
    return [];
  }
  const email = user.email?.trim() || null;
  const gender = formatGender(user.gender);
  const dob = formatCalendarDate(user.date_of_birth);
  const rows: InfoRow[] = [];
  if (user.phone) {
    rows.push({ key: 'phone', icon: 'phone', label: COPY.phone, value: user.phone, verified: !!user.phone_verified_at });
  }
  if (email) {
    rows.push({ key: 'email', icon: 'email', label: COPY.email, value: email });
  }
  if (gender) {
    rows.push({ key: 'gender', icon: 'account', label: COPY.gender, value: gender });
  }
  if (dob) {
    rows.push({ key: 'dob', icon: 'calendar', label: COPY.dateOfBirth, value: dob });
  }
  return rows;
};

/**
 * "Personal info" (shared-profile §3–4): read-only two-line rows, no chevrons (editing is
 * T-504). Phone shows "Verified" only when the server set `phone_verified_at`.
 */
export function ProfileInfoList({ user }: { user: User | null }) {
  const rows = profileInfoRows(user);
  if (rows.length === 0) {
    return (
      <Card testID="passenger-profile-info-empty">
        <AppText variant="bodySmall" color="textSecondary">
          {COPY.noDetails}
        </AppText>
      </Card>
    );
  }
  return (
    <ListGroup title={COPY.personalInfo} testID="passenger-profile-info">
      {rows.map((row) => (
        <ListItem
          key={row.key}
          icon={row.icon}
          title={row.label}
          subtitle={row.value}
          accessibilityLabel={`${row.label}, ${row.value}${row.verified ? `, ${COPY.verified}` : ''}`}
          trailing={row.verified ? <Badge tone="success" label={COPY.verified} /> : undefined}
          testID={`passenger-profile-${row.key}`}
        />
      ))}
    </ListGroup>
  );
}
