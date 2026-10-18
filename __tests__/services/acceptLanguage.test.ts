/**
 * T-523: every request of the shared API client says the app's language in `Accept-Language`, so
 * the server can localise its messages later; a caller's own header is kept.
 */
import MockAdapter from 'axios-mock-adapter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../../src/services/api';
import { setLocale } from '../../src/i18n';

let mock: MockAdapter;

beforeEach(async () => {
  await AsyncStorage.clear();
  mock = new MockAdapter(apiClient);
  mock.onGet('/vehicle-types').reply(200, { success: true, data: [] });
});

afterEach(() => {
  mock.restore();
  setLocale('en');
});

const lastLanguage = () => mock.history.get[mock.history.get.length - 1]?.headers?.['Accept-Language'];

describe('Accept-Language (T-523)', () => {
  it('sends English by default', async () => {
    await apiClient.get('/vehicle-types');
    expect(lastLanguage()).toBe('en');
  });

  it('sends Roman Urdu, with English as the fallback, after a switch', async () => {
    setLocale('ur-Latn');
    await apiClient.get('/vehicle-types');
    expect(lastLanguage()).toBe('ur-Latn, en;q=0.8');
  });

  it('keeps a header the caller set', async () => {
    setLocale('ur-Latn');
    await apiClient.get('/vehicle-types', { headers: { 'Accept-Language': 'en' } });
    expect(lastLanguage()).toBe('en');
  });
});
