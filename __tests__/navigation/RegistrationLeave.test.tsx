/**
 * QA T-201 (retry 2): leaving the registration code step, in a real native stack.
 * - A: while the code is being entered the iOS swipe is off (gestureEnabled false) and a JS
 *   removal (Android back) asks first; after a confirmed leave the stack works normally
 *   ("Create New Account" opens Signup again).
 * - B: "Go to Sign In" asks the same, then really removes Signup (it does not stay mounted
 *   under Login).
 */
import React from 'react';
import { Button, Text } from 'react-native';
import { dialog, dialogStore } from '../../src/core/dialog';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import RegistrationPhoneStep from '../../src/features/auth/components/RegistrationPhoneStep';
import { ThemeProvider } from '../../src/app/providers/ThemeProvider';
import { rootReducer } from '../../src/store/rootReducer';
import type { SessionThunkExtra } from '../../src/store/thunks/sessionThunks';
import type { PendingPhoneVerification } from '../../src/store/thunks/apiThunks';
import type { AuthStackParamList } from '../../src/app/navigation/stacks/AuthStack';
import { toast } from '../../src/core/toast';

jest.mock('../../src/store', () => {
  const redux = jest.requireActual('react-redux');
  return { useAppDispatch: redux.useDispatch, useAppSelector: redux.useSelector };
});

const pending: PendingPhoneVerification = {
  phone: '+923009990001',
  codeSent: true,
  expiresIn: 60,
  verificationToken: 'test-verification-token-not-real',
};

const Stack = createNativeStackNavigator<AuthStackParamList>();
const navigationRef = createNavigationContainerRef<AuthStackParamList>();

function LoginStub({ navigation }: NativeStackScreenProps<AuthStackParamList, 'Login'>) {
  return (
    <>
      <Text>Login screen</Text>
      <Button title="Create New Account" onPress={() => navigation.navigate('Signup')} />
    </>
  );
}

/** Signup as RegistrationScreen wires it once registration answered 201. */
function SignupStub({ navigation }: NativeStackScreenProps<AuthStackParamList, 'Signup'>) {
  return <RegistrationPhoneStep pending={pending} role="passenger" onGoToSignIn={() => navigation.popTo('Login')} />;
}

const renderStack = async () => {
  const extra: SessionThunkExtra = { purgePersistedState: jest.fn(() => Promise.resolve()) };
  const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefault) => getDefault({ serializableCheck: false, thunk: { extraArgument: extra } }),
  });
  render(
    <Provider store={store}>
      <ThemeProvider>
        <NavigationContainer ref={navigationRef}>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login" component={LoginStub} />
            <Stack.Screen name="Signup" component={SignupStub} />
          </Stack.Navigator>
        </NavigationContainer>
      </ThemeProvider>
    </Provider>,
  );
  await act(async () => {});
  fireEvent.press(screen.getByText('Create New Account'));
  await act(async () => {});
};

const routeNames = () => navigationRef.getRootState().routes.map((route) => route.name);

/** Answers the open confirm Dialog (UI-R7: core/dialog instead of a native alert). */
const answerDialog = async (choice: 'Stay' | 'Leave') => {
  const current = dialogStore.getCurrent();
  expect(current).toMatchObject({ confirmLabel: 'Leave', cancelLabel: 'Stay' });
  await act(async () => {
    if (current) dialog.answer(current.id, choice === 'Leave');
  });
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  act(() => toast.hide());
  act(() => dialog.dismissAll());
  jest.useRealTimers();
});

describe('leaving the registration code step', () => {
  it('turns the iOS swipe off while the code is entered', async () => {
    await renderStack();

    expect(routeNames()).toEqual(['Login', 'Signup']);
    expect(navigationRef.getCurrentOptions()).toMatchObject({ gestureEnabled: false });
  });

  it('Android back asks; Stay keeps the step, Leave pops it and the stack still works', async () => {
    await renderStack();

    act(() => navigationRef.goBack());
    expect(dialogStore.getCurrent()).toMatchObject({
      title: 'Leave verification?',
      body: 'You can finish later from the emailed link.',
    });
    expect(routeNames()).toEqual(['Login', 'Signup']);

    await answerDialog('Stay');
    expect(routeNames()).toEqual(['Login', 'Signup']);
    expect(screen.getByPlaceholderText('6-digit code')).toBeTruthy();

    act(() => navigationRef.goBack());
    await answerDialog('Leave');
    await act(async () => {});
    expect(routeNames()).toEqual(['Login']);

    // QA: "Create New Account" was dead until relaunch after leaving.
    fireEvent.press(screen.getByText('Create New Account'));
    await act(async () => {});
    expect(routeNames()).toEqual(['Login', 'Signup']);
    expect(screen.getByPlaceholderText('6-digit code')).toBeTruthy();
  });

  it('"Go to Sign In" asks the same, then removes Signup instead of stacking Login on it', async () => {
    await renderStack();

    fireEvent.press(screen.getByText('Go to Sign In'));
    expect(dialogStore.getCurrent()).toMatchObject({ title: 'Leave verification?' });
    expect(routeNames()).toEqual(['Login', 'Signup']);

    await answerDialog('Leave');
    await act(async () => {});

    expect(routeNames()).toEqual(['Login']);
    expect(screen.queryByPlaceholderText('6-digit code')).toBeNull();
  });
});
