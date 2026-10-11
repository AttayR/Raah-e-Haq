/**
 * T-106 / AUTH-01, DRV-12: the account-status screen reads apiAuth (never Firebase), shows
 * role- and status-specific copy, "Check Status" calls GET /auth/profile and routes home once
 * active, pending drivers see their documents (GET /driver/documents, T-203) and can upload a
 * missing or rejected one, and Sign Out uses the single logout (T-102).
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
import { ACCOUNT_STATUS_COPY, ACCOUNT_STATUS_VARIANTS } from '../../src/features/auth/copy/accountStatus';
import { DRIVER_DOCUMENTS_COPY } from '../../src/features/driverDocuments/copy';
import { DRIVER_DOCUMENT_TYPES } from '../../src/features/driverDocuments/types';
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

type DocOverride = { status: string; can_upload?: boolean; rejection_reason?: string | null };

/** A GET /driver/documents body: all eight types, `missing` unless overridden. */
const documentsBody = (overrides: Record<string, DocOverride> = {}, allApproved = false) => ({
  success: true,
  data: {
    documents: DRIVER_DOCUMENT_TYPES.map((type, index) => {
      const o = overrides[type] ?? { status: 'missing' };
      return {
        id: o.status === 'missing' ? null : index + 1,
        type,
        required: ['profile', 'cnic_front', 'cnic_back', 'license'].includes(type),
        status: o.status,
        rejection_reason: o.rejection_reason ?? null,
        can_upload: o.can_upload ?? (o.status === 'missing' || o.status === 'rejected'),
        url: o.status === 'missing' ? null : `https://signed.example.test/${type}`,
        updated_at: null,
      };
    }),
    required_types: ['profile', 'cnic_front', 'cnic_back', 'license'],
    all_required_approved: allApproved,
    expires_in: 600,
  },
});

const pickPhoto = (asset: Record<string, unknown>) =>
  (launchImageLibrary as jest.Mock).mockResolvedValueOnce({ assets: [asset] });

