/**
 * T-510: the shared thread screen (header name/photo/call, empty state, "Seen", failed bubble
 * with retry, composer hidden with a read-only notice once the ride ended, 410 expired) and
 * the Inbox › Messages list from GET /chats (rows, unread, empty, error, tap opens the thread). The
 * "Message" entry points on both ride panels open RideChat with the ride id.
 */
import React from 'react';
import { KeyboardAvoidingView, Linking, Text } from 'react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { rootReducer } from '../../../src/store/rootReducer';
import { ApiError } from '../../../src/core/api/errors';
import { chatApi } from '../../../src/features/chat/api';
import { safetyApi } from '../../../src/features/safety/api';
import ChatThreadScreen from '../../../src/features/chat/screens/ChatThreadScreen';
import { ChatList } from '../../../src/features/chat/components/ChatList';
import ActiveRidePanel from '../../../src/features/active-ride/components/ActiveRidePanel';
import { advanceRideStage } from '../../../src/features/active-ride/stage';
import { DriverRidePanel } from '../../../src/components/driver/DriverRidePanel';
import type { RideResource } from '../../../src/services/rideService';
import { makeRide } from '../../../test-utils/rideFixtures';
import { message, mine, theirs, threadPage } from '../../../test-utils/chatFixtures';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, canGoBack: () => true }),
  useRoute: () => ({ key: 'RideChat-1', name: 'RideChat', params: { rideId: 7 } }),
  useIsFocused: () => true,
}));

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 8; i += 1) {
      await Promise.resolve();
    }
  });
};

const makeStoreWith = (ride: RideResource | null = null) => {
  const initial = rootReducer(undefined, { type: '@@chat-test/init' });
  return configureStore({
    reducer: rootReducer,
    preloadedState: { ...initial, activeRide: { ...initial.activeRide, ride } },
  });
};

const renderWithStore = async (ui: React.ReactElement, ride: RideResource | null = null) => {
  const utils = render(<Provider store={makeStoreWith(ride)}>{ui}</Provider>);
  await flush();
  return utils;
};

