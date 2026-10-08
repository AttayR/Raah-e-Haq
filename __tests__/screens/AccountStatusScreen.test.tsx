/**
 * T-106 / AUTH-01, DRV-12: the account-status screen reads apiAuth (never Firebase), shows
 * role- and status-specific copy, "Check Status" calls GET /auth/profile and routes home once
 * active, pending drivers see their rejected documents and can re-upload them, and Sign Out
 * uses the single logout (T-102).
 */
import React from 'react';
import { Alert } from 'react-native';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import MockAdapter from 'axios-mock-adapter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { __resetUnauthorizedStateForTests, apiClient } from '../../src/services/api';
import { authStorage } from '../../src/services/authStorage';
import { rootReducer } from '../../src/store/rootReducer';
import { initializeAuth } from '../../src/store/thunks/apiThunks';
import { LOGOUT_CONFIRM_TITLE } from '../../src/hooks/useLogout';
import { ACCOUNT_STATUS_COPY, ACCOUNT_STATUS_VARIANTS, fillCopy, REJECTED_DOCUMENTS_COPY } from '../../src/features/auth/copy/accountStatus';
import AuthFlow from '../../src/app/navigation/AuthFlow';
import { toast } from '../../src/core/toast';
import type { User } from '../../src/services/api';

jest.mock('../../src/app/navigation/RootNavigation', () => {
  const { Text: MockText } = require('react-native');
  return () => <MockText>route:home</MockText>;
});
jest.mock('../../src/app/navigation/stacks/AuthStack', () => {
  const { Text: MockText } = require('react-native');
  return () => <MockText>route:auth</MockText>;
});

const base: User = {
  id: 21,
  name: 'Pending Driver',
  email: 'pending.driver@example.test',
  phone: '+920000000021',
  status: 'pending',
  role: 'driver',
  roles: ['driver'],
};

let mock: MockAdapter;

const makeStore = () =>
  configureStore({
    reducer: rootReducer,
    middleware: (getDefault) =>
      getDefault({ serializableCheck: false, thunk: { extraArgument: { purgePersistedState: () => Promise.resolve() } } }),
  });

/** Bootstraps a signed-in session whose /auth/profile answers `profile` (status, body). */
const renderAs = async (user: User, profile: [number, unknown] = [200, { success: true, data: { user } }]) => {
  const store = makeStore();
  await authStorage.saveSession({ token: 'test-token-not-real', user });
  mock.onGet('/auth/profile').replyOnce(profile[0], profile[1]);
  await store.dispatch(initializeAuth());
  const screen = render(
    <Provider store={store}>
      <AuthFlow />
    </Provider>,
  );
  return { store, screen };
};

const documentsBody = (documents: unknown[], vehicles: unknown[] = []) => ({
  success: true,
  data: { documents, vehicles, expires_in: 600 },
});