const JPEG = { uri: 'file:///tmp/licence.jpg', type: 'image/jpeg', fileName: 'licence.jpg', fileSize: 120000 };

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
  it('pending driver: driver copy, every document with its status and reason, and Check Status routes in when approved', async () => {
    mock.onGet('/driver/documents').reply(
      200,
      documentsBody({
        profile: { status: 'approved' },
        cnic_front: { status: 'rejected', rejection_reason: 'Photo is blurry' },
        license: { status: 'pending' },
      }),
    );
    const { screen } = await renderAs(base);

    expect(screen.getByText(ACCOUNT_STATUS_VARIANTS.pendingDriver.title)).toBeTruthy();
    expect(await screen.findByText(`${DRIVER_DOCUMENTS_COPY.reasonLabel} Photo is blurry`)).toBeTruthy();
    expect(screen.getByText(DRIVER_DOCUMENTS_COPY.types.cnic_front)).toBeTruthy();
    expect(screen.getByText(DRIVER_DOCUMENTS_COPY.types.vehicle_right)).toBeTruthy();
    expect(screen.getByTestId('driver-document-profile-status')).toHaveTextContent(DRIVER_DOCUMENTS_COPY.status.approved);
    expect(screen.getByTestId('driver-document-license-status')).toHaveTextContent(DRIVER_DOCUMENTS_COPY.status.pending);
    expect(screen.getByTestId('driver-document-cnic_back-status')).toHaveTextContent(DRIVER_DOCUMENTS_COPY.status.missing);
    // Upload only where the server allows it: rejected (Re-upload) and missing (Upload).
    expect(screen.getByLabelText(`${DRIVER_DOCUMENTS_COPY.reupload} ${DRIVER_DOCUMENTS_COPY.types.cnic_front}`)).toBeTruthy();
    expect(screen.getByLabelText(`${DRIVER_DOCUMENTS_COPY.upload} ${DRIVER_DOCUMENTS_COPY.types.cnic_back}`)).toBeTruthy();
    expect(screen.queryByTestId('driver-document-profile-upload')).toBeNull();
    expect(screen.queryByTestId('driver-document-license-upload')).toBeNull();
    // The signed URLs are never rendered or kept.
    expect(JSON.stringify(screen.toJSON())).not.toContain('signed.example.test');
    // Check Status and Sign Out come before the list in the tree (rendered above it).
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('account-status-sign-out')).toBeLessThan(tree.indexOf('driver-documents'));

    mock.onGet('/auth/profile').replyOnce(200, { success: true, data: { user: { ...base, status: 'active' } } });
    fireEvent.press(screen.getByTestId('account-status-check'));

    expect(await screen.findByText('route:home')).toBeTruthy();
    expect(mock.history.get.filter((r) => r.url === '/auth/profile')).toHaveLength(2);
    // Approved: the screen is leaving, so the documents list is not fetched again.
    expect(mock.history.get.filter((r) => r.url === '/driver/documents')).toHaveLength(1);
    screen.unmount();
  });

  it('pending passenger: passenger copy, no documents list, passenger wording when still pending', async () => {
    const passenger: User = { ...base, role: 'passenger', roles: ['passenger'] };
    const info = jest.spyOn(toast, 'info');
    const { screen } = await renderAs(passenger);
    expect(screen.getByText(ACCOUNT_STATUS_VARIANTS.pendingPassenger.title)).toBeTruthy();
    expect(screen.queryByTestId('driver-documents')).toBeNull();
    expect(mock.history.get.some((r) => r.url === '/driver/documents')).toBe(false);

    mock.onGet('/auth/profile').replyOnce(200, { success: true, data: { user: passenger } });
    fireEvent.press(screen.getByTestId('account-status-check'));
    await waitFor(() => expect(info).toHaveBeenCalledWith(ACCOUNT_STATUS_COPY.stillPendingPassenger));
    expect(info).not.toHaveBeenCalledWith(ACCOUNT_STATUS_COPY.stillPending);
    screen.unmount();
  });

  it('documents load error shows a retry that loads the list again', async () => {
    mock.onGet('/driver/documents').replyOnce(500, { success: false, message: 'boom' });
    mock.onGet('/driver/documents').reply(200, documentsBody({}, false));
    const { screen } = await renderAs(base);

    expect(await screen.findByTestId('driver-documents-error')).toBeTruthy();
    expect(screen.getByText(DRIVER_DOCUMENTS_COPY.loadFailed)).toBeTruthy();
    fireEvent.press(screen.getByTestId('driver-documents-retry'));
    expect(await screen.findByTestId('driver-document-profile')).toBeTruthy();
    expect(screen.getByTestId('driver-documents-summary')).toHaveTextContent(DRIVER_DOCUMENTS_COPY.intro);
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

  it('uploads a rejected document as multipart `document` and shows the list from the response', async () => {
    mock.onGet('/driver/documents').replyOnce(200, documentsBody({ license: { status: 'rejected', rejection_reason: 'Cut off' } }));
    mock.onPost('/driver/documents/license').replyOnce(200, documentsBody({ license: { status: 'pending' } }));
    const success = jest.spyOn(toast, 'success');
    const append = jest.spyOn(FormData.prototype, 'append');
    pickPhoto(JPEG);

    const { screen } = await renderAs(base);
    const button = await screen.findByTestId('driver-document-license-upload');
    await act(async () => {
      fireEvent.press(button);
    });

    await waitFor(() =>
      expect(screen.getByTestId('driver-document-license-status')).toHaveTextContent(DRIVER_DOCUMENTS_COPY.status.pending),
    );
    expect(screen.queryByTestId('driver-document-license-upload')).toBeNull();
    const post = mock.history.post.find((r) => r.url === '/driver/documents/license');
    expect(post?.data).toBeInstanceOf(FormData);
    // Jest has Node's FormData, which cannot hold an RN file part: check what was appended.
    expect(append.mock.calls).toEqual([['document', { uri: JPEG.uri, name: JPEG.fileName, type: JPEG.type }]]);
    expect(success).toHaveBeenCalledWith(DRIVER_DOCUMENTS_COPY.uploaded);
    // The POST answer is the new list: no extra GET.
    expect(mock.history.get.filter((r) => r.url === '/driver/documents')).toHaveLength(1);
    screen.unmount();
  });

  it('409 DOCUMENT_NOT_REPLACEABLE refreshes the list', async () => {
    mock
      .onGet('/driver/documents')
      .replyOnce(200, documentsBody({ license: { status: 'rejected', rejection_reason: 'Cut off' } }))
      .onGet('/driver/documents')
      .reply(200, documentsBody({ license: { status: 'pending' } }));
    mock.onPost('/driver/documents/license').replyOnce(409, {
      success: false,
      message: 'Only a missing or rejected item can be uploaded.',
      error: { code: 'DOCUMENT_NOT_REPLACEABLE' },
    });
    const info = jest.spyOn(toast, 'info');
    pickPhoto(JPEG);

    const { screen } = await renderAs(base);
    const button = await screen.findByTestId('driver-document-license-upload');
    await act(async () => {
      fireEvent.press(button);
    });

    await waitFor(() =>
      expect(screen.getByTestId('driver-document-license-status')).toHaveTextContent(DRIVER_DOCUMENTS_COPY.status.pending),
    );
    expect(info).toHaveBeenCalledWith(DRIVER_DOCUMENTS_COPY.alreadyChanged);
    expect(mock.history.get.filter((r) => r.url === '/driver/documents')).toHaveLength(2);
    screen.unmount();
  });

  it('422 shows the server rule for the document; 409 NO_VEHICLE and 429 get their own message', async () => {
    mock.onGet('/driver/documents').reply(200, documentsBody());
    mock
      .onPost('/driver/documents/cnic_back')
      .replyOnce(422, {
        success: false,
        message: 'The given data was invalid.',
        errors: { document: ['The document must not be greater than 5120 kilobytes.'] },
      })
      .onPost('/driver/documents/vehicle_front')
      .replyOnce(409, { success: false, message: 'Add a vehicle first.', error: { code: 'NO_VEHICLE' } })
      .onPost('/driver/documents/profile')
      .replyOnce(429, { success: false, message: 'Too Many Attempts.' });
    const error = jest.spyOn(toast, 'error');

    const { screen } = await renderAs(base);
    await screen.findByTestId('driver-document-cnic_back-upload');
    for (const type of ['cnic_back', 'vehicle_front', 'profile']) {
      pickPhoto(JPEG);
      await act(async () => {
        fireEvent.press(screen.getByTestId(`driver-document-${type}-upload`));
      });
    }

    await waitFor(() => expect(error).toHaveBeenCalledTimes(3));
    expect(error).toHaveBeenNthCalledWith(1, 'The document must not be greater than 5120 kilobytes.');
    expect(error).toHaveBeenNthCalledWith(2, DRIVER_DOCUMENTS_COPY.noVehicle);
    expect(error).toHaveBeenNthCalledWith(3, DRIVER_DOCUMENTS_COPY.rateLimited);
    // Nothing changed on the server: the list is not reloaded, the uploads stay available.
    expect(mock.history.get.filter((r) => r.url === '/driver/documents')).toHaveLength(1);
    expect(screen.getByTestId('driver-document-cnic_back-upload')).toBeTruthy();
    screen.unmount();
  });

  it('a photo over 5 MB is refused before any upload', async () => {
    mock.onGet('/driver/documents').reply(200, documentsBody({ cnic_back: { status: 'rejected', rejection_reason: 'Glare' } }));
    const error = jest.spyOn(toast, 'error');
    pickPhoto({ uri: 'file:///tmp/big.jpg', type: 'image/jpeg', fileSize: 6 * 1024 * 1024 });
    const { screen } = await renderAs(base);
    const button = await screen.findByTestId('driver-document-cnic_back-upload');
    await act(async () => {
      fireEvent.press(button);
    });
    expect(mock.history.post).toHaveLength(0);
    expect(error).toHaveBeenCalledWith(DRIVER_DOCUMENTS_COPY.tooLarge);
    expect(screen.getByLabelText(`${DRIVER_DOCUMENTS_COPY.reupload} ${DRIVER_DOCUMENTS_COPY.types.cnic_back}`)).toBeTruthy();
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
