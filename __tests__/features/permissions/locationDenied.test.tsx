/**
 * UI-R8 (shared-permissions, driver denied state): with location refused, the Drive sheet shows
 * "Location needed to go online" (Open Settings / Try again) instead of Go online while offline;
 * online or with a ride open the normal control stays. locationOsDenied reads iOS RHPermissions.
 */
import React from 'react';
import { NativeModules } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { DriveSheetBody, drivePeekHeight, driveSheetSnaps, type DriveStatus } from '../../../src/components/driver/drive/DriveSheet';
import { DRIVE_PEEK_HEIGHT } from '../../../src/screens/Driver/DriverDriveScreen';
import { locationOsDenied, locationOsUndetermined } from '../../../src/features/permissions/locationStatus';

const renderBody = async (
  status: DriveStatus,
  blocked: { onOpenSettings: () => void; onRetry: () => void } | null,
  hasRide = false,
  onLocationCardLayout?: (height: number) => void,
  onPeekGroupHeight?: (height: number) => void,
) => {
  render(
    <ThemeProvider>
      <DriveSheetBody
        status={status}
        busy={false}
        disabled={false}
        onToggle={jest.fn()}
        hasRide={hasRide}
        onResume={jest.fn()}
        isApproved
        vehicleType="car"
        locationBlocked={blocked}
        onLocationCardLayout={onLocationCardLayout}
        onPeekGroupHeight={onPeekGroupHeight}
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

describe('Drive sheet height with the location card (T-580)', () => {
  it('reports the card height, so the screen can size the peek to it', async () => {
    const onLayout = jest.fn();
    await renderBody('offline', { onOpenSettings: jest.fn(), onRetry: jest.fn() }, false, onLayout);
    fireEvent(screen.getByTestId('drive-location-card-wrap'), 'layout', { nativeEvent: { layout: { height: 312 } } });
    expect(onLayout).toHaveBeenCalledWith(312);
  });

  it('the peek group holds the card, so the measured peek grows by it (Open Settings + Try again visible), with full above it', async () => {
    const onGroup = jest.fn();
    await renderBody('offline', { onOpenSettings: jest.fn(), onRetry: jest.fn() }, false, undefined, onGroup);
    fireEvent(screen.getByTestId('drive-peek-group'), 'layout', { nativeEvent: { layout: { height: 12 + 56 + 12 + 312 } } });
    expect(onGroup).toHaveBeenCalledWith(392);
    const peek = drivePeekHeight(47, 392);
    expect(peek).toBe(DRIVE_PEEK_HEIGHT - 56 + 312);
    expect(driveSheetSnaps(peek, true)).toEqual({ peekHeight: peek, snapPoints: ['peek', 'full'] });
  });

  it('without the card: the D1 peek 223 (24 + status block 47 + group 136 + 16) → half', () => {
    expect(DRIVE_PEEK_HEIGHT).toBe(223);
    expect(drivePeekHeight(47, 136)).toBe(223);
    expect(driveSheetSnaps(223, false)).toEqual({ peekHeight: 223, snapPoints: ['peek', 'half'] });
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
