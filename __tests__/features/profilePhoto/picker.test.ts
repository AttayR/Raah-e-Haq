/** T-504: the profile photo picker resizes and compresses, and maps every outcome. */
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import {
  PROFILE_PHOTO_MAX_BYTES,
  pickProfilePhoto,
  profilePhotoProblem,
} from '../../../src/features/profile-photo/picker';

const camera = launchCamera as jest.MockedFunction<typeof launchCamera>;
const library = launchImageLibrary as jest.MockedFunction<typeof launchImageLibrary>;

beforeEach(() => {
  camera.mockReset();
  library.mockReset();
});

describe('pickProfilePhoto', () => {
  it('asks the camera for a front photo scaled to 1024 px and JPEG 0.8, without base64 or extra metadata', async () => {
    camera.mockResolvedValue({ assets: [{ uri: 'file:///tmp/a.jpg', type: 'image/jpeg', fileName: 'a.jpg', fileSize: 120_000 }] });

    const result = await pickProfilePhoto('camera');

    expect(camera).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaType: 'photo',
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 0.8,
        includeBase64: false,
        includeExtra: false,
        cameraType: 'front',
        saveToPhotos: false,
      }),
    );
    expect(result).toEqual({ file: { uri: 'file:///tmp/a.jpg', name: 'a.jpg', type: 'image/jpeg' } });
  });

  it('asks the library for one photo with the same compression', async () => {
    library.mockResolvedValue({ assets: [{ uri: 'file:///tmp/b.png', type: 'image/png' }] });

    const result = await pickProfilePhoto('library');

    expect(library).toHaveBeenCalledWith(expect.objectContaining({ selectionLimit: 1, maxWidth: 1024, maxHeight: 1024, quality: 0.8 }));
    expect(camera).not.toHaveBeenCalled();
    expect(result).toEqual({ file: { uri: 'file:///tmp/b.png', name: 'avatar.png', type: 'image/png' } });
  });

  it('returns null when the user cancels', async () => {
    library.mockResolvedValue({ didCancel: true });
    expect(await pickProfilePhoto('library')).toBeNull();
  });

  it('reports a denied permission, a missing camera and a picker failure', async () => {
    camera.mockResolvedValueOnce({ errorCode: 'permission' });
    expect(await pickProfilePhoto('camera')).toEqual({ problem: 'permission' });
    camera.mockResolvedValueOnce({ errorCode: 'camera_unavailable' });
    expect(await pickProfilePhoto('camera')).toEqual({ problem: 'unavailable' });
    camera.mockRejectedValueOnce(new Error('native crash'));
    expect(await pickProfilePhoto('camera')).toEqual({ problem: 'failed' });
  });

  it('refuses a type or size the server would reject', async () => {
    library.mockResolvedValueOnce({ assets: [{ uri: 'file:///tmp/c.heic', type: 'image/heic' }] });
    expect(await pickProfilePhoto('library')).toEqual({ problem: 'wrongType' });
    library.mockResolvedValueOnce({ assets: [{ uri: 'file:///tmp/d.jpg', type: 'image/jpeg', fileSize: PROFILE_PHOTO_MAX_BYTES + 1 }] });
    expect(await pickProfilePhoto('library')).toEqual({ problem: 'tooLarge' });
  });
});

describe('profilePhotoProblem', () => {
  it('accepts JPEG, PNG and WebP within 2048 KB (BE-94), and nothing else', () => {
    expect(profilePhotoProblem({ type: 'image/jpeg', fileSize: PROFILE_PHOTO_MAX_BYTES })).toBeNull();
    expect(profilePhotoProblem({ type: 'IMAGE/PNG' })).toBeNull();
    expect(profilePhotoProblem({ type: 'image/webp' })).toBeNull();
    expect(profilePhotoProblem({ type: 'image/gif' })).toBe('wrongType');
    expect(profilePhotoProblem({ type: 'image/svg+xml' })).toBe('wrongType');
    expect(profilePhotoProblem({})).toBe('wrongType');
  });

  it('sends a WebP with its own type and extension', async () => {
    library.mockResolvedValueOnce({ assets: [{ uri: 'file:///tmp/e.webp', type: 'image/webp' }] });
    expect(await pickProfilePhoto('library')).toEqual({
      file: { uri: 'file:///tmp/e.webp', name: 'avatar.webp', type: 'image/webp' },
    });
  });
});
