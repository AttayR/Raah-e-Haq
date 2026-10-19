/**
 * UI-R8 (shared-permissions): the permission pre-prompt. The controller shows one page at a time
 * and only while the OS is unasked; the stored answer keeps "Not now" from asking again; without
 * a host the caller goes on as before. The page has Continue (+ Not now where allowed) and the
 * host answers through a full-screen Modal. Also the duotone Illustration it uses.
 */
import React from 'react';
import { Modal, StyleSheet, useColorScheme } from 'react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { Illustration } from '../../../src/components/ui';
import { DialogHost } from '../../../src/components/ui/Dialog';
import { MODAL_DISMISS_FALLBACK_MS, modalQueue } from '../../../src/components/ui/modalQueue';
import { confirm, dialog } from '../../../src/core/dialog';
import { LightTheme } from '../../../src/theme';
import { rootReducer } from '../../../src/store/rootReducer';
import type { User } from '../../../src/services/api';
import {
  permissionPrimer,
  primeBeforeOsPrompt,
  PRIMER_STORAGE_PREFIX,
} from '../../../src/features/permissions/primer';
import { PermissionPrimerScreen } from '../../../src/features/permissions/PermissionPrimerScreen';
import { PermissionPrimerHost } from '../../../src/features/permissions/PermissionPrimerHost';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));
(useColorScheme as jest.MockedFunction<typeof useColorScheme>).mockReturnValue('light');

const undetermined = () => Promise.resolve(true);
const determined = () => Promise.resolve(false);

const storeFor = (role: User['role']) => {
  const base = rootReducer(undefined, { type: '@@test/init' });
  const user: User = { id: 1, name: 'Ali', email: 'a@example.test', phone: '+920000000001', status: 'active', role, roles: role ? [role] : [] };
  return configureStore({
    reducer: rootReducer,
    preloadedState: { ...base, apiAuth: { ...base.apiAuth, user, isAuthenticated: true, isInitialized: true } },
    middleware: getDefault => getDefault({ serializableCheck: false }),
  });
};

const renderHost = async (role: User['role'] = 'passenger', withDialogs = false) => {
  render(
    <Provider store={storeFor(role)}>
      <ThemeProvider>
        <PermissionPrimerHost />
        {withDialogs ? <DialogHost /> : null}
      </ThemeProvider>
    </Provider>,
  );
  await act(async () => {});
};

beforeEach(async () => {
  permissionPrimer.reset();
  modalQueue.reset();
  await AsyncStorage.clear();
});

