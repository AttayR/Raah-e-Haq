/**
 * T-565: follow-ups to the T-562 modal queue.
 * - A new confirm() during the dialog's iOS fade-out waits for `onDismiss` (no re-present while
 *   UIKit is still dismissing).
 * - NotificationManager keeps the last legacy modal rendered (hidden), so it holds its turn
 *   through the iOS dismiss like DialogHost; ModernModal's entrance runs on its turn.
 * - useDriverParcel hands the memoised closed sheets the same props when another sheet opens.
 * - Modal sheets that used to unmount with their section (rating, women mode, safety report) now
 *   close through `visible` and slide out.
 * - useVehicleTypes: a failed manual retry keeps what a concurrent quiet re-read loaded.
 */
import React from 'react';
import { Animated, Modal, Text, useColorScheme } from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import MockAdapter from 'axios-mock-adapter';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { BottomSheet } from '../../../src/components/ui';
import { DialogHost } from '../../../src/components/ui/Dialog';
import { modalQueue } from '../../../src/components/ui/modalQueue';
import ModernModal from '../../../src/components/ModernModal';
import NotificationManager, { hideModal, showErrorModal } from '../../../src/components/NotificationManager';
import { confirm, dialog } from '../../../src/core/dialog';
import { toast } from '../../../src/core/toast';
import { apiClient } from '../../../src/services/api';
import { clearQueryCache } from '../../../src/core/api/queryCache';
import { rootReducer } from '../../../src/store/rootReducer';
import { rideStep } from '../../../src/features/driver-ride/steps';
import { useDriverParcel } from '../../../src/features/parcel/useDriverParcel';
import { useVehicleTypes } from '../../../src/features/ride-booking/hooks';
import { RideRatingSection } from '../../../src/features/rating/components/RideRatingSection';
import { WomenModeSearching } from '../../../src/features/women-mode/components/WomenModeSearching';
import { SafetyReportSection } from '../../../src/features/women-mode/components/SafetyReportSection';
import type { RideResource } from '../../../src/services/rideService';
import { envelope, makeRide } from '../../../test-utils/rideFixtures';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));
(useColorScheme as jest.MockedFunction<typeof useColorScheme>).mockReturnValue('light');

type Finish = (finished?: boolean) => void;
/** Springs that run until the test finishes them; a new spring cancels the running one. */
const holdSprings = () => {
  let running: Finish | null = null;
  jest.spyOn(Reanimated, 'withSpring').mockImplementation(((toValue: number, _config: unknown, callback?: Finish) => {
    const previous = running;
    running = callback ?? null;
    previous?.(false);
    return toValue;
  }) as unknown as typeof Reanimated.withSpring);
  return {
    finish: () => {
      const done = running;
      running = null;
      act(() => done?.(true));
    },
  };
};

const Blocker = ({ up }: { up: boolean }) => (
  <BottomSheet mode="modal" visible={up} testID="blocker">
    <Text>Blocker body</Text>
  </BottomSheet>
);

const modals = () => screen.UNSAFE_getAllByType(Modal);

