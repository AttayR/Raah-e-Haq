/**
 * T-568: follow-ups to T-565.
 * - A closing modal sheet's spring ends when the sheet reaches the bottom edge (overshoot
 *   clamped), so its invisible Modal no longer lingers for the spring's ~0.8 s settle and
 *   swallows the next taps (QA N1).
 * - DialogHost keeps the fading dialog's text when a new confirm() queues during the fade-out.
 * - useDriverParcel: a closing code / reason sheet keeps its purpose, kind and reasons.
 * - WomenModeSearching keeps its wording while the sheet slides out and asks again after a
 *   re-queue (it stays mounted for the whole ride since T-565).
 */
import React from 'react';
import { Modal, Text, useColorScheme } from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import MockAdapter from 'axios-mock-adapter';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { BottomSheet } from '../../../src/components/ui';
import { DialogHost, DialogSurface } from '../../../src/components/ui/Dialog';
import { modalQueue } from '../../../src/components/ui/modalQueue';
import { confirm, dialog } from '../../../src/core/dialog';
import { t } from '../../../src/i18n';
import { apiClient } from '../../../src/services/api';
import { rootReducer } from '../../../src/store/rootReducer';
import { rideStep } from '../../../src/features/driver-ride/steps';
import { useDriverParcel } from '../../../src/features/parcel/useDriverParcel';
import { WomenModeSearching } from '../../../src/features/women-mode/components/WomenModeSearching';
import type { RideResource } from '../../../src/services/rideService';
import { envelope, makeRide } from '../../../test-utils/rideFixtures';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));
(useColorScheme as jest.MockedFunction<typeof useColorScheme>).mockReturnValue('light');

type Finish = (finished?: boolean) => void;
/** Springs that run until the test finishes them; records each spring's target and config. */
const holdSprings = () => {
  let running: Finish | null = null;
  const calls: Array<{ toValue: number; config: { overshootClamping?: boolean } }> = [];
  jest.spyOn(Reanimated, 'withSpring').mockImplementation(((toValue: number, config: { overshootClamping?: boolean }, callback?: Finish) => {
    calls.push({ toValue, config });
    const previous = running;
    running = callback ?? null;
    previous?.(false);
    return toValue;
  }) as unknown as typeof Reanimated.withSpring);
  return {
    calls,
    finish: () => {
      const done = running;
      running = null;
      act(() => done?.(true));
    },
  };
};

const modals = () => screen.UNSAFE_queryAllByType(Modal);

/** The title of the DialogSurface inside a React element tree (props.children only). */
const surfaceTitle = (node: React.ReactNode): string | null => {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = surfaceTitle(child);
      if (found !== null) return found;
    }
    return null;
  }
  if (!React.isValidElement(node)) return null;
  const props = node.props as { title?: string; children?: React.ReactNode };
  if (node.type === DialogSurface) return props.title ?? null;
  return surfaceTitle(props.children);
};

let mock: MockAdapter;
beforeEach(() => {
  modalQueue.reset();
  mock = new MockAdapter(apiClient);
});
afterEach(() => {
  act(() => dialog.dismissAll());
  mock.restore();
  jest.restoreAllMocks();
});

describe('T-568 modal sheet close (QA N1)', () => {
  const Sheet = ({ up }: { up: boolean }) => (
    <ThemeProvider>
      <BottomSheet mode="modal" visible={up} testID="sheet">
        <Text>Sheet body</Text>
      </BottomSheet>
    </ThemeProvider>
  );

  it('closes on a clamped spring that ends at the bottom edge', async () => {
    const springs = holdSprings();
    const view = render(<Sheet up />);
    await act(async () => {});
    springs.finish();
    const before = springs.calls.length;

    view.rerender(<Sheet up={false} />);
    await act(async () => {});
    expect(springs.calls.length).toBe(before + 1);
    const closing = springs.calls[springs.calls.length - 1];
    // Before T-568 the close used the underdamped snap spring as is: its Modal stayed up (and ate
    // taps) until the spring settled, ~0.8 s after the sheet had left the screen.
    expect(closing?.config.overshootClamping).toBe(true);
    expect(modals()).toHaveLength(1);
    springs.finish();
    await act(async () => {});
    expect(modals()).toHaveLength(0);
  });
});

describe('T-568 DialogHost during the fade-out', () => {
  it('keeps the fading dialog text when a new confirm() queues, then shows the new one', async () => {
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
    act(() => {
      confirm({ title: 'End the trip?', confirmLabel: 'End trip' });
    });
    await act(async () => {});
    // Still fading out: the old text, not the queued question (it swapped before T-568).
    expect(modals().map((m) => m.props.visible)).toEqual([false]);
    // iOS still shows the hidden Modal's content while it fades out (the Jest Modal mock renders
    // nothing when hidden, so read the content the Modal was given).
    expect(surfaceTitle(modals()[0].props.children)).toBe('Go offline?');

    act(() => modals()[0].props.onDismiss());
    await act(async () => {});
    expect(modals().map((m) => m.props.visible)).toEqual([true]);
    expect(screen.getByText('End the trip?')).toBeTruthy();
    expect(screen.queryByText('Go offline?')).toBeNull();
  });
});

