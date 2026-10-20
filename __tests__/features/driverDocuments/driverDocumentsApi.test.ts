/**
 * T-203 (BE-66): GET/POST /driver/documents mapping, the client-side image rule and the
 * message of each refused upload.
 */
import MockAdapter from 'axios-mock-adapter';
import { ApiError } from '../../../src/core/api/errors';
import { apiClient, __resetUnauthorizedStateForTests } from '../../../src/services/api';
import { driverDocumentsApi, toDriverDocuments } from '../../../src/features/driverDocuments/api';
import { DRIVER_DOCUMENTS_COPY } from '../../../src/features/driverDocuments/copy';
import { uploadErrorMessage } from '../../../src/features/driverDocuments/hooks';
import { DOCUMENT_PICKER_OPTIONS, MAX_UPLOAD_BYTES, uploadProblem } from '../../../src/features/driverDocuments/upload';

const raw = (type: string, status: string, extra: Record<string, unknown> = {}) => ({
  id: 1,
  type,
  required: true,
  status,
  rejection_reason: null,
  can_upload: false,
  url: `https://signed.example.test/${type}?sig=secret`,
  updated_at: '2026-10-11T10:00:00Z',
  ...extra,
});

describe('toDriverDocuments', () => {
  it('maps every item in the server order and never keeps the signed url', () => {
    const state = toDriverDocuments({
      documents: [
        raw('profile', 'approved'),
        raw('cnic_front', 'rejected', { rejection_reason: '  Blurry  ', can_upload: true }),
        raw('vehicle_left', 'missing', { id: null, required: false, can_upload: true, url: null }),
      ],
      required_types: ['profile', 'cnic_front'],
      all_required_approved: false,
      expires_in: 600,
    });
    expect(state).toEqual({
      allRequiredApproved: false,
      documents: [
        { type: 'profile', required: true, status: 'approved', rejectionReason: null, canUpload: false, updatedAt: '2026-10-11T10:00:00Z' },
        { type: 'cnic_front', required: true, status: 'rejected', rejectionReason: 'Blurry', canUpload: true, updatedAt: '2026-10-11T10:00:00Z' },
        { type: 'vehicle_left', required: false, status: 'missing', rejectionReason: null, canUpload: true, updatedAt: '2026-10-11T10:00:00Z' },
      ],
    });
    expect(JSON.stringify(state)).not.toContain('signed.example.test');
  });

  it('drops unknown types, reads an unknown status as in review, and a reason only when rejected', () => {
    const state = toDriverDocuments({
      documents: [raw('police_certificate', 'pending'), raw('license', 'weird', { rejection_reason: 'x' }), 'junk'],
      all_required_approved: true,
    });
    expect(state.documents).toEqual([
      { type: 'license', required: true, status: 'pending', rejectionReason: null, canUpload: false, updatedAt: '2026-10-11T10:00:00Z' },
    ]);
    expect(state.allRequiredApproved).toBe(true);
  });

  it('a malformed payload is an empty list', () => {
    expect(toDriverDocuments(null)).toEqual({ documents: [], allRequiredApproved: false });
    expect(toDriverDocuments({ documents: 'nope' })).toEqual({ documents: [], allRequiredApproved: false });
  });
});

describe('driverDocumentsApi', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    __resetUnauthorizedStateForTests();
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => {
    mock.restore();
    jest.restoreAllMocks();
  });

  it('GET /driver/documents', async () => {
    mock.onGet('/driver/documents').replyOnce(200, { success: true, data: { documents: [raw('license', 'pending')] } });
    const state = await driverDocumentsApi.list();
    expect(state.documents.map((d) => d.type)).toEqual(['license']);
  });

  it('POST /driver/documents/{type} sends the file as the `document` part and returns the new list', async () => {
    const append = jest.spyOn(FormData.prototype, 'append');
    mock.onPost('/driver/documents/cnic_back').replyOnce(200, {
      success: true,
      data: { documents: [raw('cnic_back', 'pending')], all_required_approved: false },
    });
    const file = { uri: 'file:///tmp/back.png', name: 'back.png', type: 'image/png' };
    const state = await driverDocumentsApi.upload('cnic_back', file);
    expect(append.mock.calls).toEqual([['document', file]]);
    expect(state.documents[0].status).toBe('pending');
  });
});

describe('uploadProblem (server rule: jpeg/png/jpg/gif, at most 5 MB)', () => {
  it('accepts JPEG, PNG and GIF up to 5 MB only', () => {
    expect(uploadProblem({ type: 'image/jpeg', fileSize: 1000 })).toBeNull();
    expect(uploadProblem({ type: 'image/png' })).toBeNull();
    expect(uploadProblem({ type: 'image/gif', fileSize: MAX_UPLOAD_BYTES })).toBeNull();
    expect(uploadProblem({ type: 'image/heic', fileSize: 1000 })).toBe(DRIVER_DOCUMENTS_COPY.wrongType);
    expect(uploadProblem({ type: 'image/jpeg', fileSize: MAX_UPLOAD_BYTES + 1 })).toBe(DRIVER_DOCUMENTS_COPY.tooLarge);
    expect(uploadProblem({})).toBe(DRIVER_DOCUMENTS_COPY.wrongType);
  });
});

describe('DOCUMENT_PICKER_OPTIONS (T-537, PERF-22)', () => {
  it('scales document photos to 1600 px at quality 0.7', () => {
    expect(DOCUMENT_PICKER_OPTIONS).toMatchObject({ maxWidth: 1600, maxHeight: 1600, quality: 0.7 });
  });
});

describe('uploadErrorMessage', () => {
  it('422 shows the document rule, else the server message', () => {
    const withField = new ApiError({
      kind: 'validation',
      status: 422,
      message: 'The given data was invalid.',
      fieldErrors: { document: ['The document must be an image.'] },
    });
    expect(uploadErrorMessage(withField)).toBe('The document must be an image.');
    expect(uploadErrorMessage(new ApiError({ kind: 'validation', status: 422, message: 'Bad file.' }))).toBe('Bad file.');
  });

  it('NO_VEHICLE, 429 and server errors use our copy; offline uses the network message', () => {
    expect(uploadErrorMessage(new ApiError({ kind: 'conflict', status: 409, code: 'NO_VEHICLE', message: 'x' }))).toBe(
      DRIVER_DOCUMENTS_COPY.noVehicle,
    );
    expect(uploadErrorMessage(new ApiError({ kind: 'rate_limited', status: 429, message: 'x' }))).toBe(
      DRIVER_DOCUMENTS_COPY.rateLimited,
    );
    expect(uploadErrorMessage(new ApiError({ kind: 'server', status: 500, message: 'SQL…' }))).toBe(
      DRIVER_DOCUMENTS_COPY.uploadFailed,
    );
    expect(uploadErrorMessage(new ApiError({ kind: 'network', message: 'Network error.' }))).toBe('Network error.');
  });
});
