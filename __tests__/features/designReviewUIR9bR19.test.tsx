/**
 * UI-R9b / UI-R19 design review fixes (2026-10-21): the "Where to?" bar waits for the planner
 * sheet to take its keyboard height before it moves (one move, never a second one with the
 * sheet); the divider under a stop row starts at that row's text; hugging ghosts under text sit
 * on the text start (flushStart); server money text never wraps between "Rs" and the amount.
 */
import React from 'react';
import { Keyboard, StyleSheet, Text, View, type KeyboardEventListener } from 'react-native';
import { act, render, renderHook, screen } from '@testing-library/react-native';
import { AFTER_KEYBOARD_MS, ARRIVAL_SETTLE_MS, useWhereToArrival } from '../../src/features/ride-booking/components/WhereToArrival';
import { StopsSection } from '../../src/features/ride-booking/components/BookingStages';
import { stopTextStart } from '../../src/components/passenger/StopsEditor';
import { useBookingSheetHeight } from '../../src/features/ride-booking/useBookingSheetHeight';
import { ListGroup } from '../../src/components/ui/ListGroup';
import { ListItem } from '../../src/components/ui/ListItem';
import { NBSP, keepMoneyTogether } from '../../src/utils/format';
import { NotificationRow } from '../../src/features/notifications/components/NotificationRow';
import { chatPreviewOf } from '../../src/features/chat/components/ChatRow';
import { SettlementRow } from '../../src/features/wallet/components/SettlementRow';
import type { AppNotification } from '../../src/features/notifications/types';
import type { ChatSummary } from '../../src/features/chat/types';
import type { Settlement } from '../../src/features/wallet/types';

jest.mock('../../src/app/providers/ThemeProvider', () => ({
  useAppTheme: () => ({ theme: jest.requireActual('../../src/theme').LightTheme, scheme: 'system', setScheme: jest.fn() }),
}));

describe('"Where to?" arrival: one move, after the sheet has risen with the keyboard', () => {
  let keyboardShow: KeyboardEventListener | null = null;
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    keyboardShow = null;
    jest.spyOn(Keyboard, 'addListener').mockImplementation((event, listener) => {
      if (event === 'keyboardWillShow' || event === 'keyboardDidShow') keyboardShow = listener;
      return { remove: jest.fn() } as unknown as ReturnType<typeof Keyboard.addListener>;
    });
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  /** A field and a layer whose measures are recorded (never answered: the timeout reveals). */
  const setup = () => {
    const hook = renderHook(() => useWhereToArrival(612));
    const fieldMeasure = jest.fn();
    const layerMeasure = jest.fn();
    hook.result.current.fieldRef.current = { measureInWindow: fieldMeasure } as unknown as View;
    hook.result.current.layerRef.current = { measureInWindow: layerMeasure } as unknown as View;
    return { hook, layerMeasure };
  };
  const keyboardEvent = { endCoordinates: { height: 336, screenX: 0, screenY: 538, width: 402 } } as Parameters<KeyboardEventListener>[0];

  it('the old 250 ms beat no longer starts the move while the sheet still sits at mid height', async () => {
    const { layerMeasure } = setup();
    await act(async () => {
      jest.advanceTimersByTime(250);
    });
    expect(layerMeasure).not.toHaveBeenCalled();
  });

  it('a sheet layout before the keyboard does nothing; the first one after it measures at once', async () => {
    const { hook, layerMeasure } = setup();
    act(() => hook.result.current.onSheetLayout());
    expect(layerMeasure).not.toHaveBeenCalled();
    act(() => keyboardShow?.(keyboardEvent));
    expect(layerMeasure).not.toHaveBeenCalled();
    act(() => hook.result.current.onSheetLayout());
    expect(layerMeasure).toHaveBeenCalledTimes(1);
    // Later layouts and timers never start a second move.
    act(() => hook.result.current.onSheetLayout());
    await act(async () => {
      jest.advanceTimersByTime(ARRIVAL_SETTLE_MS);
    });
    expect(layerMeasure).toHaveBeenCalledTimes(1);
  });

  it('a keyboard without a sheet re-layout measures after AFTER_KEYBOARD_MS', async () => {
    const { layerMeasure } = setup();
    act(() => keyboardShow?.(keyboardEvent));
    await act(async () => {
      jest.advanceTimersByTime(AFTER_KEYBOARD_MS - 1);
    });
    expect(layerMeasure).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(layerMeasure).toHaveBeenCalledTimes(1);
  });

  it('no keyboard at all (a hardware keyboard): the move starts after ARRIVAL_SETTLE_MS', async () => {
    const { hook, layerMeasure } = setup();
    await act(async () => {
      jest.advanceTimersByTime(ARRIVAL_SETTLE_MS);
    });
    expect(layerMeasure).toHaveBeenCalledTimes(1);
    // The measure never answers here: the field shows after its timeout.
    await act(async () => {
      jest.advanceTimersByTime(150);
    });
    expect(hook.result.current.active).toBe(false);
  });
});