describe('primeBeforeOsPrompt', () => {
  it('goes straight on when the OS has already answered or no host is mounted', async () => {
    expect(await primeBeforeOsPrompt('notifications', determined)).toBe('proceed');
    expect(await primeBeforeOsPrompt('notifications', undetermined)).toBe('proceed');
    expect(permissionPrimer.current()).toBeNull();
  });

  it('shows the page once; Continue is stored and answers every waiter for that kind', async () => {
    const release = permissionPrimer.registerHost();
    const first = primeBeforeOsPrompt('locationPassenger', undetermined);
    const second = primeBeforeOsPrompt('locationPassenger', undetermined);
    await act(async () => {});
    expect(permissionPrimer.current()).toBe('locationPassenger');
    permissionPrimer.answer('continue');
    expect(await first).toBe('continued');
    expect(await second).toBe('continued');
    expect(await AsyncStorage.getItem(`${PRIMER_STORAGE_PREFIX}locationPassenger`)).toBe('continue');
    // Asked before: no page again, the OS prompt goes ahead.
    expect(await primeBeforeOsPrompt('locationPassenger', undetermined)).toBe('proceed');
    release();
  });

  it('"Not now" is stored, so the next automatic lookup skips the OS prompt too', async () => {
    const release = permissionPrimer.registerHost();
    const pending = primeBeforeOsPrompt('notifications', undetermined);
    await act(async () => {});
    permissionPrimer.answer('later');
    expect(await pending).toBe('skip');
    expect(await primeBeforeOsPrompt('notifications', undetermined)).toBe('skip');
    release();
  });

  it('driver location cannot be skipped: "later" counts as Continue', async () => {
    const release = permissionPrimer.registerHost();
    const pending = primeBeforeOsPrompt('locationDriver', undetermined);
    await act(async () => {});
    permissionPrimer.answer('later');
    expect(await pending).toBe('continued');
    release();
  });

  it('a page still up when the host unmounts (sign-out) resolves as "Not now"', async () => {
    const release = permissionPrimer.registerHost();
    const pending = primeBeforeOsPrompt('notifications', undetermined);
    await act(async () => {});
    release();
    expect(await pending).toBe('skip');
    expect(permissionPrimer.current()).toBeNull();
    // Not an answer: asked again after the next sign-in.
    expect(await AsyncStorage.getItem(`${PRIMER_STORAGE_PREFIX}notifications`)).toBeNull();
  });

  it('one page at a time: a second kind waits for the first', async () => {
    const release = permissionPrimer.registerHost();
    const location = primeBeforeOsPrompt('locationPassenger', undetermined);
    const push = primeBeforeOsPrompt('notifications', undetermined);
    await act(async () => {});
    expect(permissionPrimer.current()).toBe('locationPassenger');
    permissionPrimer.answer('continue');
    await location;
    await act(async () => {});
    expect(permissionPrimer.current()).toBe('notifications');
    permissionPrimer.answer('later');
    expect(await push).toBe('skip');
    release();
  });
});

describe('PermissionPrimerScreen', () => {
  const renderScreen = async (kind: 'locationPassenger' | 'locationDriver' | 'notifications', role: 'passenger' | 'driver' = 'passenger') => {
    const onContinue = jest.fn();
    const onNotNow = jest.fn();
    render(
      <ThemeProvider>
        <PermissionPrimerScreen kind={kind} role={role} onContinue={onContinue} onNotNow={onNotNow} />
      </ThemeProvider>,
    );
    await act(async () => {});
    return { onContinue, onNotNow };
  };

  it('passenger location: title, reason, Continue and a ghost "Not now"', async () => {
    const { onContinue, onNotNow } = await renderScreen('locationPassenger');
    expect(screen.getByText('Find rides near you')).toBeTruthy();
    expect(screen.getByText(/Only while you use the app/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('permission-primer-continue'));
    fireEvent.press(screen.getByTestId('permission-primer-not-now'));
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onNotNow).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('permission-primer-header-not-now')).toBeNull();
  });

  it('driver location has no "Not now"', async () => {
    await renderScreen('locationDriver', 'driver');
    expect(screen.getByText('Share your location while online')).toBeTruthy();
    expect(screen.queryByTestId('permission-primer-not-now')).toBeNull();
  });

  it('notifications: role copy and one "Not now" (the bottom ghost button, no header action)', async () => {
    const { onNotNow } = await renderScreen('notifications', 'driver');
    expect(screen.getByText('Never miss a ride request')).toBeTruthy();
    expect(screen.getAllByText('Not now')).toHaveLength(1);
    fireEvent.press(screen.getByTestId('permission-primer-not-now'));
    expect(onNotNow).toHaveBeenCalledTimes(1);
  });
});

