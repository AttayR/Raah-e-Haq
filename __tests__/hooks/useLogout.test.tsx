/**
 * T-102 (QA note 2026-10-08): every Sign Out button asks for confirmation first, and only
 * the confirm button runs the logout thunk. UI-R3: the confirmation is the themed kit Dialog
 * (`confirm()`), destructive, and signing out dismisses any dialog still queued.
 */
import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { rootReducer } from '../../src/store/rootReducer';
import { useLogout, LOGOUT_CONFIRM_BUTTON, LOGOUT_CONFIRM_TITLE } from '../../src/hooks/useLogout';
import * as sessionThunks from '../../src/store/thunks/sessionThunks';
import { confirm, dialog, dialogStore } from '../../src/core/dialog';

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

const currentId = (): string => {
  const current = dialogStore.getCurrent();
  if (!current) throw new Error('no dialog open');
  return current.id;
};

afterEach(() => {
  act(() => dialog.dismissAll());
  jest.restoreAllMocks();
});

describe('useLogout', () => {
  it('asks with the kit dialog (sentence case, destructive) and does nothing on Cancel', async () => {
    const logoutSpy = jest.spyOn(sessionThunks, 'logout');
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useLogout(), { wrapper: Wrapper });

    let done: Promise<void> | undefined;
    act(() => {
      done = result.current.confirmLogout();
    });
    const request = dialogStore.getCurrent();
    expect(request).toMatchObject({ kind: 'confirm', title: 'Sign out?', confirmLabel: 'Sign out', destructive: true });
    expect(request?.body).toBeTruthy();
    await act(async () => {
      dialog.answer(currentId(), false);
      await done;
    });
    expect(logoutSpy).not.toHaveBeenCalled();
  });

  it('runs the single logout thunk when confirmed', async () => {
    const logoutSpy = jest.spyOn(sessionThunks, 'logout');
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useLogout(), { wrapper: Wrapper });

    let done: Promise<void> | undefined;
    act(() => {
      done = result.current.confirmLogout();
    });
    expect(dialogStore.getCurrent()?.title).toBe(LOGOUT_CONFIRM_TITLE);
    expect(dialogStore.getCurrent()?.confirmLabel).toBe(LOGOUT_CONFIRM_BUTTON);
    await act(async () => {
      dialog.answer(currentId(), true);
      await done;
    });

    expect(logoutSpy).toHaveBeenCalledTimes(1);
    expect(result.current.isLoggingOut).toBe(false);
  });

  it('dismisses any other queued dialog when signing out', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useLogout(), { wrapper: Wrapper });

    let done: Promise<void> | undefined;
    let other: boolean | undefined;
    act(() => {
      done = result.current.confirmLogout();
      confirm({ title: 'Leftover?', confirmLabel: 'Yes' }).then((v) => {
        other = v;
      });
    });
    await act(async () => {
      dialog.answer(currentId(), true);
      await done;
    });
    expect(dialogStore.getCurrent()).toBeNull();
    expect(other).toBe(false);
  });
});
