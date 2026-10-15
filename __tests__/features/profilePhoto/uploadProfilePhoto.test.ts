/**
 * T-504: POST /profile/avatar. The multipart body carries `avatar`, progress is forwarded, the
 * signed-in user is replaced with the server's profile (so every avatar follows), and a failure
 * or a cancel leaves the user as it was.
 */
import { configureStore } from '@reduxjs/toolkit';
import MockAdapter from 'axios-mock-adapter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient, apiService, AVATAR_UPLOAD_TIMEOUT_MS } from '../../../src/services/api';
import { authStorage } from '../../../src/services/authStorage';
import { rootReducer } from '../../../src/store/rootReducer';
import type { SessionThunkExtra } from '../../../src/store/thunks/sessionThunks';
import { loginUser, removeProfilePhoto, uploadProfilePhoto } from '../../../src/store/thunks/apiThunks';

const TOKEN = 'test-token-not-real';
const FILE = { uri: 'file:///tmp/avatar.jpg', name: 'avatar.jpg', type: 'image/jpeg' };
const OLD_PHOTO = 'http://localhost:8000/storage/avatars/old.jpg';
const NEW_PHOTO = 'http://localhost:8000/storage/avatars/new.jpg';

const profile = (photo: string) => ({
  id: 7,
  name: 'Test Rider',
  email: 'rider@example.test',
  phone: '+923000000007',
  status: 'active',
  role: 'passenger',
  roles: ['passenger'],
  profile_image: 'storage/avatars/x.jpg',
  profile_image_url: photo,
});

const makeStore = () => {
  const extra: SessionThunkExtra = { purgePersistedState: jest.fn(() => Promise.resolve()) };
  return configureStore({
    reducer: rootReducer,
    middleware: (getDefault) => getDefault({ serializableCheck: false, thunk: { extraArgument: extra } }),
  });
};

let mock: MockAdapter;

const signedIn = async () => {
  mock.onPost('/auth/login').reply(200, {
    success: true,
    data: { user: profile(OLD_PHOTO), token: TOKEN, token_type: 'Bearer', expires_at: null },
  });
  const store = makeStore();
  await store.dispatch(loginUser({ email: 'rider@example.test', password: 'not-a-real-password' }));
  expect(store.getState().apiAuth.user?.profile_image_url).toBe(OLD_PHOTO);
  return store;
};

