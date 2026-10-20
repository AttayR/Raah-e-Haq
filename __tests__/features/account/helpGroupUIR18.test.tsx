/**
 * UI-R18 hook-ups: the Account tab's "Help" group on both roles (Help & support, Invite friends,
 * Terms / Privacy only with an https link from GET /settings/public), registration Step 1's
 * optional invite code (sent as referral_code, its 422 mapped to the field), and the composer's
 * per-thread cap.
 */
import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { rootReducer } from '../../../src/store/rootReducer';
import { apiClient, type User } from '../../../src/services/api';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { clearQueryCache } from '../../../src/core/api/queryCache';
import { AccountScreen } from '../../../src/features/account/screens/AccountScreen';
import { buildRegistrationRequest } from '../../../src/features/auth/registration/buildRegistrationRequest';
import { mapRegistrationServerErrors } from '../../../src/features/auth/registration/serverFieldErrors';
import { INITIAL_REGISTRATION_FORM } from '../../../src/features/auth/registration/registrationForm';
import { ChatComposer } from '../../../src/features/chat/components/ChatComposer';
import InviteCodeField from '../../../src/screens/Auth/steps/InviteCodeField';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), canGoBack: () => true, addListener: () => () => undefined }),
  useIsFocused: () => true,
  useRoute: () => ({ key: 'Account-test', name: 'Account' }),
  useScrollToTop: jest.fn(),
}));

const user = (role: 'passenger' | 'driver'): User => ({
  id: 7,
  name: 'Test User',
  email: 'user@example.test',
  phone: null,
  status: 'active',
  role,
  roles: [role],
});

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 8; i += 1) await Promise.resolve();
  });
};

const renderWithStore = async (node: React.ReactElement, role: 'passenger' | 'driver' = 'passenger') => {
  const initial = rootReducer(undefined, { type: '@@init' });
  const store = configureStore({
    reducer: rootReducer,
    preloadedState: { ...initial, apiAuth: { ...initial.apiAuth, isAuthenticated: true, user: user(role) } },
  });
  render(
    <Provider store={store}>
      <ThemeProvider>{node}</ThemeProvider>
    </Provider>,
  );
  await flush();
};

let mock: MockAdapter;
beforeEach(() => {
  clearQueryCache();
  mockNavigate.mockClear();
  mock = new MockAdapter(apiClient);
  mock.onAny().reply(404);
});
afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

describe('Account → Help group (shared-settings §6)', () => {
  it.each(['passenger', 'driver'] as const)('%s: Help & support and Invite friends open their screens; no legal rows without links', async (role) => {
    await renderWithStore(<AccountScreen role={role} />, role);
    const prefix = `${role}-settings`;
    expect(screen.getByTestId(`${prefix}-group-help`)).toBeTruthy();
    fireEvent.press(screen.getByTestId(`${prefix}-help`));
    expect(mockNavigate).toHaveBeenCalledWith('Support');
    fireEvent.press(screen.getByTestId(`${prefix}-invite`));
    expect(mockNavigate).toHaveBeenCalledWith('Invite');
    expect(screen.queryByTestId(`${prefix}-terms`)).toBeNull();
    expect(screen.queryByTestId(`${prefix}-privacy`)).toBeNull();
  });

  it('shows Terms / Privacy once public settings send https links, opening the browser', async () => {
    mock.reset();
    mock.onGet('/settings/public').reply(200, {
      success: true,
      data: [
        { key: 'terms_url', value: 'https://example.test/terms' },
        { key: 'privacy_url', value: 'ftp://example.test/privacy' },
      ],
    });
    mock.onAny().reply(404);
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await renderWithStore(<AccountScreen role="passenger" />);
    expect(screen.queryByTestId('passenger-settings-privacy')).toBeNull();
    fireEvent.press(screen.getByTestId('passenger-settings-terms'));
    expect(openURL).toHaveBeenCalledWith('https://example.test/terms');
  });
});

describe('Registration Step 1 invite code (§I4)', () => {
  const form = { ...INITIAL_REGISTRATION_FORM, role: 'passenger' as const, fullName: 'Ali', phoneNumber: '03001234567' };

  it('sends referral_code only when typed (trimmed, upper case)', () => {
    expect(buildRegistrationRequest(form).referral_code).toBeUndefined();
    expect(buildRegistrationRequest({ ...form, inviteCode: ' r7k2mq ' }).referral_code).toBe('R7K2MQ');
  });

  it('maps a 422 on referral_code to the invite field on the first page', () => {
    const mapped = mapRegistrationServerErrors({ referral_code: ['The selected referral code is invalid.'] }, 'passenger');
    expect(mapped).toMatchObject({ step: 'personal', firstField: 'inviteCode', formErrors: [] });
  });

  it('reveals the optional field and shows our wording for a refused code', async () => {
    const onChange = jest.fn();
    await renderWithStore(<InviteCodeField value="" onChange={onChange} />);
    expect(screen.queryByTestId('registration-invite-code')).toBeNull();
    fireEvent.press(screen.getByTestId('registration-invite-toggle'));
    fireEvent.changeText(screen.getByTestId('registration-invite-code'), 'R7 K2');
    expect(onChange).toHaveBeenCalledWith('R7K2');
  });

  it('opens on its own with the error when the server refused the code', async () => {
    await renderWithStore(<InviteCodeField value="BAD" onChange={jest.fn()} error="invalid" />);
    expect(screen.getByText("This invite code isn't valid. Check it, or leave it empty.")).toBeTruthy();
  });
});

describe('ChatComposer maxLength (support replies allow 2000)', () => {
  it('caps and counts at the given length', async () => {
    await renderWithStore(<ChatComposer onSend={() => true} bottomInset={0} maxLength={2000} />);
    expect(screen.getByTestId('chat-input').props.maxLength).toBe(2000);
    fireEvent.changeText(screen.getByTestId('chat-input'), 'x'.repeat(1800));
    expect(screen.getByTestId('chat-counter')).toHaveTextContent('1800/2000');
  });
});
