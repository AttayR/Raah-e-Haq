/**
 * T-575 (Roman Urdu phase 2): what phase 1 left in English follows the language — registration
 * validation messages (read when a rule fails), registration option lists, ride-history
 * cancellation lines and vehicle names, chat / wallet / earnings day words, the error boundaries,
 * the planner title and step chips, and the lines QA 2026-10-19 found in English. A "Current
 * location" label set before a switch is still recognised after it.
 */
import React from 'react';
import { Alert, Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { setLocale, t, type TranslationKey } from '../../src/i18n';
import { resetLanguagePreferenceForTests } from '../../src/i18n/languagePreference';
import '../../src/i18n/copy-ur-Latn';
import { validateStep, validateStepField } from '../../src/schemas/registrationSchema';
import { INITIAL_REGISTRATION_FORM } from '../../src/features/auth/registration/registrationForm';
import { vehiclePhotoSlotLabel, vehicleTypeLabel, VEHICLE_PHOTO_SLOTS } from '../../src/features/auth/registration/registrationForm';
import {
  drivingExperienceOptions,
  emergencyRelationOptions,
  licenseTypeOptions,
  vehicleColourOptions,
} from '../../src/features/auth/copy/registrationFields';
import { cancellationText, RIDE_STATUS_LABEL, vehicleLabel } from '../../src/features/ride-history/copy';
import { formatChatDayTime } from '../../src/features/chat/copy';
import { formatDayLabel, formatTime as formatWalletTime } from '../../src/features/wallet/format';
import { periodCaption } from '../../src/features/stats/format';
import { chartSlots } from '../../src/features/stats/chartModel';
import { formatGender } from '../../src/components/passenger/settings/format';
import { transactionTypeLabel, WALLET_COPY } from '../../src/features/wallet/copy';
import { STATS_COPY } from '../../src/features/stats/copy';
import { NOTIFICATIONS_COPY } from '../../src/features/notifications/copy';
import { RIDE_HISTORY_COPY } from '../../src/features/ride-history/copy';
import { BOOKING_COPY, isCurrentLocationLabel, locationFieldLabels } from '../../src/features/ride-booking/copy';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import { MapErrorBoundary } from '../../src/components/MapErrorBoundary';

afterEach(() => resetLanguagePreferenceForTests());

describe('registration validation messages follow the language (read when a rule fails)', () => {
  it('the same schema answers in English, then in Roman Urdu', () => {
    const empty = { ...INITIAL_REGISTRATION_FORM, role: 'driver' as const };
    expect(validateStep('personal', empty).fullName).toBe('Full name is required');
    expect(validateStep('vehicle', empty).vehicleNumber).toBe('Vehicle number is required');
    setLocale('ur-Latn');
    expect(validateStep('personal', empty).fullName).toBe('Poora naam zaroori hai');
    expect(validateStep('vehicle', empty).vehicleNumber).toBe('Gaari ka number zaroori hai');
    expect(validateStepField('personal', 'password', { ...empty, password: 'short' })).toBe(
      'Password kam az kam 8 huroof ka ho',
    );
    setLocale('en');
    expect(validateStep('personal', empty).fullName).toBe('Full name is required');
  });

  it('keeps numbers in the messages that take them', () => {
    setLocale('ur-Latn');
    jest.useFakeTimers({ now: new Date(2026, 9, 11, 12) });
    const driver = { ...INITIAL_REGISTRATION_FORM, role: 'driver' as const, dateOfBirth: '2010-01-01' };
    expect(validateStepField('personal', 'dateOfBirth', driver)).toBe('Driver ki umar kam az kam 18 saal ho.');
    expect(validateStepField('vehicle', 'vehicleYear', { ...driver, vehicleYear: '1970' })).toBe(
      'Gaari ka saal 1980 aur 2027 ke darmiyan ho',
    );
    jest.useRealTimers();
  });
});

describe('registration option lists', () => {
  it('label options in the active language and keep the values the API takes', () => {
    expect(vehicleColourOptions()[0]).toEqual({ value: 'White', label: 'White' });
    expect(emergencyRelationOptions()[0]).toEqual({ value: 'father', label: 'Father' });
    setLocale('ur-Latn');
    expect(vehicleColourOptions()[0]).toEqual({ value: 'White', label: 'Safaid' });
    expect(emergencyRelationOptions()[0]).toEqual({ value: 'father', label: 'Walid' });
    expect(licenseTypeOptions().map((option) => option.value)).toEqual(['LTV', 'HTV', 'Motorcycle', 'PSV', 'other']);
    expect(licenseTypeOptions()[4].label).toBe('Deegar');
    expect(drivingExperienceOptions()[0]).toEqual({ value: '1', label: '1 saal' });
    expect(vehicleTypeLabel('car')).toBe('Gaari');
    expect(vehicleTypeLabel('jet')).toBe('jet');
    expect(vehiclePhotoSlotLabel(VEHICLE_PHOTO_SLOTS[0])).toBe('Saamne se');
    expect(formatGender('female')).toBe('Aurat');
    expect(formatGender('constructor')).toBe('Constructor');
  });
});

describe('ride history', () => {
  it('says who cancelled and names the vehicle in the active language', () => {
    expect(cancellationText('driver', 'passenger')).toBe('The driver cancelled this ride.');
    setLocale('ur-Latn');
    expect(cancellationText('driver', 'passenger')).toBe('Driver ne ye ride cancel ki.');
    expect(cancellationText('passenger', 'passenger')).toBe('Aap ne ye ride cancel ki.');
    expect(cancellationText(null, 'driver')).toBe('Ye ride cancel ho gayi.');
    expect(vehicleLabel('car')).toBe('Gaari');
    expect(vehicleLabel('CAR_AC')).toBe('AC gaari');
    expect(vehicleLabel('tuk_tuk')).toBe('Tuk tuk');
    expect(vehicleLabel('toString')).toBe('ToString');
    expect(RIDE_STATUS_LABEL.cancelled).toBe('Cancel hui');
  });
});

describe('day words and month names', () => {
  const now = new Date(2026, 9, 18, 12);

  it('chat times', () => {
    const tomorrow = new Date(2026, 9, 19, 9, 5).toISOString();
    const older = new Date(2026, 9, 12, 9, 5).toISOString();
    expect(formatChatDayTime(tomorrow, now)).toBe('tomorrow at 9:05 AM');
    expect(formatChatDayTime(older, now)).toBe('12 Oct at 9:05 AM');
    setLocale('ur-Latn');
    expect(formatChatDayTime(tomorrow, now)).toBe('kal 9:05 AM');
    expect(formatChatDayTime(new Date(2026, 9, 17, 9, 5).toISOString(), now)).toBe('guzishta kal 9:05 AM');
    expect(formatChatDayTime(older, now)).toBe('12 Oct, 9:05 AM');
  });

  it('wallet day headers and earnings captions', () => {
    setLocale('ur-Latn');
    expect(formatDayLabel(now.toISOString(), now)).toBe('Aaj');
    expect(formatDayLabel(new Date(2026, 9, 17, 9).toISOString(), now)).toBe('Kal');
    expect(formatDayLabel(new Date(2026, 9, 12, 9).toISOString(), now)).toBe('Peer, 12 Oct');
    expect(formatWalletTime(new Date(2026, 9, 12, 18, 5).toISOString())).toBe('6:05 PM');
    expect(periodCaption('day', '2026-10-18T00:00:00+05:00', null)).toBe('Itwar, 18 Oct');
    expect(periodCaption('month', '2026-10-01T00:00:00+05:00', null)).toBe('Aktoobar 2026');
    expect(chartSlots([{ date: '2026-10-12', trips: 0, grossFares: 0, earnings: 0 }], 'week', null)[0].label).toBe('Peer');
  });
});

describe('QA 2026-10-19: lines that were still English read Roman Urdu', () => {
  const EN_KEYS: TranslationKey[] = [
    'inbox.notifications',
    'inbox.messages',
    'activity.summaryRides',
    'activity.summaryRating',
    'earnings.statementsTile',
    'walletTypes.ride_payment',
    'walletTypes.cancellation_fee',
    'statements.balanceTitle',
    'ride.fareBase',
    'driverFare.commission',
  ];

  it.each(EN_KEYS)('%s', (key) => {
    const english = t(key, { rate: 20 });
    setLocale('ur-Latn');
    expect(t(key, { rate: 20 })).not.toBe(english);
  });

  it('feature copy on Wallet, Kamai, Inbox, ride details and driver Account', () => {
    const read = () => [
      WALLET_COPY.balanceLabel,
      WALLET_COPY.transactions,
      // UI-R17: the Earnings hero's fares and distance labels.
      t('earnings.heroFares'),
      t('earnings.statDistance'),
      STATS_COPY.periodDay,
      NOTIFICATIONS_COPY.filterUnread,
      RIDE_HISTORY_COPY.fareBase,
      RIDE_HISTORY_COPY.filterCancelled,
      t('account.groupPreferences'),
      transactionTypeLabel('ride_payment'),
    ];
    const english = read();
    setLocale('ur-Latn');
    read().forEach((roman, index) => expect(roman).not.toBe(english[index]));
  });
});

describe('booking planner', () => {
  it('the planner and choose-ride titles follow the language (UI-R10: no step chips)', () => {
    setLocale('ur-Latn');
    expect(BOOKING_COPY.planTitle).toBe('Safar plan karein');
    expect(BOOKING_COPY.chooseRideTitle).toBe('Sawari chunein');
    expect(BOOKING_COPY.addStopOnMap).toBe('Stop map par chunein');
  });

  it('recognises "Current location" from before a language switch', () => {
    const englishLabel = BOOKING_COPY.currentLocation;
    setLocale('ur-Latn');
    expect(BOOKING_COPY.currentLocation).toBe('Maujooda location');
    expect(isCurrentLocationLabel(englishLabel)).toBe(true);
    expect(isCurrentLocationLabel('Maujooda location')).toBe(true);
    expect(isCurrentLocationLabel('Liberty Market')).toBe(false);
    expect(locationFieldLabels()).toEqual(
      expect.arrayContaining(['Current location', 'Maujooda location', 'Pinned on map', BOOKING_COPY.pinnedOnMap]),
    );
  });
});

describe('error boundaries', () => {
  function Boom(): React.ReactElement {
    throw new Error('Network down');
  }

  it.each([
    ['ErrorBoundary', ErrorBoundary, 'Oho! Kuch ghalat ho gaya', 'App mein masla'],
    ['MapErrorBoundary', MapErrorBoundary, 'Map mein masla', 'Map mein masla'],
  ] as const)('%s shows its fallback and alert in Roman Urdu', (_name, Boundary, title, alertTitle) => {
    setLocale('ur-Latn');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <Boundary>
        <Boom />
        <Text>never</Text>
      </Boundary>,
    );
    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByText('Dobara koshish karein')).toBeTruthy();
    expect(alert.mock.calls[0][0]).toBe(alertTitle);
    alert.mockRestore();
    quiet.mockRestore();
  });
});