let mock: MockAdapter;
beforeEach(() => {
  modalQueue.reset();
  clearQueryCache();
  mock = new MockAdapter(apiClient);
  jest.spyOn(toast, 'success').mockImplementation(() => '');
  jest.spyOn(toast, 'error').mockImplementation(() => '');
});
afterEach(() => {
  act(() => dialog.dismissAll());
  act(() => hideModal());
  mock.restore();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('T-565 a confirm() during the dialog fade-out', () => {
  it('waits for onDismiss before the dialog presents again', async () => {
    render(
      <ThemeProvider>
        <DialogHost />
      </ThemeProvider>,
    );
    await act(async () => {});
    act(() => {
      confirm({ title: 'Go offline?', confirmLabel: 'Go offline' });
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('dialog-confirm'));
    });
    // Answered: the Modal is fading out (hidden, still mounted).
    expect(modals().map((m) => m.props.visible)).toEqual([false]);

    // A new question before iOS reports the dismiss: it must not re-present yet.
    act(() => {
      confirm({ title: 'End the trip?', confirmLabel: 'End trip' });
    });
    await act(async () => {});
    expect(modals().map((m) => m.props.visible)).toEqual([false]);

    act(() => modals()[0].props.onDismiss());
    await act(async () => {});
    expect(modals().map((m) => m.props.visible)).toEqual([true]);
    expect(screen.getByText('End the trip?')).toBeTruthy();
  });
});

describe('T-565 NotificationManager legacy modal', () => {
  const Host = ({ sheetUp }: { sheetUp: boolean }) => (
    <ThemeProvider>
      <NotificationManager>
        <Blocker up={sheetUp} />
      </NotificationManager>
    </ThemeProvider>
  );

  it('stays rendered (hidden) after hideModal and keeps its turn until iOS dismissed it', async () => {
    const view = render(<Host sheetUp={false} />);
    await act(async () => {});
    act(() => showErrorModal('Could not book'));
    await act(async () => {});
    expect(screen.getByText('Could not book')).toBeTruthy();

    act(() => hideModal());
    view.rerender(<Host sheetUp />);
    await act(async () => {});
    // Before T-565 the ModernModal unmounted here and the sheet presented at once.
    const hidden = modals().filter((m) => m.props.visible === false);
    expect(hidden).toHaveLength(1);
    expect(screen.queryByText('Blocker body')).toBeNull();

    act(() => hidden[0].props.onDismiss());
    await act(async () => {});
    expect(screen.getByText('Blocker body')).toBeTruthy();
  });

  it('ModernModal starts its entrance when it gets its turn, not when it is asked for', async () => {
    const springs = holdSprings();
    const spring = jest.spyOn(Animated, 'spring');
    const config = { visible: true, type: 'error' as const, title: 'Could not book' };
    const Both = ({ sheetUp }: { sheetUp: boolean }) => (
      <ThemeProvider>
        <Blocker up={sheetUp} />
        <ModernModal config={config} onClose={() => undefined} />
      </ThemeProvider>
    );
    const view = render(<Both sheetUp />);
    await act(async () => {});
    expect(spring).not.toHaveBeenCalled();

    view.rerender(<Both sheetUp={false} />);
    await act(async () => {});
    springs.finish();
    await act(async () => {});
    expect(screen.getByText('Could not book')).toBeTruthy();
    expect(spring).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 1 }));
  });
});

describe('T-565 useDriverParcel sheet props', () => {
  const parcelBlock = {
    status: 'arrived',
    item_category: 'documents',
    item_category_label: 'Documents and papers',
    size_class: 'small',
    size_label: 'Small (fits in a bag)',
    max_weight_kg: 2,
    item_description: null,
    declared_value: 2500,
    receiver: { name: 'Sana Khan', phone: null, phone_masked: '+92300*****67' },
    pickup_photo_url: null,
    code: {
      digits: 6,
      purpose: null,
      sent: false,
      send_count: 0,
      sends_left: 3,
      sms_failed: false,
      can_resend: false,
      resend_available_at: null,
      attempts_left: 5,
      locked_until: null,
      blocked: false,
      delivery_blocked: false,
    },
    can_call_receiver: false,
  };
  const ride: RideResource = makeRide({
    vehicle_type: 'parcel',
    is_parcel: true,
    status: 'arrived',
    driver_id: 5,
    parcel: parcelBlock,
    fare: '180.00',
  } as Partial<RideResource>);

  it('opening the pickup sheet hands the closed code and reason sheets the same props', () => {
    const initial = rootReducer(undefined, { type: '@@fixtures/init' });
    const store = configureStore({
      reducer: rootReducer,
      preloadedState: { ...initial, driverRide: { ride, pendingAction: null, pendingRequestId: null } },
    });
    const onMessage = jest.fn();
    const { result } = renderHook(() => useDriverParcel({ ride, step: rideStep(ride), pendingAction: null, onMessage }), {
      wrapper: ({ children }: { children: React.ReactNode }) => <Provider store={store}>{children}</Provider>,
    });
    const before = result.current.sheets;
    act(() => result.current.panel?.primary?.onPress());
    const after = result.current.sheets;
    expect(after.pickup.visible).toBe(true);
    const changed = (a: Record<string, unknown>, b: Record<string, unknown>) =>
      Object.keys(a).filter((key) => !Object.is(a[key], b[key]));
    // Before T-565 the code and reason sheets got new onSubmit callbacks (they hung on `sheet`).
    expect(changed(before.code, after.code)).toEqual([]);
    expect(changed(before.reason, after.reason)).toEqual([]);
  });
});

