/**
 * T-410: opening the driver Map tab during a ride froze the driver's GPS. The screen asked the
 * device for a one-shot position (useNativeLocation -> Geolocation.getCurrentPosition), which
 * on iOS ends the tracker's running watch. The map now reads the tracker's shared watcher and
 * never touches the native location API itself. UI-R4: the map is the Drive tab.
 */
import React from 'react';
import { AppState } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import Geolocation from '@react-native-community/geolocation';
import { rootReducer } from '../../src/store/rootReducer';
import { driverLocationApi } from '../../src/features/driver-location/api';
import { driverStatusApi } from '../../src/features/driver-status/api';
import { loadDriverStatus } from '../../src/features/driver-status/slice';
import locationTrackingService from '../../src/services/locationTrackingService';
import { statsApi } from '../../src/features/stats/api';
import DriverDriveScreen from '../../src/screens/Driver/DriverDriveScreen';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn() }),
  useIsFocused: () => true,
}));

const geo = Geolocation as jest.Mocked<typeof Geolocation>;
type PositionCallback = (position: { coords: Record<string, number>; timestamp: number }) => void;

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) {
      await Promise.resolve();
    }
  });
};

beforeEach(() => {
  geo.watchPosition.mockReset();
  geo.watchPosition.mockImplementation(() => 1);
  geo.clearWatch.mockClear();
  geo.stopObserving.mockClear();
  geo.getCurrentPosition.mockClear();
  jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
  jest.spyOn(driverLocationApi, 'post').mockResolvedValue(undefined);
  jest.spyOn(statsApi, 'getMyStats').mockRejectedValue(new Error('not in this test'));
  jest
    .spyOn(driverStatusApi, 'get')
    .mockResolvedValue({ status: 'available', activeRideId: null, changedAt: null });
});

afterEach(() => {
  locationTrackingService.reset();
  jest.restoreAllMocks();
});

it('mounting, using and leaving the Drive map while tracking leaves the tracker watch running', async () => {
  const store = configureStore({ reducer: rootReducer });
  await store.dispatch(loadDriverStatus());
  await locationTrackingService.startTracking();
  expect(geo.watchPosition).toHaveBeenCalledTimes(1);

  const screen = render(
    <Provider store={store}>
      <DriverDriveScreen />
    </Provider>,
  );
  await flush();

  // The tracker's fix reaches the screen through the shared watcher.
  const onPosition = geo.watchPosition.mock.calls[0][0] as unknown as PositionCallback;
  await act(async () => {
    onPosition({ coords: { latitude: 31.52, longitude: 74.35 }, timestamp: Date.now() });
  });
  expect(screen.getByTestId('drive-driver-marker')).toBeTruthy();

  fireEvent.press(screen.getByTestId('drive-controls-locate'));
  screen.unmount();
  await flush();

  expect(geo.getCurrentPosition).not.toHaveBeenCalled();
  expect(geo.stopObserving).not.toHaveBeenCalled();
  expect(geo.clearWatch).not.toHaveBeenCalled();
  expect(geo.watchPosition).toHaveBeenCalledTimes(1);
  expect(locationTrackingService.getTrackingStatus()).toBe(true);
});

it('while offline the Drive map holds the shared watcher and releases it on unmount', async () => {
  const store = configureStore({ reducer: rootReducer });
  const screen = render(
    <Provider store={store}>
      <DriverDriveScreen />
    </Provider>,
  );
  await flush();
  expect(geo.watchPosition).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('drive-driver-marker')).toBeNull();

  screen.unmount();
  expect(geo.clearWatch).toHaveBeenCalledTimes(1);
  expect(geo.getCurrentPosition).not.toHaveBeenCalled();
});
