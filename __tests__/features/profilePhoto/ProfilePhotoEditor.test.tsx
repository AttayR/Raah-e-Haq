/**
 * T-504: the profile photo editor (both roles). Tap the avatar → Take photo / Choose from library;
 * the picked photo shows at once with upload progress and Cancel; success updates the signed-in
 * user; failure and cancel roll back to the current photo; Retry re-sends the same file; a denied
 * permission explains itself and offers Settings.
 */
import React from 'react';
import { Linking } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import type { AxiosRequestConfig } from 'axios';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { rootReducer } from '../../../src/store/rootReducer';
import { apiService, type ApiResponse, type ApiUser, type User } from '../../../src/services/api';
import { ApiError } from '../../../src/core/api/errors';
import { confirm } from '../../../src/core/dialog';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { ProfilePhotoEditor } from '../../../src/features/profile-photo';

jest.mock('../../../src/core/dialog', () => ({
  ...jest.requireActual('../../../src/core/dialog'),
  confirm: jest.fn(() => Promise.resolve(false)),
}));
const mockConfirm = confirm as jest.MockedFunction<typeof confirm>;
const library = launchImageLibrary as jest.MockedFunction<typeof launchImageLibrary>;
const camera = launchCamera as jest.MockedFunction<typeof launchCamera>;

const OLD_PHOTO = 'http://localhost:8000/storage/avatars/old.jpg';
const NEW_PHOTO = 'http://localhost:8000/storage/avatars/new.jpg';
const PICKED = 'file:///tmp/picked.jpg';

const signedInUser: User = {
  id: 7,
  name: 'Test Rider',
  email: 'rider@example.test',
  phone: '+923000000007',
  status: 'active',
  role: 'passenger',
  roles: ['passenger'],
  profile_image_url: OLD_PHOTO,
};

const serverProfile = (photo: string): ApiUser => ({ ...signedInUser, profile_image_url: photo });

type Upload = { config?: AxiosRequestConfig; resolve: (photo: string) => void; reject: (error: unknown) => void };

/** Holds each upload open until the test settles it; an abort rejects it as the API layer does. */
const controlUploads = () => {
  const uploads: Upload[] = [];
  const spy = jest.spyOn(apiService, 'uploadAvatar').mockImplementation(
    (_file, config) =>
      new Promise<ApiResponse<ApiUser>>((resolve, reject) => {
        config?.signal?.addEventListener?.('abort', () =>
          reject(new ApiError({ kind: 'cancelled', message: 'Request was cancelled' })),
        );
        uploads.push({
          config,
          resolve: (photo) => resolve({ success: true, data: serverProfile(photo) }),
          reject,
        });
      }),
  );
  return { uploads, spy };
};

const renderEditor = async (props: Partial<React.ComponentProps<typeof ProfilePhotoEditor>> = {}) => {
  const initial = rootReducer(undefined, { type: '@@init' });
  const store = configureStore({
    reducer: rootReducer,
    preloadedState: { ...initial, apiAuth: { ...initial.apiAuth, isAuthenticated: true, user: signedInUser } },
  });
  const Bound = () => {
    const [uri, setUri] = React.useState<string | null | undefined>(store.getState().apiAuth.user?.profile_image_url);
    React.useEffect(() => store.subscribe(() => setUri(store.getState().apiAuth.user?.profile_image_url)), []);
    return <ProfilePhotoEditor name="Test Rider" uri={uri} {...props} />;
  };
  render(
    <Provider store={store}>
      <ThemeProvider>
        <Bound />
      </ThemeProvider>
    </Provider>,
  );
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  });
  return store;
};

const photoUri = () => screen.queryByTestId('profile-photo-avatar-photo')?.props.source?.uri;

/** Opens the sheet and picks from the library or the camera (the picker opens after the sheet closes). */
const pick = async (source: 'library' | 'camera') => {
  fireEvent.press(screen.getByTestId('profile-photo-button'));
  fireEvent.press(screen.getByTestId(source === 'library' ? 'photo-source-library' : 'photo-source-camera'));
  const launcher = source === 'library' ? library : camera;
  await waitFor(() => expect(launcher).toHaveBeenCalled());
};

beforeEach(() => {
  library.mockReset();
  camera.mockReset();
  mockConfirm.mockClear();
  library.mockResolvedValue({ assets: [{ uri: PICKED, type: 'image/jpeg', fileName: 'picked.jpg', fileSize: 150_000 }] });
});

afterEach(() => jest.restoreAllMocks());