describe('T-565 modal sheets close through visible instead of unmounting', () => {
  it('the ride details rating sheet slides out when the rating lands', async () => {
    const springs = holdSprings();
    const Section = ({ rated }: { rated: boolean }) => (
      <ThemeProvider>
        <RideRatingSection
          rideId={12}
          role="passenger"
          myRating={rated ? { stars: 5, tags: [], comment: null, createdAt: null } : null}
          canRate={!rated}
          personName="Bilal"
          onChange={() => undefined}
        />
      </ThemeProvider>
    );
    mock.onGet('/rating-tags').reply(200, envelope({ tags: {} }));
    const view = render(<Section rated={false} />);
    await act(async () => {});
    fireEvent.press(screen.getByTestId('ride-details-rate-button'));
    await act(async () => {});
    springs.finish();
    expect(modals().length).toBe(1);

    view.rerender(<Section rated />);
    await act(async () => {});
    expect(screen.getByTestId('ride-details-rating')).toBeTruthy();
    // Still sliding out (its Modal mounted) until the close animation ends.
    expect(modals().length).toBe(1);
    springs.finish();
    await act(async () => {});
    expect(screen.UNSAFE_queryAllByType(Modal)).toHaveLength(0);
  });

  it('the women-mode choice sheet slides out when a driver takes the ride', async () => {
    const springs = holdSprings();
    const raw = {
      female_driver_only: true,
      state: 'no_female_drivers_nearby',
      female_drivers_nearby: false,
      ask_fallback_at: null,
      can_allow_any_driver: true,
      released_at: null,
    };
    const Panel = ({ searching }: { searching: boolean }) => (
      <ThemeProvider>
        <WomenModeSearching rideId={41} raw={raw} searching={searching} />
      </ThemeProvider>
    );
    const view = render(<Panel searching />);
    await act(async () => {});
    springs.finish();
    expect(screen.getByTestId('women-mode-ask-text')).toBeTruthy();

    view.rerender(<Panel searching={false} />);
    await act(async () => {});
    expect(screen.queryByTestId('women-mode-status')).toBeNull();
    expect(screen.getByTestId('women-mode-ask-text')).toBeTruthy();
    springs.finish();
    await act(async () => {});
    expect(screen.queryByTestId('women-mode-ask-text')).toBeNull();
  });

  it('the safety report sheet slides out when the report is sent', async () => {
    const springs = holdSprings();
    mock.onPost('/rides/41/safety-report').reply(201, {
      success: true,
      message: 'Report sent.',
      data: { created: true, incident: { id: 2, status: 'open', category: 'women_safety', source: 'report' } },
    });
    render(
      <ThemeProvider>
        <SafetyReportSection rideId={41} state={{ canReport: true, report: null }} />
      </ThemeProvider>,
    );
    await act(async () => {});
    fireEvent.press(screen.getByTestId('safety-report-button'));
    await act(async () => {});
    springs.finish();
    fireEvent.changeText(screen.getByTestId('safety-report-note'), 'He made me uncomfortable');
    await act(async () => {
      fireEvent.press(screen.getByTestId('safety-report-submit'));
    });
    await waitFor(() => expect(screen.getByTestId('safety-report-sent')).toBeTruthy());
    // The "report sent" line shows while the sheet is still sliding out.
    expect(screen.getByTestId('safety-report-note')).toBeTruthy();
    springs.finish();
    await act(async () => {});
    expect(screen.queryByTestId('safety-report-note')).toBeNull();
  });
});

describe('T-565 useVehicleTypes', () => {
  const fare = { currency: 'PKR', base_fare: 50, per_km: 25, per_min: 2, min_fare: 100, per_stop: 20 };
  const car = { key: 'car', label: 'Car', capacity: 4, icon: 'car', fare };

  it('a failed manual retry keeps the catalogue a concurrent quiet re-read loaded', async () => {
    mock.onGet('/public/vehicle-types').replyOnce(400, { success: false, message: 'x' });
    const { result, rerender } = renderHook(({ focused }: { focused: boolean }) => useVehicleTypes({ refreshWhen: focused }), {
      initialProps: { focused: false },
    });
    await waitFor(() => expect(result.current.status).toBe('error'));

    const answers: Array<(value: [number, unknown]) => void> = [];
    mock.onGet('/public/vehicle-types').reply(
      () =>
        new Promise<[number, unknown]>((resolve) => {
          answers.push(resolve);
        }),
    );
    // The quiet read on focus, then the user taps Retry while it runs.
    rerender({ focused: true });
    await waitFor(() => expect(answers).toHaveLength(1));
    act(() => result.current.retry());
    await waitFor(() => expect(answers).toHaveLength(2));

    await act(async () => {
      answers[0]([200, envelope([car])]);
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => {
      answers[1]([400, { success: false, message: 'x' }]);
    });
    await act(async () => {});
    expect(result.current.status).toBe('ready');
    expect(result.current.data?.map((t) => t.key)).toEqual(['car']);
  });
});
