/**
 * T-203: Settings → Vehicle & documents for an active driver: loading, the list read-only where
 * the server allows no upload, Re-upload on a rejected item, empty state, and Back.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import MockAdapter from 'axios-mock-adapter';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { rootReducer } from '../../../src/store/rootReducer';
import { launchImageLibrary } from 'react-native-image-picker';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { apiClient, __resetUnauthorizedStateForTests } from '../../../src/services/api';
import { DriverDocumentsScreen } from '../../../src/features/driverDocuments/screens/DriverDocumentsScreen';
import { DRIVER_DOCUMENTS_COPY } from '../../../src/features/driverDocuments/copy';

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ goBack: mockGoBack, navigate: jest.fn() }),
  useIsFocused: () => true,
}));

let mock: MockAdapter;

const doc = (type: string, status: string, extra: Record<string, unknown> = {}) => ({
  id: 1,
  type,
  required: true,
  status,
  rejection_reason: null,
  can_upload: status === 'rejected' || status === 'missing',
  url: null,
  updated_at: null,
  ...extra,
});

const body = (documents: unknown[], allApproved: boolean) => ({
  success: true,
  data: { documents, required_types: [], all_required_approved: allApproved, expires_in: 600 },
});

const renderScreen = () =>
  render(
    <Provider store={configureStore({ reducer: rootReducer })}>
      <ThemeProvider>
        <DriverDocumentsScreen />
      </ThemeProvider>
    </Provider>,
  );

/** GET /profile/documents (BE-42): the vehicles plus signed identity links the app ignores. */
const profileDocuments = (vehicles: unknown[]) => ({
  success: true,
  data: { cnic_front_image: 'https://signed.example/cnic', vehicles, documents: [], expires_in: 600 },
});

beforeEach(() => {
  __resetUnauthorizedStateForTests();
  mock = new MockAdapter(apiClient);
  mock.onGet('/profile/documents').reply(200, profileDocuments([]));
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

describe('DriverDocumentsScreen', () => {
  it('shows loading, then the approved list read-only with the all-approved summary', async () => {
    let answer: (value: [number, unknown]) => void = () => undefined;
    mock.onGet('/driver/documents').replyOnce(() => new Promise((resolve) => (answer = resolve)));
    renderScreen();
    expect(await screen.findByTestId('driver-documents-loading')).toBeTruthy();
    await act(async () => {
      answer([200, body([doc('profile', 'approved'), doc('license', 'approved')], true)]);
    });

    expect(await screen.findByTestId('driver-document-license')).toBeTruthy();
    expect(screen.getByTestId('driver-documents-summary')).toHaveTextContent(DRIVER_DOCUMENTS_COPY.allApproved);
    expect(screen.queryByTestId('driver-document-license-upload')).toBeNull();
    expect(screen.queryByTestId('driver-document-profile-upload')).toBeNull();

    fireEvent.press(screen.getByTestId('driver-documents-back'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('a rejected item shows its reason and re-uploads; the list follows the response', async () => {
    mock
      .onGet('/driver/documents')
      .replyOnce(200, body([doc('license', 'rejected', { rejection_reason: 'Expired licence' })], false));
    mock.onPost('/driver/documents/license').replyOnce(200, body([doc('license', 'pending')], false));
    (launchImageLibrary as jest.Mock).mockResolvedValueOnce({
      assets: [{ uri: 'file:///tmp/l.jpg', type: 'image/jpeg', fileName: 'l.jpg', fileSize: 1000 }],
    });
    renderScreen();

    expect(await screen.findByText(`${DRIVER_DOCUMENTS_COPY.reasonLabel} Expired licence`)).toBeTruthy();
    const button = screen.getByTestId('driver-document-license-upload');
    await act(async () => {
      fireEvent.press(button);
    });
    await waitFor(() =>
      expect(screen.getByTestId('driver-document-license-status')).toHaveTextContent(DRIVER_DOCUMENTS_COPY.status.pending),
    );
    expect(screen.queryByTestId('driver-document-license-upload')).toBeNull();
  });

  it('a cancelled picker sends nothing', async () => {
    mock.onGet('/driver/documents').replyOnce(200, body([doc('cnic_back', 'missing')], false));
    (launchImageLibrary as jest.Mock).mockResolvedValueOnce({ didCancel: true });
    renderScreen();
    const button = await screen.findByTestId('driver-document-cnic_back-upload');
    await act(async () => {
      fireEvent.press(button);
    });
    expect(mock.history.post).toHaveLength(0);
  });

  it('an empty list shows the empty state', async () => {
    mock.onGet('/driver/documents').replyOnce(200, body([], false));
    renderScreen();
    expect(await screen.findByTestId('driver-documents-empty')).toBeTruthy();
  });

  it('T-514: shows the registered vehicle (make, model, plate, review status) above the documents', async () => {
    mock.onGet('/driver/documents').replyOnce(200, body([doc('license', 'approved')], true));
    mock.onGet('/profile/documents').reply(
      200,
      profileDocuments([
        { id: 4, make: 'Mitsubishi', model: 'Outlander', license_plate: 'Z-0001-19', verification_status: 'approved' },
      ]),
    );
    renderScreen();
    expect(await screen.findByTestId('driver-documents-vehicle-4')).toBeTruthy();
    expect(screen.getByText('Mitsubishi Outlander')).toBeTruthy();
    expect(screen.getByText('Plate Z-0001-19')).toBeTruthy();
    expect(screen.getByTestId('driver-documents-vehicle-4')).toHaveTextContent(/Approved/);
    // The signed identity links in the same body are never shown.
    expect(screen.queryByText(/signed\.example/)).toBeNull();
  });

  it('T-514: no vehicle on file says so; a failed read offers a retry', async () => {
    mock.resetHandlers();
    mock.onGet('/driver/documents').reply(200, body([doc('license', 'approved')], true));
    mock.onGet('/profile/documents').replyOnce(500, { success: false, message: 'Server error' });
    mock.onGet('/profile/documents').replyOnce(200, profileDocuments([]));
    renderScreen();
    fireEvent.press(await screen.findByTestId('driver-documents-vehicle-error'));
    expect(await screen.findByTestId('driver-documents-vehicle-empty')).toBeTruthy();
    expect(screen.getByText('No vehicle on file yet')).toBeTruthy();
  });
});
