/**
 * T-574 (QA 2026-10-18): parcel copy where the ride copy said ride / driver / trip, Done after a
 * parcel goes Home, and the Request button shows its loading state on the tap.
 */
import React from 'react';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import { CancelReasonSheet } from '../../../src/components/driver/CancelReasonSheet';
import { DriverRideSummary } from '../../../src/components/driver/DriverRideSummary';
import ActiveRidePanel from '../../../src/features/active-ride/components/ActiveRidePanel';
import { advanceRideStage, type PassengerRideStageState } from '../../../src/features/active-ride/stage';
import { leaveFinishedRide } from '../../../src/features/active-ride/done';
import { OverchargeReportSection } from '../../../src/features/fare/components/OverchargeReport';
import { isParcelDetails, PersonCard } from '../../../src/features/ride-history/components/RideDetailsSections';
import { toRide } from '../../../src/features/ride-history/api';
import { useConfirmRequest } from '../../../src/features/ride-booking/useConfirmRequest';
import { ChooseRideFooter } from '../../../src/features/ride-booking/components/BookingStages';
import { toVehicleOptions } from '../../../src/features/ride-booking/vehicleOptions';
import type { FareEstimates, VehicleType } from '../../../src/features/ride-booking/api';
import { setLocale } from '../../../src/i18n';
import '../../../src/i18n/copy-ur-Latn';
import type { RideResource } from '../../../src/services/rideService';
import { makeRide } from '../../../test-utils/rideFixtures';

const noop = () => undefined;

const stateOf = (ride: RideResource): PassengerRideStageState => {
  const state = advanceRideStage(null, ride);
  if (!state) throw new Error('no stage');
  return state;
};

const parcelRide = (overrides: Partial<RideResource> = {}) => makeRide({ vehicle_type: 'parcel', is_parcel: true, ...overrides });

afterEach(() => setLocale('en'));

describe('driver: parcel wording (T-574)', () => {
  it('the no-show / cancel sheet keeps a delivery, not a ride', () => {
    const { rerender } = render(<CancelReasonSheet visible parcel mode="no_show" submitting={false} onSubmit={noop} onClose={noop} />);
    expect(screen.getByText('Keep delivery')).toBeTruthy();
    expect(screen.queryByText('Keep ride')).toBeNull();
    rerender(<CancelReasonSheet visible submitting={false} onSubmit={noop} onClose={noop} />);
    expect(screen.getByText('Keep ride')).toBeTruthy();
  });

  it('the end card says the delivery is complete (or the parcel returned), a ride says "Trip complete"', () => {
    const { rerender } = render(<DriverRideSummary ride={parcelRide({ status: 'completed' })} onDone={noop} />);
    expect(screen.getByText('Delivery complete')).toBeTruthy();
    expect(screen.queryByText('Trip complete')).toBeNull();
    rerender(
      <DriverRideSummary
        ride={parcelRide({ status: 'completed', parcel: { status: 'returned' } } as Partial<RideResource>)}
        onDone={noop}
      />,
    );
    expect(screen.getByText('Parcel returned')).toBeTruthy();
    rerender(<DriverRideSummary ride={makeRide({ status: 'completed' })} onDone={noop} />);
    expect(screen.getByText('Trip complete')).toBeTruthy();
  });
});

