/**
 * UI-R17 Vehicle & documents (docs/design/screens/driver-vehicle-documents.md): the summary case,
 * document wording, masked licence and expiry banner, the per-vehicle glyph rule, rejected
 * reasons, the pinned standard Header, groups and pull to refresh.
 */
import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import MockAdapter from 'axios-mock-adapter';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { rootReducer } from '../../../src/store/rootReducer';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { apiClient, __resetUnauthorizedStateForTests } from '../../../src/services/api';
import { toast } from '../../../src/core/toast';
import { DriverDocumentsScreen } from '../../../src/features/driverDocuments/screens/DriverDocumentsScreen';
import { documentSubtitle, licenceExpiry, maskLicence, shortDate, summaryCase } from '../../../src/features/driverDocuments/screenModel';
import { vehicleGlyph, VehicleCard } from '../../../src/features/driver-profile/components/VehicleCard';
import { toDriverVehicles } from '../../../src/features/driver-profile/api';
import type { DriverDocument } from '../../../src/features/driverDocuments/types';
import type { DriverVehicle } from '../../../src/features/driver-profile/types';
import type { User } from '../../../src/services/api';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
  useIsFocused: () => true,
}));

const doc = (overrides: Partial<DriverDocument> = {}): DriverDocument => ({
  type: 'profile',
  required: true,
  status: 'approved',
  rejectionReason: null,
  canUpload: false,
  updatedAt: null,
  ...overrides,
});

const vehicle = (overrides: Partial<DriverVehicle> = {}): DriverVehicle => ({
  id: 1,
  make: 'Honda',
  model: 'CD 70',
  licensePlate: 'LHR-QA-2026-5610',
  status: 'approved',
  rejectionReason: null,
  vehicleType: null,
  year: null,
  color: null,
  ...overrides,
});

describe('screen model', () => {
  it('summary: action items first, then in review, then all approved; nothing for an empty list', () => {
    expect(summaryCase([doc({ status: 'rejected' }), doc({ type: 'cnic_back', status: 'missing' })], [vehicle({ status: 'rejected' })], false)).toEqual({ kind: 'action', count: 3 });
    // An optional missing item is not an action.
    expect(summaryCase([doc({ status: 'missing', required: false }), doc({ status: 'pending' })], [vehicle({ status: 'pending' })], false)).toEqual({ kind: 'review', count: 2 });
    expect(summaryCase([doc()], [vehicle()], true)).toEqual({ kind: 'approved' });
    expect(summaryCase([], [], true)).toBeNull();
  });

  it('document lines by status; "Required" is never printed', () => {
    expect(documentSubtitle(doc({ updatedAt: '2026-10-11' }))).toEqual({ text: 'Approved · 11 Oct 2026', tone: 'textSecondary' });
    expect(documentSubtitle(doc({ status: 'pending', updatedAt: '2026-10-12' })).text).toBe('Sent 12 Oct 2026 · in review');
    expect(documentSubtitle(doc({ status: 'rejected', rejectionReason: 'Blurry' }))).toEqual({ text: 'Reason: Blurry', tone: 'danger' });
    expect(documentSubtitle(doc({ status: 'rejected' })).text).toBe('Reason: No reason given.');
    expect(documentSubtitle(doc({ status: 'missing' })).text).toBe('Not uploaded yet');
    expect(documentSubtitle(doc({ status: 'missing', required: false })).text).toBe('Not uploaded yet · Optional');
  });

  it('licence: masked to the last 4, expiry warning within 30 days and once expired', () => {
    expect(maskLicence('LHR-55821-6789')).toBe('•••• 6789');
    expect(maskLicence('  ')).toBeNull();
    // Never the whole number: short values are bullets only, and at most length − 2 show.
    expect(maskLicence('1234')).toBe('\u2022\u2022\u2022\u2022');
    expect(maskLicence('AB')).toBe('\u2022\u2022\u2022\u2022');
    expect(maskLicence('12345')).toBe('\u2022\u2022\u2022\u2022 345');
    expect(maskLicence('123456')).toBe('\u2022\u2022\u2022\u2022 3456');
    const now = new Date(2026, 9, 20);
    expect(licenceExpiry('2026-11-19', now)).toBe('expiring');
    expect(licenceExpiry('2026-11-20', now)).toBeNull();
    expect(licenceExpiry('2026-10-19', now)).toBe('expired');
    expect(licenceExpiry(null, now)).toBeNull();
    expect(shortDate('2028-03-12')).toBe('12 Mar 2028');
  });

  it('BE-126 fields and the rejection reason are read when sent', () => {
    expect(
      toDriverVehicles({ vehicles: [{ id: 3, make: 'Honda', verification_status: 'rejected', rejection_reason: ' Plate unclear ', vehicle_type: 'bike', year: '2019', color: 'Red' }] }),
    ).toEqual([
      { id: 3, make: 'Honda', model: null, licensePlate: null, status: 'rejected', rejectionReason: 'Plate unclear', vehicleType: 'bike', year: 2019, color: 'Red' },
    ]);
  });
});

