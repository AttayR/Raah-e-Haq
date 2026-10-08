/**
 * T-102 (QA note 2026-10-08): every Sign Out button asks for confirmation first, and only
 * the confirm button runs the logout thunk.
 */
import React from 'react';
import { Alert, AlertButton } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { rootReducer } from '../../src/store/rootReducer';
import { useLogout, LOGOUT_CONFIRM_BUTTON } from '../../src/hooks/useLogout';
import * as sessionThunks from '../../src/store/thunks/sessionThunks';

const makeWrapper = () => {
  const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefault) =>
      getDefault({
        serializableCheck: false,
        thunk: { extraArgument: { purgePersistedState: () => Promise.resolve() } },
      }),
  });
  const Wrapper = ({ children }: React.PropsWithChildren) => (
    <Provider store={store}>{children}</Provider>
  );
  return { store, Wrapper };
};

const buttonsOf = (spy: jest.SpyInstance): AlertButton[] => spy.mock.calls[0][2] ?? [];

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useLogout', () => {
  it('asks before signing out and does nothing on Cancel', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const logoutSpy = jest.spyOn(sessionThunks, 'logout');
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useLogout(), { wrapper: Wrapper });

    act(() => result.current.confirmLogout());

    expect(alert).toHaveBeenCalledTimes(1);
    const cancel = buttonsOf(alert).find((b) => b.style === 'cancel');
    expect(cancel).toBeDefined();
    act(() => cancel?.onPress?.());
    expect(logoutSpy).not.toHaveBeenCalled();
  });

  it('runs the single logout thunk when confirmed', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const logoutSpy = jest.spyOn(sessionThunks, 'logout');
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useLogout(), { wrapper: Wrapper });

    act(() => result.current.confirmLogout());
    const confirm = buttonsOf(alert).find((b) => b.text === LOGOUT_CONFIRM_BUTTON);
    expect(confirm?.style).toBe('destructive');

    await act(async () => {
      confirm?.onPress?.();
    });

    expect(logoutSpy).toHaveBeenCalledTimes(1);
    expect(result.current.isLoggingOut).toBe(false);
  });
});