describe('PermissionPrimerHost', () => {
  it('presents the asked page in a full-screen Modal and answers with the tapped button', async () => {
    await renderHost('passenger');
    expect(screen.UNSAFE_queryByType(Modal)).toBeNull();
    const pending = primeBeforeOsPrompt('notifications', undetermined);
    await act(async () => {});
    const modal = screen.UNSAFE_getByType(Modal);
    expect(modal.props.presentationStyle).toBe('fullScreen');
    expect(screen.getByText('Know when your driver arrives')).toBeTruthy();
    fireEvent.press(screen.getByTestId('permission-primer-continue'));
    expect(await pending).toBe('continued');
    await act(async () => {});
    // Sliding away: hidden but still mounted until iOS reports the dismiss.
    expect(screen.UNSAFE_getByType(Modal).props.visible).toBe(false);
  });

  it('holds the modal turn until the dismiss finished: a Dialog asked right after an answer waits', async () => {
    await renderHost('passenger', true);
    const pending = primeBeforeOsPrompt('notifications', undetermined);
    await act(async () => {});
    fireEvent.press(screen.getByTestId('permission-primer-not-now'));
    expect(await pending).toBe('skip');
    act(() => {
      confirm({ title: 'Cancel ride?', confirmLabel: 'Cancel ride' });
    });
    await act(async () => {});
    // [primer Modal, Dialog Modal]
    const visible = () => screen.UNSAFE_getAllByType(Modal).map(m => m.props.visible);
    // Primer hidden but still going away; the Dialog has not presented.
    expect(visible()).toEqual([false, false]);
    expect(screen.queryByText('Cancel ride?')).toBeNull();
    act(() => screen.UNSAFE_getAllByType(Modal)[0].props.onDismiss());
    await act(async () => {});
    expect(visible()).toEqual([false, true]);
    expect(screen.getByText('Cancel ride?')).toBeTruthy();
    act(() => dialog.dismissAll());
  });

  it('without onDismiss the fallback timer releases the turn', async () => {
    await renderHost('passenger', true);
    const pending = primeBeforeOsPrompt('notifications', undetermined);
    await act(async () => {});
    jest.useFakeTimers();
    fireEvent.press(screen.getByTestId('permission-primer-continue'));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(await pending).toBe('continued');
    act(() => {
      confirm({ title: 'Cancel ride?', confirmLabel: 'Cancel ride' });
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(MODAL_DISMISS_FALLBACK_MS - 100);
    });
    expect(screen.queryByText('Cancel ride?')).toBeNull();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(200);
    });
    expect(screen.getByText('Cancel ride?')).toBeTruthy();
    act(() => dialog.dismissAll());
    jest.useRealTimers();
  });

  it('Android back is "Not now" where allowed and does nothing on the driver location page', async () => {
    await renderHost('driver');
    const pending = primeBeforeOsPrompt('locationDriver', undetermined);
    await act(async () => {});
    act(() => screen.UNSAFE_getByType(Modal).props.onRequestClose());
    expect(permissionPrimer.current()).toBe('locationDriver');
    fireEvent.press(screen.getByTestId('permission-primer-continue'));
    expect(await pending).toBe('continued');
  });
});

describe('Illustration', () => {
  it('draws the disc and an optional badge, hidden from screen readers', async () => {
    render(
      <ThemeProvider>
        <Illustration icon="applicationReview" badge={{ icon: 'clock' }} testID="art" />
      </ThemeProvider>,
    );
    await act(async () => {});
    const art = screen.getByTestId('art', { includeHiddenElements: true });
    expect(art.props.accessibilityElementsHidden).toBe(true);
    expect(StyleSheet.flatten(art.props.style)).toMatchObject({ width: 160, height: 160 });
    const badge = screen.getByTestId('art-badge', { includeHiddenElements: true });
    expect(StyleSheet.flatten(badge.props.style)).toMatchObject({ backgroundColor: LightTheme.colors.accent });
  });

  it('compact size and the danger badge', async () => {
    render(
      <ThemeProvider>
        <Illustration icon="document" badge={{ icon: 'failed', tone: 'danger' }} size="compact" testID="art" />
      </ThemeProvider>,
    );
    await act(async () => {});
    expect(StyleSheet.flatten(screen.getByTestId('art', { includeHiddenElements: true }).props.style)).toMatchObject({ width: 120 });
    expect(StyleSheet.flatten(screen.getByTestId('art-badge', { includeHiddenElements: true }).props.style)).toMatchObject({
      backgroundColor: LightTheme.colors.dangerFill,
    });
  });
});