describe('vehicle glyph rule (§2.2)', () => {
  it('the vehicle\'s own type wins; else the account type for one vehicle; else a steering wheel', () => {
    expect(vehicleGlyph(vehicle({ vehicleType: 'bike' }), 2, 'car')).toBe('bike');
    expect(vehicleGlyph(vehicle(), 1, 'bike')).toBe('bike');
    expect(vehicleGlyph(vehicle(), 2, 'car')).toBe('steering');
  });

  it('rows: plate chip, year · colour when sent, a rejection reason and "Needs update"', async () => {
    const data = [vehicle({ id: 1, year: 2019, color: 'Red' }), vehicle({ id: 2, make: 'Suzuki', model: 'Alto', status: 'rejected', rejectionReason: 'Plate unclear' })];
    render(
      <ThemeProvider>
        <VehicleCard vehicles={{ data, status: 'ready', reload: jest.fn() }} vehicleType="car" />
      </ThemeProvider>,
    );
    await act(async () => {});
    expect(screen.getByTestId('driver-vehicle-1-plate')).toHaveTextContent('LHR-QA-2026-5610');
    expect(screen.getByText('2019 · Red')).toBeTruthy();
    expect(screen.getByTestId('driver-vehicle-1-glyph-steering')).toBeTruthy();
    expect(screen.getByTestId('driver-vehicle-2-reason')).toHaveTextContent('Reason: Plate unclear');
    expect(screen.getByTestId('driver-vehicle-2')).toHaveTextContent(/Needs update/);
    expect(screen.getByTestId('driver-vehicle-2').props.accessibilityLabel).toBe('Suzuki Alto, plate LHR-QA-2026-5610, Needs update, Reason: Plate unclear');
  });
});

