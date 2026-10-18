/**
 * T-203: POST /auth/register (multipart) uploads every driver image as its own file part
 * (profile, CNIC front/back, licence, vehicle front/back/left/right) and nothing for empty slots.
 */
import MockAdapter from 'axios-mock-adapter';
import {
  apiClient,
  apiService,
  toMultipartFile,
  __resetUnauthorizedStateForTests,
  type RegisterWithImagesRequest,
} from '../../src/services/api';

const driver: RegisterWithImagesRequest = {
  name: 'Test Driver',
  email: 'driver@example.test',
  password: 'Secret123',
  password_confirmation: 'Secret123',
  user_type: 'driver',
  phone: '+923009990002',
  cnic: '35202-1234567-1',
  address: 'Lahore',
  emergency_contact: '+923009990002',
  license_number: 'LHR-1',
  vehicle_type: 'car',
  profile_image: 'file:///tmp/driver.jpg',
  cnic_front_image: 'file:///tmp/cnic-front.jpg',
  cnic_back_image: 'file:///tmp/cnic-back.png',
  license_image: 'file:///tmp/license.jpg',
  vehicle_front_image: 'file:///tmp/v-front.jpg',
  vehicle_back_image: 'file:///tmp/v-back.jpg',
  vehicle_left_image: 'file:///tmp/v-left.jpg',
  vehicle_right_image: 'file:///tmp/v-right.jpg',
};

let mock: MockAdapter;

beforeEach(() => {
  __resetUnauthorizedStateForTests();
  mock = new MockAdapter(apiClient);
  mock.onPost('/auth/register').reply(201, { success: true, data: {} });
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

/** File parts appended to the multipart body (Jest's FormData cannot hold RN file objects). */
const fileParts = (append: jest.SpyInstance) =>
  Object.fromEntries(
    append.mock.calls
      .filter(([, value]) => typeof value === 'object' && value !== null)
      .map(([name, value]) => [name, value]),
  );

describe('registerWithImages (driver)', () => {
  it('sends all eight driver images as file parts with name and type', async () => {
    const append = jest.spyOn(FormData.prototype, 'append');
    await apiService.registerWithImages(driver);

    expect(fileParts(append)).toEqual({
      profile_image: { uri: 'file:///tmp/driver.jpg', name: 'driver.jpg', type: 'image/jpeg' },
      cnic_front_image: { uri: 'file:///tmp/cnic-front.jpg', name: 'cnic-front.jpg', type: 'image/jpeg' },
      cnic_back_image: { uri: 'file:///tmp/cnic-back.png', name: 'cnic-back.png', type: 'image/png' },
      license_image: { uri: 'file:///tmp/license.jpg', name: 'license.jpg', type: 'image/jpeg' },
      vehicle_front_image: { uri: 'file:///tmp/v-front.jpg', name: 'v-front.jpg', type: 'image/jpeg' },
      vehicle_back_image: { uri: 'file:///tmp/v-back.jpg', name: 'v-back.jpg', type: 'image/jpeg' },
      vehicle_left_image: { uri: 'file:///tmp/v-left.jpg', name: 'v-left.jpg', type: 'image/jpeg' },
      vehicle_right_image: { uri: 'file:///tmp/v-right.jpg', name: 'v-right.jpg', type: 'image/jpeg' },
    });
    expect(mock.history.post).toHaveLength(1);
  });

  it('skips images that were not picked', async () => {
    const append = jest.spyOn(FormData.prototype, 'append');
    await apiService.registerWithImages({ ...driver, cnic_back_image: undefined, vehicle_right_image: '' });
    const parts = fileParts(append);
    expect(Object.keys(parts)).toHaveLength(6);
    expect(parts).not.toHaveProperty('cnic_back_image');
    expect(parts).not.toHaveProperty('vehicle_right_image');
  });

  it('a passenger never sends driver image fields', async () => {
    const append = jest.spyOn(FormData.prototype, 'append');
    await apiService.registerWithImages({
      ...driver,
      user_type: 'passenger',
      passenger_cnic_front_image: 'file:///tmp/p-front.jpg',
    });
    expect(Object.keys(fileParts(append))).toEqual(['passenger_cnic_front_image']);
  });
});

describe('registerWithImages (emergency contact, T-567)', () => {
  const textParts = (append: jest.SpyInstance) =>
    Object.fromEntries(append.mock.calls.filter(([, value]) => typeof value === 'string'));

  it('a driver sends emergency_contact_name and emergency_contact_relation', async () => {
    const append = jest.spyOn(FormData.prototype, 'append');
    await apiService.registerWithImages({ ...driver, emergency_contact_name: 'Ali Raza', emergency_contact_relation: 'brother' });
    expect(textParts(append)).toMatchObject({
      emergency_contact: '+923009990002',
      emergency_contact_name: 'Ali Raza',
      emergency_contact_relation: 'brother',
    });
  });

  it('a driver without a name or relation sends neither field', async () => {
    const append = jest.spyOn(FormData.prototype, 'append');
    await apiService.registerWithImages(driver);
    const parts = textParts(append);
    expect(parts).not.toHaveProperty('emergency_contact_name');
    expect(parts).not.toHaveProperty('emergency_contact_relation');
  });
});

describe('toMultipartFile', () => {
  it('names the part from the URI and infers the type', () => {
    expect(toMultipartFile(undefined, 'x.jpg')).toBeUndefined();
    expect(toMultipartFile('', 'x.jpg')).toBeUndefined();
    expect(toMultipartFile('file:///a/b/photo.GIF', 'x.jpg')).toEqual({ uri: 'file:///a/b/photo.GIF', name: 'photo.GIF', type: 'image/gif' });
    expect(toMultipartFile('content://media/123/', 'fallback.jpg')).toEqual({
      uri: 'content://media/123/',
      name: 'fallback.jpg',
      type: 'image/jpeg',
    });
  });
});
