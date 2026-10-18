/**
 * T-572 (BE-108): the driver wizard's Make list comes from GET /public/vehicle-types
 * `meta.vehicle_makes` (the same cached read as the BE-105 year/AC rules), with the static
 * VEHICLE_MAKES_BY_TYPE as the fallback when a kind is missing or the request fails.
 */
import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { apiClient } from '../../../src/services/api';
import { clearQueryCache } from '../../../src/core/api/queryCache';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import VehicleInfoStep from '../../../src/screens/Auth/steps/VehicleInfoStep';
import { toRegistrationVehicleRules, toVehicleMakes } from '../../../src/features/ac/api';
import { VEHICLE_MAKES_BY_TYPE, vehicleMakesFor } from '../../../src/features/auth/copy/registrationFields';
import { INITIAL_REGISTRATION_FORM, type RegistrationFormData } from '../../../src/features/auth/registration/registrationForm';

const driver: RegistrationFormData = { ...INITIAL_REGISTRATION_FORM, role: 'driver' };

const SERVER_MAKES = {
  car: ['Toyota', 'Honda', 'Other'],
  bike: ['Honda', 'Zongshen', 'Other'],
  rickshaw: ['Sazgar', 'Other'],
  van: ['Suzuki', 'Other'],
};

const catalogue = (meta: Record<string, unknown>, data: unknown[] = []) => ({ success: true, message: 'Vehicle types', data, meta });

let mock: MockAdapter;

beforeEach(() => {
  clearQueryCache();
  mock = new MockAdapter(apiClient);
});

afterEach(() => {
  mock.restore();
});

const vehicleTypeReads = () => mock.history.get.filter((r) => r.url === '/public/vehicle-types');

const renderStep = (data: RegistrationFormData, onDataChange = jest.fn()) =>
  render(
    <ThemeProvider>
      <VehicleInfoStep data={data} onDataChange={onDataChange} errors={{}} />
    </ThemeProvider>,
  );

const openMakeSheet = async () => {
  fireEvent.press(screen.getByTestId('registration-vehicle-make-field'));
  await act(async () => {});
};

describe('T-572: mapping meta.vehicle_makes and data[].makes', () => {
  it('reads meta.vehicle_makes per kind', () => {
    expect(toVehicleMakes(catalogue({ vehicle_makes: SERVER_MAKES }))).toEqual(SERVER_MAKES);
    expect(toRegistrationVehicleRules(catalogue({ vehicle_makes: SERVER_MAKES })).vehicleMakes).toEqual(SERVER_MAKES);
  });

  it('falls back to data[].makes for a kind meta does not list; ignores empty lists and bad entries', () => {
    const body = catalogue({ vehicle_makes: { car: ['Toyota', ' ', 7, 'toyota', 'Other'], bike: [] } }, [
      { key: 'bike', label: 'Bike', makes: ['Honda', 'Other'] },
      { key: 'car_ac', label: 'Car AC', makes: [] },
      { key: 'car', label: 'Car', makes: ['Ignored'] },
    ]);
    expect(toVehicleMakes(body)).toEqual({ car: ['Toyota', 'Other'], bike: ['Honda', 'Other'] });
  });

  it('is null on an older server (no makes anywhere)', () => {
    expect(toVehicleMakes(catalogue({ fare_notice: null }, [{ key: 'car', label: 'Car' }]))).toBeNull();
    expect(toVehicleMakes(null)).toBeNull();
  });

  it('vehicleMakesFor prefers a server list and falls back per kind to the static list', () => {
    const server = { bike: ['Honda', 'Zongshen', 'Other'] };
    expect(vehicleMakesFor('bike', server)).toEqual(['Honda', 'Zongshen', 'Other']);
    expect(vehicleMakesFor('car', server)).toBe(VEHICLE_MAKES_BY_TYPE.car);
    expect(vehicleMakesFor('bike', { bike: [] })).toBe(VEHICLE_MAKES_BY_TYPE.bike);
    expect(vehicleMakesFor('bike', null)).toBe(VEHICLE_MAKES_BY_TYPE.bike);
    expect(vehicleMakesFor('', server)).toEqual([]);
    expect(vehicleMakesFor('constructor', server)).toEqual([]);
  });
});