describe('stop rows: the divider under a row starts at its own text', () => {
  const stops = [
    { latitude: 31.51, longitude: 74.31, address: 'Stop A, Lahore' },
    { latitude: 31.52, longitude: 74.32, address: 'Stop B, Lahore' },
  ];

  it('handle 44 at 4, glyph 22, 8 gaps: text at 86 in the card (x 102 on the gutter); 46 without the handle', () => {
    expect(stopTextStart(true)).toBe(86);
    expect(stopTextStart(false)).toBe(46);
  });

  it('two stops: both dividers under stop rows start at 86 (not at the "Add a stop" title, 72)', () => {
    render(<StopsSection stops={stops} onAddStop={jest.fn()} onRemoveStop={jest.fn()} onMoveStop={jest.fn()} onAddStopOnMap={jest.fn()} />);
    expect(StyleSheet.flatten(screen.getByTestId('booking-stops-group-divider-1').props.style)).toMatchObject({ marginStart: 86 });
    expect(StyleSheet.flatten(screen.getByTestId('booking-stops-group-divider-2').props.style)).toMatchObject({ marginStart: 86 });
  });

  it('one stop (no handle): the divider above "Add a stop" starts at that stop\'s text, 46', () => {
    render(<StopsSection stops={stops.slice(0, 1)} onAddStop={jest.fn()} onRemoveStop={jest.fn()} onMoveStop={jest.fn()} onAddStopOnMap={jest.fn()} />);
    expect(StyleSheet.flatten(screen.getByTestId('booking-stops-group-divider-1').props.style)).toMatchObject({ marginStart: 46 });
  });

  it('ListGroup: a numeric dividerInset wins; ListItem rows keep the token insets', () => {
    const Row = (_props: { dividerInset?: number }) => <Text>row</Text>;
    render(
      <ListGroup testID="g">
        <Row dividerInset={50} />
        <ListItem icon="add" title="A" onPress={jest.fn()} />
        <ListItem title="B" onPress={jest.fn()} />
      </ListGroup>,
    );
    expect(StyleSheet.flatten(screen.getByTestId('g-divider-1').props.style)).toMatchObject({ marginStart: 50 });
    expect(StyleSheet.flatten(screen.getByTestId('g-divider-2').props.style)).toMatchObject({ marginStart: 72 });
  });
});

describe('server money text keeps "Rs" with its amount', () => {
  it('joins "Rs 150", "Rs. 150" and "PKR 1,200" with a no-break space, and nothing else', () => {
    expect(keepMoneyTogether('Fare: Rs 150')).toBe(`Fare: Rs${NBSP}150`);
    expect(keepMoneyTogether('Collect Rs  150 in cash, then Rs 20 tip')).toBe(`Collect Rs${NBSP}150 in cash, then Rs${NBSP}20 tip`);
    expect(keepMoneyTogether('Rs. 1,200')).toBe(`Rs.${NBSP}1,200`);
    expect(keepMoneyTogether('PKR 500')).toBe(`PKR${NBSP}500`);
    // Not money: no digit after, or "Rs" inside a word.
    expect(keepMoneyTogether('Rs pending')).toBe('Rs pending');
    expect(keepMoneyTogether('Mrs 5 stars')).toBe('Mrs 5 stars');
    expect(keepMoneyTogether('')).toBe('');
    expect(keepMoneyTogether(`Rs${NBSP}150`)).toBe(`Rs${NBSP}150`);
  });

  const notification: AppNotification = {
    id: 9,
    type: 'ride_completed',
    category: 'ride',
    title: 'Trip Completed',
    body: 'Trip completed. Collect Rs 150 in cash',
    data: { rideId: 1, stopId: null, messageId: null, fare: '150', cancelledBy: null, requeued: false },
    imageUrl: null,
    actionUrl: null,
    actionText: null,
    isBroadcast: false,
    readAt: null,
    createdAt: '2026-10-21T05:16:00Z',
  };

  it('a notification body is drawn with the no-break space', () => {
    render(<NotificationRow item={notification} onPress={jest.fn()} />);
    expect(screen.getByText(`Trip completed. Collect Rs${NBSP}150 in cash`)).toBeTruthy();
  });

  it('a chat preview keeps it after newlines are folded', () => {
    const chat: ChatSummary = {
      rideId: 4,
      rideStatus: 'accepted',
      canSend: true,
      readOnlyUntil: null,
      contactClosesAt: null,
      otherParty: null,
      unreadCount: 1,
      lastMessage: {
        id: 1,
        rideId: 4,
        clientId: null,
        senderId: 2,
        senderRole: 'driver',
        isMine: false,
        body: 'Fare:\nRs 150',
        createdAt: '2026-10-21T05:16:00Z',
        readAt: null,
        safetyWarning: null,
      },
    };
    expect(chatPreviewOf(chat)).toBe(`Fare: Rs${NBSP}150`);
  });
});

describe('hugging ghosts under text start at the text (flushStart)', () => {
  it('the settlement "Cancel request" ghost is pulled back by its sm padding', () => {
    const settlement: Settlement = {
      id: 3,
      kind: 'commission_payment',
      amount: 500,
      currency: 'PKR',
      method: 'cash',
      reference: null,
      note: null,
      status: 'pending',
      reviewNote: null,
      reviewedAt: null,
      transactionId: null,
      createdAt: '2026-10-21T05:16:00Z',
    };
    render(<SettlementRow settlement={settlement} onCancel={jest.fn()} />);
    expect(StyleSheet.flatten(screen.getByTestId('wallet-settlement-3-cancel').props.style)).toMatchObject({ marginStart: -16 });
  });
});

describe('booking sheet height wiring', () => {
  it('the booking sheet height sets the state, then tells the arrival', () => {
    const onSheetLayout = jest.fn();
    const { result } = renderHook(() => useBookingSheetHeight(onSheetLayout));
    act(() => result.current.onBookingSheetHeight(320));
    expect(result.current.sheetHeight).toBe(320);
    expect(onSheetLayout).toHaveBeenCalledTimes(1);
    // The picker's height does not count as a sheet layout for the arrival.
    act(() => result.current.setSheetHeight(200));
    expect(result.current.sheetHeight).toBe(200);
    expect(onSheetLayout).toHaveBeenCalledTimes(1);
  });
});