describe('ProfilePhotoEditor', () => {
  it('offers Take photo and Choose from library; no Remove unless the screen allows it (drivers)', async () => {
    await renderEditor();
    expect(screen.getByLabelText('Change profile photo')).toBeTruthy();
    fireEvent.press(screen.getByTestId('profile-photo-button'));
    expect(screen.getByText('Take photo')).toBeTruthy();
    expect(screen.getByText('Choose from library')).toBeTruthy();
    expect(screen.queryByText(/remove/i)).toBeNull();
  });

  it('shows the picked photo with progress, then the server photo; the store holds the new profile', async () => {
    const { uploads } = controlUploads();
    const store = await renderEditor();
    expect(photoUri()).toBe(OLD_PHOTO);

    await pick('library');
    await waitFor(() => expect(uploads).toHaveLength(1));
    expect(photoUri()).toBe(PICKED);
    expect(screen.getByTestId('profile-photo-cancel')).toBeTruthy();

    act(() => uploads[0].config?.onUploadProgress?.({ loaded: 40, total: 100, bytes: 40, lengthComputable: true }));
    expect(screen.getByText('40%')).toBeTruthy();

    await act(async () => uploads[0].resolve(NEW_PHOTO));
    await waitFor(() => expect(screen.queryByTestId('profile-photo-progress')).toBeNull());
    expect(store.getState().apiAuth.user?.profile_image_url).toBe(NEW_PHOTO);
    expect(photoUri()).toBe(NEW_PHOTO);
    expect(screen.queryByTestId('profile-photo-cancel')).toBeNull();
  });

  it('a failed upload rolls back to the current photo and Retry sends the same file again', async () => {
    const { uploads, spy } = controlUploads();
    const store = await renderEditor();

    await pick('library');
    await waitFor(() => expect(uploads).toHaveLength(1));
    await act(async () => uploads[0].reject(new ApiError({ kind: 'server', status: 500, message: 'Server error. Please try again.' })));

    await waitFor(() => expect(screen.getByTestId('profile-photo-error')).toBeTruthy());
    expect(photoUri()).toBe(OLD_PHOTO);
    expect(store.getState().apiAuth.user?.profile_image_url).toBe(OLD_PHOTO);

    fireEvent.press(screen.getByTestId('profile-photo-retry'));
    await waitFor(() => expect(uploads).toHaveLength(2));
    expect(spy.mock.calls[1][0]).toEqual(spy.mock.calls[0][0]);
    expect(spy.mock.calls[1][0]).toMatchObject({ uri: PICKED, type: 'image/jpeg' });
    await act(async () => uploads[1].resolve(NEW_PHOTO));
    await waitFor(() => expect(screen.queryByTestId('profile-photo-error')).toBeNull());
    expect(photoUri()).toBe(NEW_PHOTO);
  });

  it('Cancel aborts the upload and puts the current photo back without an error', async () => {
    const { uploads } = controlUploads();
    await renderEditor();

    await pick('library');
    await waitFor(() => expect(uploads).toHaveLength(1));
    await act(async () => fireEvent.press(screen.getByTestId('profile-photo-cancel')));

    await waitFor(() => expect(screen.queryByTestId('profile-photo-progress')).toBeNull());
    expect(uploads[0].config?.signal?.aborted).toBe(true);
    expect(photoUri()).toBe(OLD_PHOTO);
    expect(screen.queryByTestId('profile-photo-error')).toBeNull();
  });

  it('a denied camera explains why and opens Settings on request; nothing is uploaded', async () => {
    const { spy } = controlUploads();
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    camera.mockResolvedValue({ errorCode: 'permission' });
    mockConfirm.mockResolvedValueOnce(true);
    await renderEditor();

    await pick('camera');

    await waitFor(() => expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Camera access is off', confirmLabel: 'Open Settings' })));
    await waitFor(() => expect(openSettings).toHaveBeenCalled());
    expect(spy).not.toHaveBeenCalled();
    expect(photoUri()).toBe(OLD_PHOTO);
  });

  it('[T-542] Remove photo (passengers) asks first, then DELETE /profile/avatar shows the initials', async () => {
    const removeSpy = jest
      .spyOn(apiService, 'removeAvatar')
      .mockResolvedValue({ success: true, message: 'Avatar removed', data: { ...signedInUser, profile_image_url: null } });
    mockConfirm.mockResolvedValueOnce(true);
    const store = await renderEditor({ canRemove: true });

    fireEvent.press(screen.getByTestId('profile-photo-button'));
    fireEvent.press(screen.getByTestId('photo-source-remove'));

    await waitFor(() => expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Remove your photo?', destructive: true })));
    await waitFor(() => expect(removeSpy).toHaveBeenCalled());
    await waitFor(() => expect(store.getState().apiAuth.user?.profile_image_url).toBeNull());
    expect(photoUri()).toBeUndefined();
  });

  it('[T-542] declining the Remove question keeps the photo', async () => {
    const removeSpy = jest.spyOn(apiService, 'removeAvatar');
    mockConfirm.mockResolvedValueOnce(false);
    await renderEditor({ canRemove: true });

    fireEvent.press(screen.getByTestId('profile-photo-button'));
    fireEvent.press(screen.getByTestId('photo-source-remove'));

    await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
    expect(removeSpy).not.toHaveBeenCalled();
    expect(photoUri()).toBe(OLD_PHOTO);
  });

  it('[T-542] a 429 names how long to wait', async () => {
    const { uploads } = controlUploads();
    await renderEditor();

    await pick('library');
    await waitFor(() => expect(uploads).toHaveLength(1));
    await act(async () =>
      uploads[0].reject(new ApiError({ kind: 'rate_limited', status: 429, message: 'Too many attempts.', code: 'rate_limited', retryAfter: 1500 })),
    );

    await waitFor(() => expect(screen.getByTestId('profile-photo-error')).toHaveTextContent(/Try again in 25 min/));
  });
});
