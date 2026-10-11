/**
 * T-510: the shared thread screen (header name/photo/call, empty state, "Seen", failed bubble
 * with retry, composer hidden with a read-only notice once the ride ended, 410 expired) and
 * the Chat tab list from GET /chats (rows, unread, empty, error, tap opens the thread). The
 * "Message" entry points on both ride panels open RideChat with the ride id.
 */
import React from 'react';
import { Linking, Text } from 'react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { rootReducer } from '../../../src/store/rootReducer';
import { ApiError } from '../../../src/core/api/errors';
import { chatApi } from '../../../src/features/chat/api';
import ChatThreadScreen from '../../../src/features/chat/screens/ChatThreadScreen';
import ChatListScreen from '../../../src/features/chat/screens/ChatListScreen';
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
    expect(screen.getByTestId('chat-seen')).toHaveTextContent(/Seen/);
    expect(screen.getByTestId('chat-composer')).toBeTruthy();
    expect(screen.queryByTestId('chat-closed-notice')).toBeNull();
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
    expect(screen.getByTestId('chat-closed-notice')).toHaveTextContent(/This ride has ended\. The chat is read-only until/);
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

  it('Call uses the phone from the active ride, only for that ride', async () => {
    jest.spyOn(chatApi, 'getMessages').mockResolvedValue(threadPage());
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const ride = makeRide({ id: 7, status: 'accepted', driver_id: 12, driver: { id: 12, name: 'Bilal', phone: '+923001234567' } });
    await renderWithStore(<ChatThreadScreen />, ride);
    fireEvent.press(screen.getByTestId('chat-call'));
    expect(openURL).toHaveBeenCalledWith('tel:%2B923001234567');
  });

  it('no Call button when the ride in the store is a different one', async () => {
    jest.spyOn(chatApi, 'getMessages').mockResolvedValue(threadPage());
    const ride = makeRide({ id: 99, status: 'accepted', driver_id: 12, driver: { id: 12, name: 'Bilal', phone: '+923001234567' } });
    await renderWithStore(<ChatThreadScreen />, ride);
    expect(screen.queryByTestId('chat-call')).toBeNull();
  });
});

describe('ChatListScreen', () => {
  it('lists chats from GET /chats with unread counts and opens the thread on tap', async () => {
    jest.spyOn(chatApi, 'listChats').mockResolvedValue([
      {
        rideId: 7,
        rideStatus: 'accepted',
        canSend: true,
        readOnlyUntil: null,
        otherParty: { id: 12, role: 'driver', firstName: 'Bilal', profileImageUrl: null },
        lastMessage: theirs(3, 'At the gate'),
        unreadCount: 2,
      },
      {
        rideId: 8,
        rideStatus: 'completed',
        canSend: false,
        readOnlyUntil: '2026-10-12T12:00:00+00:00',
        otherParty: { id: 13, role: 'driver', firstName: null, profileImageUrl: null },
        lastMessage: null,
        unreadCount: 0,
      },
    ]);
    await renderWithStore(<ChatListScreen />);

    expect(screen.getByText('Bilal')).toBeTruthy();
    expect(screen.getByText(/At the gate/)).toBeTruthy();
    expect(screen.getByTestId('chat-unread-7')).toHaveTextContent('2');
    expect(screen.getByText('Your driver')).toBeTruthy();
    expect(screen.getByText('No messages yet')).toBeTruthy();
    expect(screen.getByText('Read-only')).toBeTruthy();

    fireEvent.press(screen.getByTestId('chat-row-7'));
    expect(mockNavigate).toHaveBeenCalledWith('RideChat', { rideId: 7 });
  });

  it('empty: "Chats appear here during a ride"', async () => {
    jest.spyOn(chatApi, 'listChats').mockResolvedValue([]);
    await renderWithStore(<ChatListScreen />);
    expect(screen.getByText('Chats appear here during a ride.')).toBeTruthy();
  });

  it('error: Try again reloads', async () => {
    const list = jest
      .spyOn(chatApi, 'listChats')
      .mockRejectedValueOnce(new ApiError({ kind: 'network', message: 'Network error. Please check your connection.' }))
      .mockResolvedValue([]);
    await renderWithStore(<ChatListScreen />);
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
        phone={null}
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