beforeEach(async () => {
  mock = new MockAdapter(apiClient);
  await authStorage.clear();
  await AsyncStorage.clear();
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

describe('uploadProfilePhoto', () => {
  it('sends the photo as multipart `avatar` with a long timeout and stores the new profile', async () => {
    const store = await signedIn();
    const append = jest.spyOn(FormData.prototype, 'append');
    let sent: { isForm: boolean; timeout?: number; contentType?: unknown } | null = null;
    mock.onPost('/profile/avatar').reply((config) => {
      sent = { isForm: config.data instanceof FormData, timeout: config.timeout, contentType: config.headers?.['Content-Type'] };
      return [200, { success: true, message: 'Avatar updated', data: profile(NEW_PHOTO) }];
    });

    const result = await store.dispatch(uploadProfilePhoto({ file: FILE }));

    expect(result.payload).toMatchObject({ user: { profile_image_url: NEW_PHOTO }, message: 'Avatar updated' });
    expect(append.mock.calls).toEqual([['avatar', FILE]]);
    expect(sent).toEqual({ isForm: true, timeout: AVATAR_UPLOAD_TIMEOUT_MS, contentType: 'multipart/form-data' });
    expect(store.getState().apiAuth.user?.profile_image_url).toBe(NEW_PHOTO);
    // Only a success touches the store: no global loading or error state for the photo.
    expect(store.getState().apiAuth.error).toBeNull();
  });

  it('forwards upload progress as a fraction', async () => {
    const store = await signedIn();
    jest.spyOn(apiService, 'uploadAvatar').mockImplementation(async (_file, config) => {
      config?.onUploadProgress?.({ loaded: 25, total: 100, bytes: 25, lengthComputable: true });
      config?.onUploadProgress?.({ loaded: 100, total: 100, bytes: 75, lengthComputable: true });
      return { success: true, data: profile(NEW_PHOTO) };
    });
    const onProgress = jest.fn();

    await store.dispatch(uploadProfilePhoto({ file: FILE, onProgress }));

    expect(onProgress.mock.calls).toEqual([[0.25], [1]]);
  });

  it('a 422 keeps the current photo and carries the field message', async () => {
    const store = await signedIn();
    mock.onPost('/profile/avatar').reply(422, {
      message: 'The avatar field must not be greater than 2048 kilobytes.',
      errors: { avatar: ['The avatar field must not be greater than 2048 kilobytes.'] },
    });

    const result = await store.dispatch(uploadProfilePhoto({ file: FILE }));

    expect(uploadProfilePhoto.rejected.match(result)).toBe(true);
    expect(result.payload).toMatchObject({ fieldErrors: { avatar: ['The avatar field must not be greater than 2048 kilobytes.'] } });
    expect(store.getState().apiAuth.user?.profile_image_url).toBe(OLD_PHOTO);
  });

  it('an aborted upload rejects as cancelled and changes nothing', async () => {
    const store = await signedIn();
    mock.onPost('/profile/avatar').reply(200, { success: true, data: profile(NEW_PHOTO) });
    const controller = new AbortController();
    controller.abort();

    const result = await store.dispatch(uploadProfilePhoto({ file: FILE, signal: controller.signal }));

    expect(result.payload).toMatchObject({ kind: 'cancelled' });
    expect(store.getState().apiAuth.user?.profile_image_url).toBe(OLD_PHOTO);
  });

  it('[T-542] a driver upload keeps the approved photo and stores the pending one with its review', async () => {
    const store = await signedIn();
    mock.onPost('/profile/avatar').reply(200, {
      success: true,
      message: 'Photo submitted for review. Your current photo stays until it is approved.',
      data: { ...profile(OLD_PHOTO), role: 'driver', roles: ['driver'], profile_image_review: 'pending', pending_profile_image_url: NEW_PHOTO },
    });

    const result = await store.dispatch(uploadProfilePhoto({ file: FILE }));

    expect(result.payload).toMatchObject({ message: 'Photo submitted for review. Your current photo stays until it is approved.' });
    const user = store.getState().apiAuth.user;
    expect(user?.profile_image_url).toBe(OLD_PHOTO);
    expect(user?.pending_profile_image_url).toBe(NEW_PHOTO);
    expect(user?.profile_image_review).toBe('pending');
  });

  it('[T-542] 429 rate_limited carries retry_after', async () => {
    const store = await signedIn();
    mock.onPost('/profile/avatar').reply(429, { success: false, code: 'rate_limited', retry_after: 1800 });

    const result = await store.dispatch(uploadProfilePhoto({ file: FILE }));

    expect(result.payload).toMatchObject({ kind: 'rate_limited', status: 429, retryAfter: 1800 });
    expect(store.getState().apiAuth.user?.profile_image_url).toBe(OLD_PHOTO);
  });

  it('a result after sign-out is not stored', async () => {
    const store = makeStore();
    mock.onPost('/profile/avatar').reply(200, { success: true, data: profile(NEW_PHOTO) });

    await store.dispatch(uploadProfilePhoto({ file: FILE }));

    expect(store.getState().apiAuth.user).toBeNull();
  });
});

describe('removeProfilePhoto (BE-94)', () => {
  it('DELETE /profile/avatar clears the photo of the signed-in user', async () => {
    const store = await signedIn();
    mock.onDelete('/profile/avatar').reply(200, { success: true, message: 'Avatar removed', data: { ...profile(OLD_PHOTO), profile_image_url: null } });

    const result = await store.dispatch(removeProfilePhoto());

    expect(removeProfilePhoto.fulfilled.match(result)).toBe(true);
    expect(store.getState().apiAuth.user?.profile_image_url).toBeNull();
  });

  it('a driver gets PROFILE_PHOTO_REQUIRED and keeps the photo', async () => {
    const store = await signedIn();
    mock.onDelete('/profile/avatar').reply(422, {
      success: false,
      message: 'Drivers must keep a profile photo. Upload a new one instead; it will be reviewed.',
      error: { code: 'PROFILE_PHOTO_REQUIRED' },
    });

    const result = await store.dispatch(removeProfilePhoto());

    expect(result.payload).toMatchObject({
      code: 'PROFILE_PHOTO_REQUIRED',
      message: 'Drivers must keep a profile photo. Upload a new one instead; it will be reviewed.',
    });
    expect(store.getState().apiAuth.user?.profile_image_url).toBe(OLD_PHOTO);
  });
});