describe('T-572: the vehicle step uses the server Make list', () => {
  it('shows the server list for the chosen type, from the one shared vehicle-types read', async () => {
    mock.onGet('/public/vehicle-types').reply(200, catalogue({ vehicle_makes: SERVER_MAKES }));
    renderStep({ ...driver, vehicleType: 'bike' });
    await waitFor(() => expect(vehicleTypeReads()).toHaveLength(1));
    await act(async () => {});
    await openMakeSheet();
    expect(screen.getByText('Zongshen')).toBeTruthy();
    // Static bike makes the server list dropped are gone.
    expect(screen.queryByText('Yamaha')).toBeNull();
    expect(vehicleTypeReads()).toHaveLength(1);
  });

  it('falls back to the static list when the request fails', async () => {
    mock.onGet('/public/vehicle-types').reply(500, { success: false, message: 'Server error' });
    renderStep({ ...driver, vehicleType: 'bike' });
    await waitFor(() => expect(vehicleTypeReads()).toHaveLength(1));
    await act(async () => {});
    await openMakeSheet();
    expect(screen.getByText('Yamaha')).toBeTruthy();
    expect(screen.queryByText('Zongshen')).toBeNull();
  });

  it('falls back to the static list when the server has no list for the type (older server)', async () => {
    mock.onGet('/public/vehicle-types').reply(200, catalogue({ vehicle_makes: { car: SERVER_MAKES.car } }));
    renderStep({ ...driver, vehicleType: 'bike' });
    await waitFor(() => expect(vehicleTypeReads()).toHaveLength(1));
    await act(async () => {});
    await openMakeSheet();
    expect(screen.getByText('Yamaha')).toBeTruthy();
  });

  it('keeps Make disabled before a type is chosen, even with a server list', async () => {
    mock.onGet('/public/vehicle-types').reply(200, catalogue({ vehicle_makes: SERVER_MAKES }));
    renderStep(driver);
    await waitFor(() => expect(vehicleTypeReads()).toHaveLength(1));
    await act(async () => {});
    expect(screen.getByText('Choose the vehicle type first.')).toBeTruthy();
    expect(screen.getByTestId('registration-vehicle-make-field').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('switching type clears a make the server list for the new type does not have; keeps a shared one', async () => {
    mock.onGet('/public/vehicle-types').reply(200, catalogue({ vehicle_makes: SERVER_MAKES }));
    const onDataChange = jest.fn();
    // Honda is in the server's car and bike lists, not in its rickshaw list.
    renderStep({ ...driver, vehicleType: 'car', vehicleBrand: 'Honda' }, onDataChange);
    await waitFor(() => expect(vehicleTypeReads()).toHaveLength(1));
    await act(async () => {});
    fireEvent.press(screen.getByTestId('registration-vehicle-type-bike'));
    expect(onDataChange).toHaveBeenCalledWith({ vehicleType: 'bike' });
    expect(onDataChange).not.toHaveBeenCalledWith({ vehicleBrand: '' });

    onDataChange.mockClear();
    fireEvent.press(screen.getByTestId('registration-vehicle-type-rickshaw'));
    expect(onDataChange).toHaveBeenCalledWith({ vehicleType: 'rickshaw' });
    expect(onDataChange).toHaveBeenCalledWith({ vehicleBrand: '' });
  });

  it('clears a make that only the static list had once the server list is in use', async () => {
    mock.onGet('/public/vehicle-types').reply(200, catalogue({ vehicle_makes: SERVER_MAKES }));
    const onDataChange = jest.fn();
    // Yamaha is a static bike make, but the server bike list does not have it.
    renderStep({ ...driver, vehicleType: 'car', vehicleBrand: 'Yamaha' }, onDataChange);
    await waitFor(() => expect(vehicleTypeReads()).toHaveLength(1));
    await act(async () => {});
    fireEvent.press(screen.getByTestId('registration-vehicle-type-bike'));
    expect(onDataChange).toHaveBeenCalledWith({ vehicleBrand: '' });
  });
});
