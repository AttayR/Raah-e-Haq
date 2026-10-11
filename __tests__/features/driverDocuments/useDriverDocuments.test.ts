/**
 * T-203: useDriverDocuments upload flow — a 409 DOCUMENT_NOT_REPLACEABLE reloads the list, and
 * a second tap while the picker is open never opens another picker or upload.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import MockAdapter from 'axios-mock-adapter';
import { launchImageLibrary } from 'react-native-image-picker';
import { apiClient, __resetUnauthorizedStateForTests } from '../../../src/services/api';
import { useDriverDocuments } from '../../../src/features/driverDocuments/hooks';
import { toast } from '../../../src/core/toast';
import { DRIVER_DOCUMENTS_COPY } from '../../../src/features/driverDocuments/copy';

const body = (status: string) => ({
  success: true,
  data: {
    documents: [{ id: 3, type: 'license', required: true, status, rejection_reason: null, can_upload: status === 'rejected', url: null, updated_at: null }],
    all_required_approved: false,
  },
});

const PHOTO = { assets: [{ uri: 'file:///tmp/l.jpg', type: 'image/jpeg', fileName: 'l.jpg', fileSize: 1000 }] };

let mock: MockAdapter;

beforeEach(() => {
  __resetUnauthorizedStateForTests();
  mock = new MockAdapter(apiClient);
  (launchImageLibrary as jest.Mock).mockClear();
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

describe('useDriverDocuments', () => {
  it('409 DOCUMENT_NOT_REPLACEABLE: info toast, then the list is fetched again', async () => {
    mock.onGet('/driver/documents').replyOnce(200, body('rejected')).onGet('/driver/documents').reply(200, body('pending'));
    mock.onPost('/driver/documents/license').replyOnce(409, {
      success: false,
      message: 'Only a missing or rejected item can be uploaded.',
      error: { code: 'DOCUMENT_NOT_REPLACEABLE' },
    });
    (launchImageLibrary as jest.Mock).mockResolvedValueOnce(PHOTO);
    const info = jest.spyOn(toast, 'info');

    const { result } = renderHook(() => useDriverDocuments());
    await waitFor(() => expect(result.current.documents[0]?.status).toBe('rejected'));

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.upload('license');
    });

    expect(outcome).toBe('refreshed');
    expect(info).toHaveBeenCalledWith(DRIVER_DOCUMENTS_COPY.alreadyChanged);
    await waitFor(() => expect(result.current.documents[0]?.status).toBe('pending'));
    expect(mock.history.get.filter((r) => r.url === '/driver/documents')).toHaveLength(2);
    expect(result.current.uploadingType).toBeNull();
  });

  it('a second tap while the picker is open is ignored (one picker, one upload)', async () => {
    mock.onGet('/driver/documents').reply(200, body('rejected'));
    mock.onPost('/driver/documents/license').reply(200, body('pending'));
    let answerPicker: (value: typeof PHOTO) => void = () => undefined;
    (launchImageLibrary as jest.Mock).mockImplementationOnce(
      () => new Promise((resolve) => (answerPicker = resolve)),
    );

    const { result } = renderHook(() => useDriverDocuments());
    await waitFor(() => expect(result.current.documents).toHaveLength(1));

    let first: Promise<string> | undefined;
    let second: string | undefined;
    await act(async () => {
      first = result.current.upload('license');
      second = await result.current.upload('license');
    });
    expect(second).toBe('cancelled');
    expect(launchImageLibrary).toHaveBeenCalledTimes(1);

    await act(async () => {
      answerPicker(PHOTO);
      await first;
    });
    expect(mock.history.post).toHaveLength(1);
  });
});
