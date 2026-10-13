/**
 * T-507 / T-514: the driver's vehicle from GET /profile/documents (only the labels are kept,
 * never the signed document links) and the profile stat values from GET /me/stats.
 */
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../../../src/services/api';
import { driverProfileApi, toDriverVehicles } from '../../../src/features/driver-profile/api';
import {
  toDriverProfileStats,
  vehiclePlate,
  vehicleStatusBadge,
  vehicleTitle,
} from '../../../src/features/driver-profile/format';
import { toMyStats } from '../../../src/features/stats/api';
import type { DriverStats } from '../../../src/features/stats/types';

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(apiClient);
});
afterEach(() => mock.restore());

describe('toDriverVehicles', () => {
  it('keeps id, make, model, plate and a known status; drops malformed rows and every document link', () => {
    const vehicles = toDriverVehicles({
      cnic_front_image: 'https://signed.example/cnic',
      vehicles: [
        {
          id: 4,
          make: ' Mitsubishi ',
          model: 'Outlander',
          license_plate: 'Z-0001-19',
          verification_status: 'approved',
          front_image: 'https://signed.example/front',
        },
        { id: '5', make: '', model: null, license_plate: '  ', verification_status: 'odd' },
        { make: 'No id' },
        'junk',
      ],
    });
    expect(vehicles).toEqual([
      { id: 4, make: 'Mitsubishi', model: 'Outlander', licensePlate: 'Z-0001-19', status: 'approved' },
      { id: 5, make: null, model: null, licensePlate: null, status: null },
    ]);
    expect(JSON.stringify(vehicles)).not.toContain('signed.example');
    expect(toDriverVehicles(null)).toEqual([]);
    expect(toDriverVehicles({ vehicles: 'x' })).toEqual([]);
  });

  it('reads GET /profile/documents', async () => {
    mock.onGet('/profile/documents').reply(200, { success: true, data: { vehicles: [{ id: 1, make: 'Honda' }] } });
    await expect(driverProfileApi.getVehicles()).resolves.toEqual([
      { id: 1, make: 'Honda', model: null, licensePlate: null, status: null },
    ]);
  });
});

describe('vehicle labels', () => {
  it('make + model, the plate, and the review badge', () => {
    const vehicle = { id: 1, make: 'Toyota', model: 'Yaris', licensePlate: 'LEA-1234', status: 'pending' as const };
    expect(vehicleTitle(vehicle)).toBe('Toyota Yaris');
    expect(vehiclePlate(vehicle)).toBe('Plate LEA-1234');
    expect(vehicleStatusBadge(vehicle)).toEqual({ label: 'In review', tone: 'warning' });
    const bare = { id: 2, make: null, model: null, licensePlate: null, status: null };
    expect(vehicleTitle(bare)).toBe('Your vehicle');
    expect(vehiclePlate(bare)).toBe('No plate on file');
    expect(vehicleStatusBadge(bare)).toBeNull();
  });
});

describe('toDriverProfileStats', () => {
  it('dashes until loaded; "New" before the first rating; one decimal after; money in PKR', () => {
    expect(toDriverProfileStats(null)).toEqual({ rating: null, rides: null, earnings: null });
    const fresh = toMyStats({ role: 'driver', currency: 'PKR', total_rides: 0, total_earnings: 0, rating: null }) as DriverStats;
    expect(toDriverProfileStats(fresh)).toEqual({ rating: 'New', rides: '0', earnings: 'Rs 0' });
    const rated = toMyStats({ role: 'driver', total_rides: 156, total_earnings: 24000, rating: 4.86 }) as DriverStats;
    expect(toDriverProfileStats(rated)).toEqual({ rating: '4.9', rides: '156', earnings: 'Rs 24,000' });
  });
});