describe('T-568 useDriverParcel closing sheets keep their purpose', () => {
  const code = {
    digits: 6,
    purpose: null,
    sent: true,
    send_count: 1,
    sends_left: 2,
    sms_failed: false,
    can_resend: false,
    resend_available_at: null,
    attempts_left: 5,
    locked_until: null,
    blocked: false,
    delivery_blocked: false,
  };
  const parcelBlock = (status: string) => ({
    status,
    item_category: 'documents',
    item_category_label: 'Documents and papers',
    size_class: 'small',
    size_label: 'Small (fits in a bag)',
    max_weight_kg: 2,
    item_description: null,
    declared_value: 2500,
    receiver: { name: 'Sana Khan', phone: null, phone_masked: '+92300*****67' },
    pickup_photo_url: null,
    code,
    can_call_receiver: false,
  });
  const rideWith = (status: RideResource['status'], parcelStatus: string): RideResource =>
    makeRide({
      vehicle_type: 'parcel',
      is_parcel: true,
      status,
      driver_id: 5,
      parcel: parcelBlock(parcelStatus),
      fare: '180.00',
    } as Partial<RideResource>);

  const renderParcel = (ride: RideResource) => {
    const initial = rootReducer(undefined, { type: '@@fixtures/init' });
    const store = configureStore({
      reducer: rootReducer,
      preloadedState: { ...initial, driverRide: { ride, pendingAction: null, pendingRequestId: null } },
    });
    return renderHook(() => useDriverParcel({ ride, step: rideStep(ride), pendingAction: null, onMessage: () => undefined }), {
      wrapper: ({ children }: { children: React.ReactNode }) => <Provider store={store}>{children}</Provider>,
    });
  };

  it('the hand-back code sheet slides out as the hand-back sheet', () => {
    const { result } = renderParcel(rideWith('started', 'returning'));
    act(() => result.current.panel?.primary?.onPress());
    expect(result.current.sheets.code.visible).toBe(true);
    expect(result.current.sheets.code.purpose).toBe('returned');

    act(() => result.current.sheets.code.onClose());
    expect(result.current.sheets.code.visible).toBe(false);
    // Before T-568 it turned into the "deliver" sheet while sliding out.
    expect(result.current.sheets.code.purpose).toBe('returned');
  });

  it('the refuse reason sheet slides out with the refusal reasons', async () => {
    mock.onGet('/parcels/options').reply(
      200,
      envelope({
        return_reasons: [{ key: 'receiver_absent', label: 'Receiver not there' }],
        refusal_reasons: [{ key: 'prohibited', label: 'Prohibited item' }],
      }),
    );
    const { result } = renderParcel(rideWith('arrived', 'arrived'));
    act(() => result.current.panel?.secondary?.onPress());
    expect(result.current.sheets.reason.kind).toBe('refuse');
    await waitFor(() => expect(result.current.sheets.reason.reasons.map((r) => r.key)).toEqual(['prohibited']));

    act(() => result.current.sheets.reason.onClose());
    expect(result.current.sheets.reason.visible).toBe(false);
    expect(result.current.sheets.reason.kind).toBe('refuse');
    expect(result.current.sheets.reason.reasons.map((r) => r.key)).toEqual(['prohibited']);
  });
});

describe('T-568 WomenModeSearching', () => {
  const block = (state: string) => ({
    female_driver_only: true,
    state,
    female_drivers_nearby: false,
    ask_fallback_at: null,
    can_allow_any_driver: true,
    released_at: null,
  });
  const Panel = ({ raw, searching }: { raw: unknown; searching: boolean }) => (
    <ThemeProvider>
      <WomenModeSearching rideId={41} raw={raw} searching={searching} />
    </ThemeProvider>
  );

  it('keeps the "none nearby" wording while the sheet slides out after a match', async () => {
    const springs = holdSprings();
    const view = render(<Panel raw={block('no_female_drivers_nearby')} searching />);
    await act(async () => {});
    expect(screen.getByTestId('women-mode-ask-text')).toHaveTextContent(t('womenMode.askNoneNearby'));

    view.rerender(<Panel raw={block('matched')} searching={false} />);
    await act(async () => {});
    // Sliding out: the same text (it switched to the "none took it" line before T-568).
    expect(screen.getByTestId('women-mode-ask-text')).toHaveTextContent(t('womenMode.askNoneNearby'));
    springs.finish();
    await act(async () => {});
    expect(screen.queryByTestId('women-mode-ask-text')).toBeNull();
  });

  it('asks again after a re-queue even though the last search closed the sheet', async () => {
    const springs = holdSprings();
    const raw = block('ask_fallback');
    const view = render(<Panel raw={raw} searching />);
    await act(async () => {});
    // Closed without an answer: snoozed for a minute.
    fireEvent.press(screen.getByTestId('women-mode-sheet-scrim'));
    springs.finish();
    await act(async () => {});
    expect(screen.queryByTestId('women-mode-ask-text')).toBeNull();

    // A driver took the ride, then cancelled: the server re-queued it and asks again.
    view.rerender(<Panel raw={block('matched')} searching={false} />);
    await act(async () => {});
    view.rerender(<Panel raw={block('ask_fallback')} searching />);
    await act(async () => {});
    // Before T-568 the old snooze (from the first search) held the sheet back.
    expect(screen.getByTestId('women-mode-ask-text')).toBeTruthy();
  });
});