describe('DriverDocumentsScreen (UI-R17)', () => {
  let mock: MockAdapter;
  const raw = (type: string, status: string, extra: Record<string, unknown> = {}) => ({
    type,
    required: true,
    status,
    rejection_reason: null,
    can_upload: status === 'rejected' || status === 'missing',
    url: 'https://signed.example/x',
    updated_at: '2026-10-11',
    ...extra,
  });
  const list = (documents: unknown[], allApproved = false) => ({
    success: true,
    data: { documents, all_required_approved: allApproved, expires_in: 600 },
  });

  beforeEach(() => {
    __resetUnauthorizedStateForTests();
    mock = new MockAdapter(apiClient);
    mock.onGet('/profile/documents').reply(200, { success: true, data: { vehicles: [{ id: 4, make: 'Honda', model: 'CD 70', license_plate: 'LHR-1', verification_status: 'approved' }] } });
  });
  afterEach(() => {
    mock.restore();
    jest.restoreAllMocks();
  });

  const renderScreen = async (user: Record<string, unknown>) => {
    const initial = rootReducer(undefined, { type: '@@init' });
    const store = configureStore({
      reducer: rootReducer,
      preloadedState: {
        ...initial,
        apiAuth: { ...initial.apiAuth, isAuthenticated: true, user: { id: 1, name: 'Bilal', role: 'driver', vehicle_type: 'bike', ...user } as User },
      },
    });
    render(
      <Provider store={store}>
        <ThemeProvider>
          <DriverDocumentsScreen />
        </ThemeProvider>
      </Provider>,
    );
    await act(async () => {});
  };

  it('pinned standard Header, the action summary, the licence group with the masked number and expiry banner, and the two photo groups', async () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 10);
    const expiry = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, '0')}-${String(soon.getDate()).padStart(2, '0')}`;
    mock.onGet('/driver/documents').reply(
      200,
      list([raw('profile', 'approved'), raw('cnic_front', 'rejected', { rejection_reason: 'Blurry' }), raw('license', 'missing'), raw('vehicle_front', 'approved')]),
    );
    await renderScreen({ license_number: 'LHR-55821-6789', license_expiry_date: expiry });
    await waitFor(() => expect(screen.getByTestId('driver-documents-summary')).toBeTruthy());
    expect(screen.getByRole('header', { name: 'Vehicle & documents' })).toBeTruthy();
    expect(screen.getByTestId('driver-documents-scroll')).not.toContainElement(screen.getByTestId('driver-documents-back'));
    expect(screen.getByTestId('driver-documents-summary-title')).toHaveTextContent('2 items need your action');
    expect(screen.getByTestId('driver-documents-licence-number')).toHaveTextContent('•••• 6789');
    expect(screen.queryByText(/LHR-55821/)).toBeNull();
    expect(screen.getByTestId('driver-documents-licence-banner')).toHaveTextContent(/Upload the renewed licence\./);
    // The licence photo lives in the licence group, not in Identity.
    expect(screen.getByTestId('driver-documents-licence')).toContainElement(screen.getByTestId('driver-document-license'));
    expect(screen.getByTestId('driver-documents-identity')).toContainElement(screen.getByTestId('driver-document-cnic_front'));
    expect(screen.getByTestId('driver-documents-photos')).toContainElement(screen.getByTestId('driver-document-vehicle_front'));
    expect(screen.getByTestId('driver-document-cnic_front-reason')).toHaveTextContent('Reason: Blurry');
    expect(screen.queryByText('Required')).toBeNull();
    // One vehicle, account type bike: the bike glyph (never a car on a bike).
    await waitFor(() => expect(screen.getByTestId('driver-documents-vehicle-4-glyph-bike')).toBeTruthy());
  });

  it('pull to refresh reads documents, vehicles and the profile once each; a failure keeps the list and says so', async () => {
    const warning = jest.spyOn(toast, 'warning').mockImplementation(() => '');
    mock.onGet('/driver/documents').replyOnce(200, list([raw('profile', 'approved')], true));
    mock.onGet('/driver/documents').replyOnce(500, {});
    mock.onGet('/profile').reply(200, { success: true, data: { user: { id: 1, role: 'driver' } } });
    await renderScreen({});
    await waitFor(() => expect(screen.getByTestId('driver-document-profile')).toBeTruthy());
    const count = (url: string) => mock.history.get.filter((request) => request.url === url).length;
    const before = { docs: count('/driver/documents'), vehicles: count('/profile/documents') };
    await act(async () => {
      screen.getByTestId('driver-documents-scroll').props.refreshControl.props.onRefresh();
    });
    expect(count('/driver/documents') - before.docs).toBe(1);
    expect(count('/profile/documents') - before.vehicles).toBe(1);
    expect(warning).toHaveBeenCalledWith("Couldn't refresh. Showing the last saved status.");
    expect(screen.getByTestId('driver-document-profile')).toBeTruthy();
  });

  it('first load is a skeleton, not a spinner', async () => {
    mock.onGet('/driver/documents').reply(() => new Promise(() => undefined));
    await renderScreen({});
    expect(screen.getByTestId('driver-documents-loading')).toBeTruthy();
  });
});
