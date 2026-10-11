/**
 * T-203: Settings → Vehicle & documents for an active driver: loading, the list read-only where
 * the server allows no upload, Re-upload on a rejected item, empty state, and Back.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import MockAdapter from 'axios-mock-adapter';
import { launchImageLibrary } from 'react-native-image-picker';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { apiClient, __resetUnauthorizedStateForTests } from '../../../src/services/api';
import { DriverDocumentsScreen } from '../../../src/features/driverDocuments/screens/DriverDocumentsScreen';
import { DRIVER_DOCUMENTS_COPY } from '../../../src/features/driverDocuments/copy';

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ goBack: mockGoBack, navigate: jest.fn() }),
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
    <ThemeProvider>
      <DriverDocumentsScreen />
    </ThemeProvider>,
  );

beforeEach(() => {
  __resetUnauthorizedStateForTests();
  mock = new MockAdapter(apiClient);
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
});
