/**
 * UI-R8 (shared-permissions, driver denied state): with location refused, the Drive sheet shows
 * "Location needed to go online" (Open Settings / Try again) instead of Go online while offline;
 * online or with a ride open the normal control stays. locationOsDenied reads iOS RHPermissions.
 */
import React from 'react';
import { NativeModules } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { DriveSheetBody, type DriveStatus } from '../../../src/components/driver/drive/DriveSheet';
import type { DriverTodayStatsValues } from '../../../src/components/driver/home/DriverTodayStats';
import { locationOsDenied, locationOsUndetermined } from '../../../src/features/permissions/locationStatus';

const today: DriverTodayStatsValues = { earnings: null, trips: null, rating: null };

const renderBody = async (status: DriveStatus, blocked: { onOpenSettings: () => void; onRetry: () => void } | null, hasRide = false) => {
  render(
    <ThemeProvider>
      <DriveSheetBody
        status={status}
        busy={false}
        disabled={false}
        onToggle={jest.fn()}
        hasRide={hasRide}
        onResume={jest.fn()}
        todayEarnings={null}
        today={today}
        statsError={null}
        isApproved
        vehicleType="car"
        locationBlocked={blocked}
      />
    </ThemeProvider>,
  );
  await act(async () => {});
};

describe('Drive sheet location denied (UI-R8)', () => {
  it('offline + refused: the card replaces Go online; its buttons work', async () => {
    const blocked = { onOpenSettings: jest.fn(), onRetry: jest.fn() };
    await renderBody('offline', blocked);
    expect(screen.getByText('Location needed to go online')).toBeTruthy();
    expect(screen.queryByTestId('drive-online-toggle')).toBeNull();
    fireEvent.press(screen.getByTestId('drive-location-open-settings'));
    fireEvent.press(screen.getByTestId('drive-location-retry'));
    expect(blocked.onOpenSettings).toHaveBeenCalledTimes(1);
    expect(blocked.onRetry).toHaveBeenCalledTimes(1);
  });

  it('online, or not refused: the normal control', async () => {
    await renderBody('online', { onOpenSettings: jest.fn(), onRetry: jest.fn() });
    expect(screen.getByTestId('drive-online-toggle')).toBeTruthy();
    screen.unmount();
    await renderBody('offline', null);
    expect(screen.getByTestId('drive-online-toggle')).toBeTruthy();
  });
});

describe('location OS status (iOS)', () => {
  const native = NativeModules as { RHPermissions?: { locationStatus: () => Promise<string> } };
  afterEach(() => {
    delete native.RHPermissions;
  });

  it.each([
    ['notDetermined', true, false],
    ['denied', false, true],
    ['restricted', false, true],
    ['granted', false, false],
  ])('%s → undetermined %s, denied %s', async (status, undetermined, denied) => {
    native.RHPermissions = { locationStatus: () => Promise.resolve(status) };
    expect(await locationOsUndetermined()).toBe(undetermined);
    expect(await locationOsDenied()).toBe(denied);
  });

  it('without the native module (older build): neither, so screens keep their old behaviour', async () => {
    expect(await locationOsUndetermined()).toBe(false);
    expect(await locationOsDenied()).toBe(false);
  });
});