beforeEach(async () => {
  __resetUnauthorizedStateForTests();
  mock = new MockAdapter(apiClient);
  await authStorage.clear();
  await AsyncStorage.clear();
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

describe('AccountStatusScreen', () => {
  it('pending driver: driver copy, rejected documents with reasons, and Check Status routes in when approved', async () => {
    mock.onGet('/profile/documents').reply(
      200,
      documentsBody([
        { id: 1, document_type: 'cnic_front', verification_status: 'rejected', rejection_reason: 'Photo is blurry' },
        { id: 2, document_type: 'cnic_back', verification_status: 'approved', rejection_reason: null },
      ]),
    );
    const { screen } = await renderAs(base);

    expect(screen.getByText(ACCOUNT_STATUS_VARIANTS.pendingDriver.title)).toBeTruthy();
    expect(await screen.findByText('Photo is blurry')).toBeTruthy();
    expect(screen.getByText('CNIC (front)')).toBeTruthy();
    expect(screen.queryByText('CNIC (back)')).toBeNull();

    mock.onGet('/auth/profile').replyOnce(200, { success: true, data: { user: { ...base, status: 'active' } } });
    fireEvent.press(screen.getByTestId('account-status-check'));

    expect(await screen.findByText('route:home')).toBeTruthy();
    expect(mock.history.get.filter((r) => r.url === '/auth/profile')).toHaveLength(2);
    // Approved: the screen is leaving, so the documents list is not fetched again.
    expect(mock.history.get.filter((r) => r.url === '/profile/documents')).toHaveLength(1);
    screen.unmount();
  });

  it('pending passenger: passenger copy, no documents list, passenger wording when still pending', async () => {
    const passenger: User = { ...base, role: 'passenger', roles: ['passenger'] };
    const info = jest.spyOn(toast, 'info');
    const { screen } = await renderAs(passenger);
    expect(screen.getByText(ACCOUNT_STATUS_VARIANTS.pendingPassenger.title)).toBeTruthy();
    expect(screen.queryByTestId('rejected-documents')).toBeNull();
    expect(mock.history.get.some((r) => r.url === '/profile/documents')).toBe(false);

    mock.onGet('/auth/profile').replyOnce(200, { success: true, data: { user: passenger } });
    fireEvent.press(screen.getByTestId('account-status-check'));
    await waitFor(() => expect(info).toHaveBeenCalledWith(ACCOUNT_STATUS_COPY.stillPendingPassenger));
    expect(info).not.toHaveBeenCalledWith(ACCOUNT_STATUS_COPY.stillPending);
    screen.unmount();
  });

  it('many rejected vehicles: actions stay above the list, which is collapsed with "Show N more"', async () => {
    const vehicles = [1, 2, 3, 4, 5].map((id) => ({ id, verification_status: 'rejected', rejection_reason: `Reason ${id}` }));
    mock.onGet('/profile/documents').reply(200, documentsBody([], vehicles));
    const { screen } = await renderAs(base);

    expect(await screen.findByText('Vehicle #1')).toBeTruthy();
    expect(screen.getByText('Vehicle #3')).toBeTruthy();
    expect(screen.queryByText('Vehicle #4')).toBeNull();
    expect(screen.getByText(fillCopy(REJECTED_DOCUMENTS_COPY.showMore, { count: 2 }))).toBeTruthy();
    // Check Status and Sign Out come before the list in the tree (rendered above it).
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('account-status-sign-out')).toBeLessThan(tree.indexOf('rejected-documents'));

    fireEvent.press(screen.getByTestId('rejected-documents-toggle'));
    expect(screen.getByText('Vehicle #5')).toBeTruthy();
    expect(screen.getByText(REJECTED_DOCUMENTS_COPY.showFewer)).toBeTruthy();
    screen.unmount();
  });

  it('suspended (403 on cold start): suspended copy; an unchanged status after Check Status keeps the screen', async () => {
    const refusal = {
      success: false,
      message: 'Your account has been suspended. Please contact support.',
      code: 'ACCOUNT_SUSPENDED',
      data: { status: 'suspended' },
    };
    const { screen } = await renderAs({ ...base, status: 'active' }, [403, refusal]);
    expect(screen.getByText(ACCOUNT_STATUS_VARIANTS.suspended.title)).toBeTruthy();

    mock.onGet('/auth/profile').replyOnce(403, refusal);
    fireEvent.press(screen.getByTestId('account-status-check'));
    await waitFor(() => expect(screen.getByText(ACCOUNT_STATUS_COPY.checkStatus)).toBeTruthy());
    expect(screen.getByText(ACCOUNT_STATUS_VARIANTS.suspended.title)).toBeTruthy();
    screen.unmount();
  });

  it('rejected: shows the rejection_reason from the 403 body', async () => {
    const { screen } = await renderAs({ ...base, status: 'active' }, [
      403,
      {
        success: false,
        message: 'Your account application was not approved. Please contact support.',
        code: 'ACCOUNT_REJECTED',
        data: { status: 'rejected', rejection_reason: 'Licence has expired' },
      },
    ]);
    expect(screen.getByText(ACCOUNT_STATUS_VARIANTS.rejected.title)).toBeTruthy();
    expect(screen.getByTestId('account-status-reason')).toBeTruthy();
    expect(screen.getByText('Licence has expired')).toBeTruthy();
    screen.unmount();
  });

  it('inactive and an active admin get their own copy; the admin has no Check Status', async () => {
    const inactive = await renderAs({ ...base, status: 'inactive' });
    expect(inactive.screen.getByText(ACCOUNT_STATUS_VARIANTS.inactive.title)).toBeTruthy();
    inactive.screen.unmount();

    const admin = await renderAs({ ...base, status: 'active', role: 'admin', roles: ['admin'] });
    expect(admin.screen.getByText(ACCOUNT_STATUS_VARIANTS.unsupportedRole.title)).toBeTruthy();
    expect(admin.screen.queryByTestId('account-status-check')).toBeNull();
    expect(admin.screen.getByTestId('account-status-sign-out')).toBeTruthy();
    admin.screen.unmount();
  });

  it('a malformed 200 profile shows "couldn\'t confirm", not the cached active home', async () => {
    const { screen } = await renderAs({ ...base, status: 'active' }, [200, { success: true, data: { nope: true } }]);
    expect(screen.getByText(ACCOUNT_STATUS_VARIANTS.unverified.title)).toBeTruthy();
    expect(screen.queryByText('route:home')).toBeNull();

    mock.onGet('/auth/profile').replyOnce(200, { success: true, data: { user: { ...base, status: 'active' } } });
    fireEvent.press(screen.getByTestId('account-status-check'));
    expect(await screen.findByText('route:home')).toBeTruthy();
    screen.unmount();
  });

  it('Check Status offline shows an inline error and keeps the screen', async () => {
    const { screen } = await renderAs({ ...base, role: 'passenger', roles: ['passenger'] });
    mock.onGet('/auth/profile').networkErrorOnce();
    fireEvent.press(screen.getByTestId('account-status-check'));
    expect(await screen.findByTestId('account-status-check-error')).toBeTruthy();
    expect(screen.getByText(ACCOUNT_STATUS_VARIANTS.pendingPassenger.title)).toBeTruthy();
    screen.unmount();
  });

  it('re-uploads a rejected document as multipart; a 409 refreshes the list', async () => {
    mock
      .onGet('/profile/documents')
      .replyOnce(200, documentsBody([{ id: 4, document_type: 'driving_license', verification_status: 'rejected', rejection_reason: 'Cut off' }]))
      .onGet('/profile/documents')
      .reply(200, documentsBody([{ id: 4, document_type: 'driving_license', verification_status: 'pending', rejection_reason: null }]));
    mock.onPost('/profile/documents/4').replyOnce(409, { success: false, message: 'Only a rejected item can be re-uploaded.', code: 'DOCUMENT_NOT_REJECTED' });
    (launchImageLibrary as jest.Mock).mockResolvedValueOnce({
      assets: [{ uri: 'file:///tmp/licence.jpg', type: 'image/jpeg', fileName: 'licence.jpg', fileSize: 120000 }],
    });

    const { screen } = await renderAs(base);
    fireEvent.press(await screen.findByTestId('reupload-document-4'));

    expect(await screen.findByTestId('rejected-documents-empty')).toBeTruthy();
    const post = mock.history.post.find((r) => r.url === '/profile/documents/4');
    expect(post?.data).toBeInstanceOf(FormData);
    expect(mock.history.get.filter((r) => r.url === '/profile/documents')).toHaveLength(2);
    screen.unmount();
  });

  it('a rejected vehicle: pick the parts, then send them together', async () => {
    mock
      .onGet('/profile/documents')
      .replyOnce(200, documentsBody([], [{ id: 9, verification_status: 'rejected', rejection_reason: 'Plate not visible' }]))
      .onGet('/profile/documents')
      .reply(200, documentsBody([], [{ id: 9, verification_status: 'pending', rejection_reason: null }]));
    mock.onPost('/profile/vehicles/9/documents').replyOnce(200, documentsBody([], []));
    (launchImageLibrary as jest.Mock).mockResolvedValueOnce({
      assets: [{ uri: 'file:///tmp/front.png', type: 'image/png', fileSize: 2000 }],
    });

    const { screen } = await renderAs(base);
    expect(await screen.findByText('Plate not visible')).toBeTruthy();
    expect(screen.getByText('Vehicle #1')).toBeTruthy();
    // Collapsed until the driver chooses to replace photos.
    expect(screen.queryByTestId('vehicle-9-front_image')).toBeNull();
    fireEvent.press(screen.getByTestId('vehicle-9-open'));
    const front = screen.getByTestId('vehicle-9-front_image');
    await act(async () => {
      fireEvent.press(front);
    });
    expect(await screen.findByText(REJECTED_DOCUMENTS_COPY.selected)).toBeTruthy();
    fireEvent.press(screen.getByTestId('vehicle-9-submit'));

    expect(await screen.findByTestId('rejected-documents-empty')).toBeTruthy();
    expect(mock.history.post.filter((r) => r.url === '/profile/vehicles/9/documents')).toHaveLength(1);
    screen.unmount();
  });

  it('a photo over 5 MB is refused before any upload', async () => {
    mock.onGet('/profile/documents').reply(
      200,
      documentsBody([{ id: 5, document_type: 'cnic_back', verification_status: 'rejected', rejection_reason: 'Glare' }]),
    );
    (launchImageLibrary as jest.Mock).mockResolvedValueOnce({
      assets: [{ uri: 'file:///tmp/big.jpg', type: 'image/jpeg', fileSize: 6 * 1024 * 1024 }],
    });
    const { screen } = await renderAs(base);
    const button = await screen.findByTestId('reupload-document-5');
    await act(async () => {
      fireEvent.press(button);
    });
    expect(mock.history.post).toHaveLength(0);
    expect(screen.getByText(REJECTED_DOCUMENTS_COPY.reupload)).toBeTruthy();
    screen.unmount();
  });

  it('Sign Out asks first (the single logout, T-102)', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { screen } = await renderAs({ ...base, role: 'passenger', roles: ['passenger'] });
    fireEvent.press(screen.getByTestId('account-status-sign-out'));
    expect(alert).toHaveBeenCalledWith(LOGOUT_CONFIRM_TITLE, expect.any(String), expect.any(Array));
    screen.unmount();
  });
});