describe('sender: parcel wording (T-574)', () => {
  it('delivered: thanks for sending, not for riding', () => {
    const ride = parcelRide({ status: 'completed' });
    render(<ActiveRidePanel stageState={stateOf(ride)} ride={ride} onCancel={noop} onDone={noop} />);
    expect(screen.getByTestId('active-ride-subtitle').props.children).toBe('Thanks for sending with Raah-e-Haq.');
  });

  it('cancelled by the driver: "Your rider cancelled this delivery."; a ride keeps the driver wording', () => {
    const ride = parcelRide({ status: 'cancelled', cancellation_reason: 'driver' });
    const { rerender } = render(<ActiveRidePanel stageState={stateOf(ride)} ride={ride} onCancel={noop} onDone={noop} />);
    expect(screen.getByTestId('active-ride-subtitle').props.children).toBe('Your rider cancelled this delivery.');
    const car = makeRide({ status: 'cancelled', cancellation_reason: 'driver' });
    rerender(<ActiveRidePanel stageState={stateOf(car)} ride={car} onCancel={noop} onDone={noop} />);
    expect(screen.getByTestId('active-ride-subtitle').props.children).toBe('Your driver cancelled this ride.');
  });

  it('the overcharge button asks about the rider on a parcel', () => {
    const state = { canReport: true, report: null };
    const { rerender } = render(<OverchargeReportSection rideId={7} state={state} fare={300} parcel />);
    expect(screen.getByText('Rider asked for more?')).toBeTruthy();
    rerender(<OverchargeReportSection rideId={7} state={state} fare={300} />);
    expect(screen.getByText('Driver asked for more?')).toBeTruthy();
  });

  it('ride details: "Your rider" for the sender, "Your sender" for the driver, on a parcel only', () => {
    const raw = {
      id: 41,
      status: 'completed',
      vehicle_type: 'parcel',
      is_parcel: true,
      parcel: { status: 'delivered' },
      passenger_id: 7,
      driver_id: 9,
      passenger: { id: 7, name: 'Ayesha', first_name: 'Ayesha' },
      driver: { id: 9, name: 'Bilal Ahmed' },
    };
    const parcel = toRide(raw);
    const car = toRide({ ...raw, vehicle_type: 'car', is_parcel: false, parcel: null });
    if (!parcel || !car) throw new Error('no ride');
    expect(isParcelDetails(parcel)).toBe(true);
    expect(isParcelDetails(car)).toBe(false);

    const { rerender } = render(<PersonCard ride={parcel} viewer="passenger" canMessage={false} onMessage={noop} />);
    expect(screen.getByText('Your rider')).toBeTruthy();
    rerender(<PersonCard ride={parcel} viewer="driver" canMessage={false} onMessage={noop} />);
    expect(screen.getByText('Your sender')).toBeTruthy();
    rerender(<PersonCard ride={car} viewer="passenger" canMessage={false} onMessage={noop} />);
    expect(screen.getByText('Your driver')).toBeTruthy();
  });

  it('the new lines read in Roman Urdu', () => {
    setLocale('ur-Latn');
    const ride = parcelRide({ status: 'cancelled', cancellation_reason: 'driver' });
    render(<ActiveRidePanel stageState={stateOf(ride)} ride={ride} onCancel={noop} onDone={noop} />);
    expect(screen.getByTestId('active-ride-subtitle').props.children).toBe('Aap ke rider ne ye delivery cancel ki.');
  });
});

describe('Done after a parcel (T-574) or a ride (T-582)', () => {
  it('goes back to Home, never the trip planner', () => {
    const popTo = jest.fn();
    leaveFinishedRide({ popTo });
    expect(popTo).toHaveBeenCalledTimes(1);
    expect(popTo).toHaveBeenCalledWith('PassengerTabs', { screen: 'Home' });
  });
});

describe('Request button (T-574)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('shows the loading state first; the request starts a couple of frames later, once', () => {
    const start = jest.fn();
    const { result } = renderHook(() => useConfirmRequest(start));
    act(() => {
      result.current.confirm();
      result.current.confirm();
    });
    expect(result.current.confirming).toBe(true);
    expect(start).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(start).toHaveBeenCalledTimes(1);
    expect(result.current.confirming).toBe(false);
  });

  it('an unmount before the frames sends nothing', () => {
    const start = jest.fn();
    const { result, unmount } = renderHook(() => useConfirmRequest(start));
    act(() => result.current.confirm());
    unmount();
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(start).not.toHaveBeenCalled();
  });

  it('UI-R10 footer: while confirming the Request button is busy and ignores taps', () => {
    const onConfirm = jest.fn();
    const data: FareEstimates = {
      distance_km: 5,
      duration_min: 12,
      fare_notice: null,
      estimates: [
        {
          vehicle_type: 'car',
          fare: 300,
          currency: 'PKR',
          breakdown: { base: 100, distance: 150, time: 50, stops: 0, min_fare_adjustment: 0, booking_fee: 0 },
          offer_band: null,
          fare_policy: null,
        },
      ],
    };
    const estimates = { status: 'ready' as const, data, error: null, retry: noop };
    const vehicleType: VehicleType = { key: 'car', label: 'Car', capacity: 4 };
    const options = toVehicleOptions([vehicleType], data);
    const footer = (confirming: boolean) => (
      <ChooseRideFooter options={options} estimates={estimates} selectedVehicle="car" onConfirm={onConfirm} confirming={confirming} />
    );
    const { rerender } = render(footer(false));
    const button = screen.getByTestId('fare-request');
    expect(button.props.accessibilityState).toMatchObject({ busy: false });
    rerender(footer(true));
    expect(screen.getByTestId('fare-request').props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    fireEvent.press(screen.getByTestId('fare-request'));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