beforeEach(() => {
  jest.useFakeTimers();
  mockNavigate.mockReset();
  mockGoBack.mockReset();
  jest.spyOn(chatApi, 'markRead').mockResolvedValue({ rideId: 7, marked: 0, unreadCount: 0 });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('ChatThreadScreen', () => {
  it('shows the other party in the header, the messages, "Seen" and the composer', async () => {
    jest.spyOn(chatApi, 'getMessages').mockResolvedValue(
      threadPage({ messages: [theirs(1, 'Where are you?'), mine(2, 'c-2', 'At the gate')], lastId: 2, otherPartyReadUpToId: 2 }),
    );
    await renderWithStore(<ChatThreadScreen />);

    expect(screen.getByTestId('chat-header-name')).toHaveTextContent('Bilal');
    expect(screen.getByText('Where are you?')).toBeTruthy();
    expect(screen.getByText('At the gate')).toBeTruthy();
    // UI-R14: time + double check under the run; the status is spoken, not printed.
    expect(screen.getByTestId('chat-seen').props.accessibilityLabel).toMatch(/Seen$/);
    expect(screen.getByTestId('chat-composer')).toBeTruthy();
    expect(screen.queryByTestId('chat-closed-notice')).toBeNull();
    // T-512: the composer lives inside the iOS keyboard avoider.
    expect(screen.UNSAFE_getByType(KeyboardAvoidingView).props).toMatchObject({ behavior: 'padding', keyboardVerticalOffset: 0 });
    expect(screen.getByTestId('chat-thread-screen-keyboard-avoider')).toContainElement(screen.getByTestId('chat-composer'));
  });

  it('read-only after the ride ended: no composer, an explanation instead', async () => {
    jest.spyOn(chatApi, 'getMessages').mockResolvedValue(
      threadPage({
        canSend: false,
        rideStatus: 'completed',
        readOnlyUntil: '2026-10-12T12:00:00+00:00',
        messages: [message({ id: 1, body: 'Thanks', readAt: 'r' })],
        lastId: 1,
      }),
    );
    await renderWithStore(<ChatThreadScreen />);

    expect(screen.queryByTestId('chat-composer')).toBeNull();
    expect(screen.queryByTestId('chat-input')).toBeNull();
    expect(screen.getByTestId('chat-closed-notice')).toHaveTextContent(/Chat closed\. You can read the messages until/);
  });

  it('read-only notice says "tomorrow" when the window ends on another day (T-512)', async () => {
    jest.setSystemTime(new Date(2026, 9, 11, 21, 0));
    jest.spyOn(chatApi, 'getMessages').mockResolvedValue(
      threadPage({
        canSend: false,
        rideStatus: 'completed',
        readOnlyUntil: new Date(2026, 9, 12, 12, 16).toISOString(),
        messages: [message({ id: 1, body: 'Thanks', readAt: 'r' })],
        lastId: 1,
      }),
    );
    await renderWithStore(<ChatThreadScreen />);

    expect(screen.getByTestId('chat-closed-notice')).toHaveTextContent(
      /Chat closed\. You can read the messages until tomorrow at 12:16 PM\.$/,
    );
  });

  it('no driver yet: the composer is hidden with the not-open notice', async () => {
    jest.spyOn(chatApi, 'getMessages').mockResolvedValue(threadPage({ canSend: false, otherParty: null, rideStatus: 'requested' }));
    await renderWithStore(<ChatThreadScreen />);
    expect(screen.queryByTestId('chat-composer')).toBeNull();
    expect(screen.getByTestId('chat-closed-notice')).toHaveTextContent(/Chat opens once a driver accepts the ride\./);
  });

  it('empty thread shows the empty state; sending shows the bubble and clears the input', async () => {
    jest.spyOn(chatApi, 'getMessages').mockResolvedValue(threadPage());
    const send = jest.spyOn(chatApi, 'sendMessage').mockImplementation(async (_ride, body, clientId) =>
      mine(10, clientId, body),
    );
    await renderWithStore(<ChatThreadScreen />);
    expect(screen.getByTestId('chat-thread-empty')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('chat-input'), 'Coming down');
    fireEvent.press(screen.getByTestId('chat-send'));
    await flush();

    expect(send).toHaveBeenCalledWith(7, 'Coming down', expect.any(String));
    expect(screen.getByText('Coming down')).toBeTruthy();
    expect(screen.getByTestId('chat-input').props.value).toBe('');
  });

  it('a failed send shows why and retries on tap with the same client_id', async () => {
    jest.spyOn(chatApi, 'getMessages').mockResolvedValue(threadPage());
    const send = jest
      .spyOn(chatApi, 'sendMessage')
      .mockRejectedValueOnce(new ApiError({ kind: 'rate_limited', status: 429, message: 'slow', code: 'rate_limited' }));
    await renderWithStore(<ChatThreadScreen />);

    fireEvent.changeText(screen.getByTestId('chat-input'), 'Hello');
    fireEvent.press(screen.getByTestId('chat-send'));
    await flush();
    expect(screen.getByText(/Too many messages, wait a moment\. Tap to retry/)).toBeTruthy();

    const clientId = send.mock.calls[0][2];
    send.mockResolvedValueOnce(mine(11, clientId, 'Hello'));
    fireEvent.press(screen.getByTestId(`chat-retry-${clientId}`));
    await flush();
    expect(send).toHaveBeenLastCalledWith(7, 'Hello', clientId);
    expect(screen.queryByText(/Tap to retry/)).toBeNull();
  });

  it('410 expired: explains and offers Back', async () => {
    jest.spyOn(chatApi, 'getMessages').mockRejectedValue(new ApiError({ kind: 'unknown', status: 410, code: 'chat_expired', message: 'gone' }));
    await renderWithStore(<ChatThreadScreen />);
    expect(screen.getByText('This chat has expired.')).toBeTruthy();
    fireEvent.press(screen.getByText('Back'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('error on load: Try again reloads', async () => {
    const get = jest
      .spyOn(chatApi, 'getMessages')
      .mockRejectedValueOnce(new ApiError({ kind: 'network', message: 'Network error. Please check your connection.' }))
      .mockResolvedValue(threadPage());
    await renderWithStore(<ChatThreadScreen />);
    expect(screen.getByTestId('chat-thread-error')).toBeTruthy();
    fireEvent.press(screen.getByTestId('chat-thread-retry'));
    await flush();
    expect(get).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('chat-composer')).toBeTruthy();
  });

  it('[T-520] Call asks POST /call for a masked number (never a phone from the ride), only for that ride', async () => {
    jest.spyOn(chatApi, 'getMessages').mockResolvedValue(threadPage());
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const requestCall = jest
      .spyOn(safetyApi, 'requestCall')
      .mockResolvedValue({ mode: 'proxy', number: '+922100000001', expiresAt: null, contactClosesAt: null });
    const ride = makeRide({
      id: 7,
      status: 'accepted',
      driver_id: 12,
      driver: { id: 12, name: 'Bilal' },
      contact: { can_chat: true, can_call: true, call_mode: 'proxy', closes_at: null },
    });
    await renderWithStore(<ChatThreadScreen />, ride);
    fireEvent.press(screen.getByTestId('chat-call'));
    await flush();
    expect(requestCall).toHaveBeenCalledWith(7);
    expect(openURL).toHaveBeenCalledWith('tel:%2B922100000001');
  });

  it('[T-520] no Call button when calls are chat only, or the ride in the store is a different one', async () => {
    jest.spyOn(chatApi, 'getMessages').mockResolvedValue(threadPage());
    const chatOnly = makeRide({ id: 7, status: 'accepted', driver_id: 12, contact: { can_chat: true, can_call: false, call_mode: 'chat_only' } });
    const first = await renderWithStore(<ChatThreadScreen />, chatOnly);
    expect(screen.queryByTestId('chat-call')).toBeNull();
    first.unmount();

    const other = makeRide({ id: 99, status: 'accepted', driver_id: 12, contact: { can_chat: true, can_call: true, call_mode: 'proxy' } });
    await renderWithStore(<ChatThreadScreen />, other);
    expect(screen.queryByTestId('chat-call')).toBeNull();
  });

  it('[T-520] 403 CONTACT_CLOSED on load shows "Chat closed", not "not available to you"', async () => {
    jest
      .spyOn(chatApi, 'getMessages')
      .mockRejectedValue(new ApiError({ kind: 'forbidden', status: 403, code: 'CONTACT_CLOSED', message: 'closed' }));
    await renderWithStore(<ChatThreadScreen />);
    expect(screen.getByTestId('chat-thread-closed')).toBeTruthy();
    expect(screen.getByText('Chat closed')).toBeTruthy();
    expect(screen.queryByText('This chat is not available to you.')).toBeNull();
  });

  it('[T-520] a send refused with 403 CONTACT_CLOSED keeps the thread readable with the closed note', async () => {
    jest
      .spyOn(chatApi, 'getMessages')
      .mockResolvedValueOnce(threadPage({ rideStatus: 'completed', messages: [theirs(1, 'Thanks')], lastId: 1 }))
      .mockResolvedValue(
        threadPage({ canSend: false, rideStatus: 'completed', contactClosesAt: '2026-10-12T12:00:00+00:00', messages: [theirs(1, 'Thanks')], lastId: 1 }),
      );
    jest
      .spyOn(chatApi, 'sendMessage')
      .mockRejectedValue(new ApiError({ kind: 'forbidden', status: 403, code: 'CONTACT_CLOSED', message: 'closed' }));
    await renderWithStore(<ChatThreadScreen />);

    fireEvent.changeText(screen.getByTestId('chat-input'), 'one more thing');
    fireEvent.press(screen.getByTestId('chat-send'));
    await flush();

    expect(screen.getByText('Thanks')).toBeTruthy();
    expect(screen.queryByTestId('chat-thread-forbidden')).toBeNull();
    expect(screen.queryByTestId('chat-composer')).toBeNull();
    expect(screen.getByTestId('chat-closed-notice')).toHaveTextContent(/Chat closed/);
  });

  it('[T-520] after the ride ended, sending stays open with "Chat closes at" until contact_closes_at', async () => {
    jest.setSystemTime(new Date(2026, 9, 12, 11, 40));
    jest.spyOn(chatApi, 'getMessages').mockResolvedValue(
      threadPage({ rideStatus: 'completed', canSend: true, contactClosesAt: new Date(2026, 9, 12, 12, 10).toISOString() }),
    );
    await renderWithStore(<ChatThreadScreen />);
    expect(screen.getByTestId('chat-composer')).toBeTruthy();
    expect(screen.getByTestId('chat-closes-at')).toHaveTextContent('The ride has ended. Chat closes at 12:10 PM.');
  });
});

describe('ChatThreadScreen (UI-R14 content)', () => {
  it('loading shows skeleton bubbles, not a spinner', async () => {
    jest.spyOn(chatApi, 'getMessages').mockReturnValue(new Promise(() => undefined));
    await renderWithStore(<ChatThreadScreen />);
    expect(screen.getByTestId('chat-thread-loading')).toBeTruthy();
  });

  it('an open, empty thread says who can read it, offers quick replies, and a reply sends at once', async () => {
    jest.spyOn(chatApi, 'getMessages').mockResolvedValue(threadPage());
    const send = jest.spyOn(chatApi, 'sendMessage').mockImplementation(async (_ride, body, clientId) => mine(11, clientId, body));
    await renderWithStore(<ChatThreadScreen />);
    expect(screen.getByTestId('chat-thread-empty')).toHaveTextContent('Messages are shared only with your driver for this ride.');
    expect(screen.getByTestId('chat-input').props.placeholder).toBe('Message Bilal');

    fireEvent.press(screen.getByTestId('chat-quick-reply-0'));
    await flush();
    expect(send).toHaveBeenCalledWith(7, "I'm on my way", expect.any(String));
    // The last message is now mine: the replies step aside.
    expect(screen.queryByTestId('chat-quick-replies')).toBeNull();
  });

  it('quick replies come back when the last message is theirs', async () => {
    jest.spyOn(chatApi, 'getMessages').mockResolvedValue(threadPage({ messages: [mine(1, 'c-1', 'Hi'), theirs(2, 'Coming')], lastId: 2 }));
    await renderWithStore(<ChatThreadScreen />);
    expect(screen.getByTestId('chat-quick-replies')).toBeTruthy();
  });

  it('a closed thread keeps its history with the lock bar and no quick replies', async () => {
    jest.spyOn(chatApi, 'getMessages').mockResolvedValue(
      threadPage({
        canSend: false,
        rideStatus: 'completed',
        messages: [theirs(2, 'Coming')],
        lastId: 2,
        contactClosesAt: '2026-10-11T12:30:00+00:00',
      }),
    );
    await renderWithStore(<ChatThreadScreen />);
    expect(screen.getByText('Coming')).toBeTruthy();
    expect(screen.getByTestId('chat-closed-notice')).toHaveTextContent(/Chat closed\. You can still read the messages\./);
    expect(screen.queryByTestId('chat-quick-replies')).toBeNull();
  });

  it('messages from one side in a run show the time once, under the newest', async () => {
    jest.spyOn(chatApi, 'getMessages').mockResolvedValue(
      threadPage({
        messages: [
          message({ id: 1, body: 'one', createdAt: '2026-10-11T12:00:00+00:00' }),
          message({ id: 2, body: 'two', createdAt: '2026-10-11T12:01:00+00:00' }),
        ],
        lastId: 2,
      }),
    );
    await renderWithStore(<ChatThreadScreen />);
    const times = screen.getAllByText(/\d{1,2}:\d{2} (AM|PM)/);
    expect(times).toHaveLength(1);
    expect(screen.getByTestId('chat-bubble-m-2')).toContainElement(times[0]);
  });

  it("a passenger sees the driver's car and plate under the name when the ride is in the store", async () => {
    jest.spyOn(chatApi, 'getMessages').mockResolvedValue(threadPage());
    const ride = makeRide({
      id: 7,
      status: 'accepted',
      vehicle: { make: 'Suzuki', model: 'Alto', color: 'White', license_plate: 'LEC-1234' },
    } as Partial<RideResource>);
    await renderWithStore(<ChatThreadScreen />, ride);
    expect(screen.getByTestId('chat-header-subtitle')).toHaveTextContent('Suzuki Alto · LEC-1234');
  });

  it('the counter shows from 900 characters; send is disabled while the draft is blank', async () => {
    jest.spyOn(chatApi, 'getMessages').mockResolvedValue(threadPage());
    await renderWithStore(<ChatThreadScreen />);
    fireEvent.changeText(screen.getByTestId('chat-input'), 'a'.repeat(899));
    expect(screen.queryByTestId('chat-counter')).toBeNull();
    fireEvent.changeText(screen.getByTestId('chat-input'), 'a'.repeat(950));
    expect(screen.getByTestId('chat-counter')).toHaveTextContent('950/1000');
    expect(screen.getByTestId('chat-send').props.accessibilityState).toEqual({ disabled: false });
    fireEvent.changeText(screen.getByTestId('chat-input'), '   ');
    expect(screen.getByTestId('chat-send').props.accessibilityState).toEqual({ disabled: true });
  });
});

describe('ChatList (Inbox › Messages)', () => {
  it('lists chats from GET /chats with unread counts and opens the thread on tap', async () => {
    jest.spyOn(chatApi, 'listChats').mockResolvedValue([
      {
        rideId: 7,
        rideStatus: 'accepted',
        canSend: true,
        readOnlyUntil: null,
        contactClosesAt: null,
        otherParty: { id: 12, role: 'driver', firstName: 'Bilal', profileImageUrl: null },
        lastMessage: theirs(3, 'At the gate'),
        unreadCount: 2,
      },
      {
        rideId: 8,
        rideStatus: 'completed',
        canSend: false,
        readOnlyUntil: '2026-10-12T12:00:00+00:00',
        contactClosesAt: '2026-10-11T12:30:00+00:00',
        otherParty: { id: 13, role: 'driver', firstName: null, profileImageUrl: null },
        lastMessage: null,
        unreadCount: 0,
      },
    ]);
    await renderWithStore(<ChatList visible />);

    expect(screen.getByText('Bilal')).toBeTruthy();
    expect(screen.getByText(/At the gate/)).toBeTruthy();
    expect(screen.getByTestId('chat-unread-7')).toHaveTextContent('2');
    expect(screen.getByText('Your driver')).toBeTruthy();
    expect(screen.getByText('No messages yet')).toBeTruthy();
    // UI-R14: "Current ride" / "Earlier" sections; a closed chat shows "Ended", not a count.
    expect(screen.getByTestId('chat-section-current')).toHaveTextContent('Current ride');
    expect(screen.getByTestId('chat-section-earlier')).toHaveTextContent('Earlier');
    expect(screen.getByTestId('chat-ended-8')).toHaveTextContent('Ended');
    expect(screen.queryByTestId('chat-ended-7')).toBeNull();
    expect(screen.getByTestId('chat-row-7').props.accessibilityLabel).toContain('2 unread');

    fireEvent.press(screen.getByTestId('chat-row-7'));
    expect(mockNavigate).toHaveBeenCalledWith('RideChat', { rideId: 7 });
  });

  it('empty: names the other side per role', async () => {
    jest.spyOn(chatApi, 'listChats').mockResolvedValue([]);
    await renderWithStore(<ChatList visible />);
    expect(screen.getByText('No messages')).toBeTruthy();
    expect(screen.getByText('You can message your driver during a ride.')).toBeTruthy();
  });

  it('empty for a driver names the passenger', async () => {
    jest.spyOn(chatApi, 'listChats').mockResolvedValue([]);
    await renderWithStore(<ChatList visible role="driver" />);
    expect(screen.getByText('You can message your passenger during a ride.')).toBeTruthy();
  });

  it('your own last message is prefixed "You:"', async () => {
    jest.spyOn(chatApi, 'listChats').mockResolvedValue([
      {
        rideId: 9,
        rideStatus: 'completed',
        canSend: true,
        readOnlyUntil: null,
        contactClosesAt: '2026-10-11T12:30:00+00:00',
        otherParty: { id: 12, role: 'driver', firstName: 'Bilal', profileImageUrl: null },
        lastMessage: mine(5, 'c-5', 'Thanks a lot'),
        unreadCount: 0,
      },
    ]);
    await renderWithStore(<ChatList visible />);
    expect(screen.getByText('You: Thanks a lot')).toBeTruthy();
    // Still sendable (30 min after the ride): no "Ended", and it sits under Earlier.
    expect(screen.queryByTestId('chat-ended-9')).toBeNull();
    expect(screen.queryByTestId('chat-section-current')).toBeNull();
  });

  it('error: Try again reloads', async () => {
    const list = jest
      .spyOn(chatApi, 'listChats')
      .mockRejectedValueOnce(new ApiError({ kind: 'network', message: 'Network error. Please check your connection.' }))
      .mockResolvedValue([]);
    await renderWithStore(<ChatList visible />);
    expect(screen.getByTestId('chat-list-error')).toBeTruthy();
    fireEvent.press(screen.getByTestId('chat-list-retry'));
    await flush();
    expect(list).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('chat-list-empty')).toBeTruthy();
  });
});

describe('Message entry points', () => {
  const Stack = createNativeStackNavigator<{ Ride: undefined; RideChat: { rideId: number } }>();
  const ThreadStandIn = ({ route }: { route: { params: { rideId: number } } }) => (
    <Text>{`thread:${route.params.rideId}`}</Text>
  );

  /** The panel inside a real stack that also has RideChat, as in both role stacks. */
  const renderInStack = (ride: RideResource) => {
    const stageState = advanceRideStage(null, ride);
    if (!stageState) throw new Error('no stage');
    const RideScreen = () => (
      <ActiveRidePanel stageState={stageState} ride={ride} onCancel={jest.fn()} onDone={jest.fn()} />
    );
    return render(
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Ride" component={RideScreen} />
          <Stack.Screen name="RideChat" component={ThreadStandIn} />
        </Stack.Navigator>
      </NavigationContainer>,
    );
  };

  it.each(['accepted', 'arrived', 'started'] as const)('passenger panel (%s): Message opens RideChat', async (status) => {
    renderInStack(makeRide({ id: 7, status, driver_id: 5, driver: { id: 5, name: 'Ali' } }));
    await flush();
    fireEvent.press(screen.getByTestId('ride-chat-button'));
    await flush();
    expect(screen.getByText('thread:7')).toBeTruthy();
  });

  it('passenger panel: no Message while searching (no driver yet)', async () => {
    renderInStack(makeRide({ id: 7, status: 'requested' }));
    await flush();
    expect(screen.queryByTestId('ride-chat-button')).toBeNull();
  });

  it('driver panel: Message calls onMessage', () => {
    const onMessage = jest.fn();
    render(
      <DriverRidePanel
        ride={makeRide({ id: 7, status: 'accepted' })}
        step="to_pickup"
        pendingAction={null}
        canCall={false}
        canNavigate={false}
        onCall={jest.fn()}
        onMessage={onMessage}
        onNavigate={jest.fn()}
        onArrived={jest.fn()}
        onStart={jest.fn()}
        onComplete={jest.fn()}
        onCompleteStop={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    fireEvent.press(screen.getByTestId('driver-ride-message'));
    expect(onMessage).toHaveBeenCalledTimes(1);
  });
});
