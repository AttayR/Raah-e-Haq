/**
 * UI-R16 units: the rating on the User (BE-07), the app version line (src/config/env.ts),
 * documents "Action needed", the stats distance value, the Delete account hook-up point and the
 * two small kit additions (SegmentedControl option `disabled`, ListItem `subtitleColor`).
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { normalizeUser, toRating } from '../../../src/core/auth/normalizeUser';
import { APP_VERSION, readAppBuild } from '../../../src/config/env';
import { documentsNeedAction, licenceExpired, versionLine } from '../../../src/features/account/rules';
import { distanceValue } from '../../../src/features/account/components/ProfileStats';
import { AccountActions } from '../../../src/features/account/components/AccountActions';
import { summaryContact } from '../../../src/components/account/ProfileSummaryCard';
import { ListItem, SegmentedControl } from '../../../src/components/ui';
import { LightTheme } from '../../../src/theme';
import packageJson from '../../../package.json';

const wrap = async (node: React.ReactElement) => {
  render(<ThemeProvider>{node}</ThemeProvider>);
  await act(async () => {});
};

describe('User.rating (BE-07)', () => {
  it('keeps a 1–5 number or decimal string, else null; absent stays absent', async () => {
    expect(toRating(4.86)).toBe(4.86);
    expect(toRating('4.80')).toBe(4.8);
    expect(toRating(0)).toBeNull();
    expect(toRating(7)).toBeNull();
    expect(toRating('')).toBeNull();
    expect(toRating(null)).toBeNull();
    expect(normalizeUser({ id: 1, role: 'driver', status: 'active', rating: '4.5' })?.rating).toBe(4.5);
    expect(normalizeUser({ id: 1, role: 'driver', status: 'active', rating: null })?.rating).toBeNull();
    expect(normalizeUser({ id: 1, role: 'driver', status: 'active' })).not.toHaveProperty('rating');
    // users.total_rides is stale (BE-130 f): never kept on the user.
    expect(normalizeUser({ id: 1, role: 'driver', status: 'active', total_rides: 9 })).not.toHaveProperty('total_rides');
  });
});

describe('version line (src/config/env.ts)', () => {
  it('APP_VERSION is package.json version; the build comes from APP_BUILD or Android VERSION_CODE', async () => {
    expect(APP_VERSION).toBe(packageJson.version);
    expect(readAppBuild({ APP_BUILD: ' 42 ' })).toBe('42');
    expect(readAppBuild({ VERSION_CODE: 7 })).toBe('7');
    expect(readAppBuild({ APP_BUILD: '' })).toBeNull();
    expect(readAppBuild({ APP_BUILD: 'bad value!' })).toBeNull();
    expect(readAppBuild(null)).toBeNull();
  });

  it('formats with and without a build, and marks Debug builds', async () => {
    expect(versionLine('1.2.0', '42', false)).toBe('Raah-e-Haq 1.2.0 (42)');
    expect(versionLine('1.2.0', null, false)).toBe('Raah-e-Haq 1.2.0');
    expect(versionLine('1.2.0', '42', true)).toBe('Raah-e-Haq 1.2.0 (42) · Debug');
  });
});

describe('documents need action', () => {
  const now = new Date(2026, 9, 20);
  it('a rejected vehicle or a licence past its expiry; unknown vehicles count as none', async () => {
    expect(licenceExpired('2026-10-19', now)).toBe(true);
    expect(licenceExpired('2026-10-20', now)).toBe(false);
    expect(licenceExpired(null, now)).toBe(false);
    expect(licenceExpired('garbage', now)).toBe(false);
    expect(documentsNeedAction([{ status: 'approved' }], '2028-01-01', now)).toBe(false);
    expect(documentsNeedAction([{ status: 'rejected' }], '2028-01-01', now)).toBe(true);
    expect(documentsNeedAction(null, '2020-01-01', now)).toBe(true);
    expect(documentsNeedAction(null, null, now)).toBe(false);
  });
});

describe('profile values', () => {
  it('distance without its unit; 0 for none', async () => {
    expect(distanceValue(412.3)).toBe('412');
    expect(distanceValue(3.44)).toBe('3.4');
    expect(distanceValue(1204.6)).toBe('1,205');
    expect(distanceValue(0)).toBe('0');
  });

  it('card contact: formatted verified phone, else email, else nothing', async () => {
    const base = { id: 1, name: 'A', email: 'a@b.test', phone: '+923009990001', status: 'active' as const, role: 'passenger' as const, roles: [] };
    expect(summaryContact(base)).toBe('+92 300 9990001');
    expect(summaryContact({ ...base, phone: null })).toBe('a@b.test');
    expect(summaryContact({ ...base, phone: null, email: ' ' })).toBeNull();
    expect(summaryContact(null)).toBeNull();
  });
});

describe('AccountActions (UI-R18)', () => {
  it('a destructive Delete account row that calls its handler', async () => {
    const onDelete = jest.fn();
    await wrap(<AccountActions testID="actions" onDeleteAccount={onDelete} />);
    expect(screen.getByText('Delete account').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ color: LightTheme.colors.danger })]));
    fireEvent.press(screen.getByTestId('actions-delete'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

describe('kit additions', () => {
  it('SegmentedControl: a disabled option is announced disabled and cannot be picked', async () => {
    const onChange = jest.fn();
    await wrap(
      <SegmentedControl
        options={[
          { value: 'a', label: 'A', disabled: true },
          { value: 'b', label: 'B' },
        ]}
        value="b"
        onChange={onChange}
        accessibilityLabel="Pick"
        testID="seg"
      />,
    );
    expect(screen.getByTestId('seg-a').props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByTestId('seg-b').props.accessibilityState).toMatchObject({ disabled: false, checked: true });
    fireEvent.press(screen.getByTestId('seg-a'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ListItem subtitleColor primaryText for a call to action', async () => {
    await wrap(<ListItem title="Home" subtitle="Add home" subtitleColor="primaryText" />);
    expect(screen.getByText('Add home').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: LightTheme.colors.primaryText })]),
    );
  });
});
