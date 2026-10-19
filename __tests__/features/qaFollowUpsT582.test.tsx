/**
 * T-582 part 1 (QA 2026-10-19, docs/qa-reports/2026-10-19-uir9-t581-qa):
 * 3. Messages pull to refresh works on a short list (the list bounces on iOS);
 * 4. an immediate Send never drops keystrokes the field reports after the tap;
 * 6. expected situations log at debug: a location timeout or refusal, and a cold start that
 *    finds the account refused (they raised the dev LogBox).
 * (1 is in __tests__/components/ui/sheetRevealT582.test.tsx, 2 in
 * __tests__/components/passenger/locationSearchMapRowT582.test.tsx, 5 in
 * __tests__/screens/homeRetrySavedPlacesT582.test.tsx.)
 */
import React from 'react';
import { RefreshControl } from 'react-native';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import Geolocation from '@react-native-community/geolocation';
import { ChatComposer } from '../../src/features/chat/components/ChatComposer';
import { ChatList } from '../../src/features/chat/components/ChatList';
import { chatApi } from '../../src/features/chat/api';
import { logger } from '../../src/core/logging/logger';
import { isExpectedPositionError, useNativeLocation } from '../../src/hooks/useNativeLocation';
import { accountRefused, type SessionThunkExtra } from '../../src/store/thunks/sessionThunks';
import type { User } from '../../src/services/api';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn() }),
}));

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 8; i += 1) await Promise.resolve();
  });
};

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('3. Messages pull to refresh on a short list', () => {
  it('the list bounces even when shorter than the screen, and a pull reads GET /chats again', async () => {
    const list = jest.spyOn(chatApi, 'listChats').mockResolvedValue([]);
    render(<ChatList visible role="passenger" />);
    await flush();
    const scroller = screen.getByTestId('chat-list');
    expect(scroller.props.alwaysBounceVertical).toBe(true);
    expect(list).toHaveBeenCalledTimes(1);
    const control = screen.UNSAFE_getByType(RefreshControl);
    await act(async () => {
      control.props.onRefresh();
    });
    await flush();
    expect(list).toHaveBeenCalledTimes(2);
  });
});

describe('4. an immediate Send keeps the last typed characters', () => {
  it('keystrokes reported after the tap (touches jump the queue) are sent, and the field clears', () => {
    jest.useFakeTimers();
    const onSend = jest.fn(() => true);
    render(<ChatComposer onSend={onSend} bottomInset={0} />);
    const input = screen.getByTestId('chat-input');
    fireEvent.changeText(input, 'QA test');
    // The tap arrives before the field's reports for " one".
    fireEvent.press(screen.getByTestId('chat-send'));
    fireEvent.changeText(input, 'QA test o');
    fireEvent.changeText(input, 'QA test one');
    expect(onSend).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(16);
    });
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith('QA test one');
    expect(screen.getByTestId('chat-input').props.value).toBe('');
  });

  it('several taps in the same frame send once', () => {
    jest.useFakeTimers();
    const onSend = jest.fn(() => true);
    render(<ChatComposer onSend={onSend} bottomInset={0} />);
    fireEvent.changeText(screen.getByTestId('chat-input'), 'On my way');
    fireEvent.press(screen.getByTestId('chat-send'));
    fireEvent.press(screen.getByTestId('chat-send'));
    act(() => {
      jest.advanceTimersByTime(16);
    });
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('unmounting before the frame sends nothing', () => {
    jest.useFakeTimers();
    const onSend = jest.fn(() => true);
    const view = render(<ChatComposer onSend={onSend} bottomInset={0} />);
    fireEvent.changeText(screen.getByTestId('chat-input'), 'Bye');
    fireEvent.press(screen.getByTestId('chat-send'));
    view.unmount();
    act(() => {
      jest.advanceTimersByTime(16);
    });
    expect(onSend).not.toHaveBeenCalled();
  });
});

describe('6. expected situations log at debug', () => {
  const geo = Geolocation as jest.Mocked<typeof Geolocation>;
  type Failure = NonNullable<Parameters<typeof Geolocation.getCurrentPosition>[1]>;
  type Success = Parameters<typeof Geolocation.getCurrentPosition>[0];
  const failure = (code: number) => ({ code, message: 'fake', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }) as Parameters<Failure>[0];
  const fix = { coords: { latitude: 31.52, longitude: 74.35 }, timestamp: 0 } as unknown as Parameters<Success>[0];
  /** The services check (first call) answers; the lookup itself fails with `code`. */
  const lookupFails = (code: number) => {
    let calls = 0;
    geo.getCurrentPosition.mockReset();
    geo.getCurrentPosition.mockImplementation((ok, fail) => {
      calls += 1;
      if (calls === 1) ok(fix);
      else fail?.(failure(code));
    });
  };

  it('refused access and a timeout are expected; an unavailable position is not', () => {
    expect(isExpectedPositionError(1)).toBe(true);
    expect(isExpectedPositionError(3)).toBe(true);
    expect(isExpectedPositionError(2)).toBe(false);
  });

  it.each([
    [3, 'a timeout (the lookup ran out under the iOS prompt)'],
    [1, 'refused access'],
  ])('location error code %p, %s: debug, no warning', async (code) => {
    lookupFails(code);
    const warn = jest.spyOn(logger, 'warn');
    const debug = jest.spyOn(logger, 'debug');
    renderHook(() => useNativeLocation());
    await flush();
    expect(warn).not.toHaveBeenCalledWith('Location error:', expect.anything());
    expect(debug).toHaveBeenCalledWith('Location error:', expect.objectContaining({ code }));
  });

  it('an unavailable position still warns', async () => {
    lookupFails(2);
    const warn = jest.spyOn(logger, 'warn');
    renderHook(() => useNativeLocation());
    await flush();
    expect(warn).toHaveBeenCalledWith('Location error:', expect.objectContaining({ code: 2 }));
  });

  it('a cold start that finds the account suspended logs the routing at debug, not as a warning', () => {
    const user: User = { id: 3, name: 'Test Passenger', email: 'p@example.test', phone: '+920000000003', status: 'active', role: 'passenger', roles: ['passenger'] };
    const warn = jest.spyOn(logger, 'warn');
    const debug = jest.spyOn(logger, 'debug');
    const dispatch = jest.fn();
    const getState = () => ({ apiAuth: { isInitialized: true, isAuthenticated: true, user } });
    const extra: SessionThunkExtra = { purgePersistedState: jest.fn(() => Promise.resolve()) };
    const thunk = accountRefused({ status: 403, code: 'ACCOUNT_SUSPENDED', account: { status: 'suspended' } });
    const routed = thunk(dispatch, getState as never, extra);
    expect(routed).toBe(true);
    expect(warn).not.toHaveBeenCalledWith('Account refused by the server; routing to account status', expect.anything());
    expect(debug).toHaveBeenCalledWith('Account refused by the server; routing to account status', { status: 'suspended' });
  });
});
