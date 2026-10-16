/**
 * T-555 (BE-89): a chat message with `safety_warning` is parsed from every source (thread page,
 * POST answer, GET /chats last_message) and shows a small warning note under its bubble. The
 * wording is the app's own, chosen by `code` + `sender_id`: the recipient is told never to send
 * money, the sender that asking for transfers isn't allowed. The server's `message` is ignored
 * for a known code, because the socket event always carries the recipient's wording.
 */
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import MockAdapter from 'axios-mock-adapter';
import { act, render, screen } from '@testing-library/react-native';
import { apiClient } from '../../../src/services/api';
import { rootReducer } from '../../../src/store/rootReducer';
import { chatApi, toChatMessage, toChatSafetyWarning } from '../../../src/features/chat/api';
import { chatSafetyNoteOf } from '../../../src/features/chat/safety';
import { MessageBubble } from '../../../src/features/chat/components/MessageBubble';
import ChatThreadScreen from '../../../src/features/chat/screens/ChatThreadScreen';
import { en } from '../../../src/i18n';
import { envelope, makePassenger } from '../../../test-utils/rideFixtures';
import { message, threadPage, wireMessage } from '../../../test-utils/chatFixtures';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => true }),
  useRoute: () => ({ key: 'RideChat-1', name: 'RideChat', params: { rideId: 7 } }),
  useIsFocused: () => true,
}));

const RECIPIENT = en.chatSafety.moneyRecipient;
const SENDER = en.chatSafety.moneySender;
/** What the socket event (and a REST page for the recipient) says: the recipient's wording. */
const SERVER_RECIPIENT_TEXT = 'Be careful: never send money by JazzCash, Easypaisa or bank transfer to anyone from a ride.';
const moneyWarning = { code: 'money_transfer_request', message: SERVER_RECIPIENT_TEXT };

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 8; i += 1) {
      await Promise.resolve();
    }
  });
};

describe('safety_warning parsing', () => {
  it('maps {code, message}; null, missing or malformed means no warning', () => {
    expect(toChatMessage(wireMessage({ safety_warning: moneyWarning }))?.safetyWarning).toEqual(moneyWarning);
    expect(toChatMessage(wireMessage({ safety_warning: null }))?.safetyWarning).toBeNull();
    expect(toChatMessage(wireMessage({ safety_warning: undefined }))?.safetyWarning).toBeNull();
    expect(toChatSafetyWarning('money_transfer_request')).toBeNull();
    expect(toChatSafetyWarning({ code: '' })).toBeNull();
    expect(toChatSafetyWarning({ code: 'money_transfer_request' })).toEqual({ code: 'money_transfer_request', message: '' });
  });

  it('reaches the thread page, the POST answer and GET /chats last_message', async () => {
    const mock = new MockAdapter(apiClient);
    try {
      const flagged = wireMessage({ body: 'Send 500 on JazzCash first', safety_warning: moneyWarning });
      mock.onGet('/rides/7/messages').reply(200, envelope({ ride_id: 7, messages: [flagged], last_id: 41 }));
      mock.onPost('/rides/7/messages').reply(201, envelope({ message: { ...flagged, is_mine: true, client_id: 'c-1' } }));
      mock.onGet('/chats').reply(200, envelope({ chats: [{ ride_id: 7, last_message: flagged, unread_count: 1 }] }));

      expect((await chatApi.getMessages(7)).messages[0].safetyWarning?.code).toBe('money_transfer_request');
      expect((await chatApi.sendMessage(7, 'Send 500 on JazzCash first', 'c-1')).safetyWarning?.code).toBe(
        'money_transfer_request',
      );
      expect((await chatApi.listChats())[0].lastMessage?.safetyWarning?.code).toBe('money_transfer_request');
    } finally {
      mock.restore();
    }
  });
});

describe('chatSafetyNoteOf', () => {
  it('keys on code + sender_id, not on the server wording', () => {
    const fromDriver = message({ senderId: 12, isMine: false, safetyWarning: moneyWarning });
    // The passenger (id 9) received it: recipient copy.
    expect(chatSafetyNoteOf(fromDriver, 9)).toEqual({ audience: 'recipient', text: RECIPIENT });
    // The driver (id 12) sent it: sender copy, even though the socket text is the recipient's.
    expect(chatSafetyNoteOf(fromDriver, 12)).toEqual({ audience: 'sender', text: SENDER });
  });

  it('falls back to is_mine without a viewer id; no warning, no note', () => {
    expect(chatSafetyNoteOf(message({ isMine: true, safetyWarning: moneyWarning }), null)?.audience).toBe('sender');
    expect(chatSafetyNoteOf(message({ isMine: false, safetyWarning: moneyWarning }), undefined)?.audience).toBe('recipient');
    expect(chatSafetyNoteOf(message({ safetyWarning: null }), 9)).toBeNull();
  });

  it('an unknown code shows the server text when there is one', () => {
    expect(chatSafetyNoteOf(message({ safetyWarning: { code: 'other', message: 'Be careful.' } }), 9)).toEqual({
      audience: 'recipient',
      text: 'Be careful.',
    });
    expect(chatSafetyNoteOf(message({ safetyWarning: { code: 'other', message: ' ' } }), 9)).toBeNull();
  });
});

describe('MessageBubble safety note', () => {
  const renderBubble = (viewerId: number | null, isMine: boolean, warning: typeof moneyWarning | null) =>
    render(
      <MessageBubble
        item={{ kind: 'message', key: 'm-41', message: message({ senderId: 12, isMine, safetyWarning: warning }) }}
        seen={false}
        onRetry={jest.fn()}
        viewerId={viewerId}
      />,
    );

  it('the recipient sees "never send money" as an accessible note under the bubble', () => {
    renderBubble(9, false, moneyWarning);
    const note = screen.getByTestId('chat-safety-m-41');
    expect(screen.getByTestId('chat-safety-recipient')).toHaveTextContent(RECIPIENT);
    expect(note.props.accessibilityLabel).toBe(`Safety warning: ${RECIPIENT}`);
    expect(screen.queryByText(SERVER_RECIPIENT_TEXT)).toBeNull();
  });

  it('the sender sees "asking for money isn\'t allowed"', () => {
    renderBubble(12, true, moneyWarning);
    expect(screen.getByTestId('chat-safety-sender')).toHaveTextContent(SENDER);
    expect(screen.queryByText(RECIPIENT)).toBeNull();
  });

  it('an ordinary message has no note', () => {
    renderBubble(9, false, null);
    expect(screen.queryByTestId('chat-safety-m-41')).toBeNull();
  });
});

describe('ChatThreadScreen safety note', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(chatApi, 'markRead').mockResolvedValue({ rideId: 7, marked: 0, unreadCount: 0 });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('uses the signed-in user id: the other party\'s flagged message gets the recipient note, mine the sender note', async () => {
    jest.spyOn(chatApi, 'getMessages').mockResolvedValue(
      threadPage({
        messages: [
          message({ id: 1, senderId: 12, isMine: false, body: 'Send advance on Easypaisa', safetyWarning: moneyWarning }),
          message({ id: 2, senderId: 9, senderRole: 'passenger', isMine: true, body: 'Ok send number', safetyWarning: moneyWarning }),
          message({ id: 3, senderId: 12, isMine: false, body: 'At the gate' }),
        ],
        lastId: 3,
      }),
    );
    const initial = rootReducer(undefined, { type: '@@chat-safety-test/init' });
    const store = configureStore({
      reducer: rootReducer,
      preloadedState: {
        ...initial,
        apiAuth: { ...initial.apiAuth, user: makePassenger(9) },
      },
    });
    render(
      <Provider store={store}>
        <ChatThreadScreen />
      </Provider>,
    );
    await flush();

    expect(screen.getByText('Send advance on Easypaisa')).toBeTruthy();
    expect(screen.getByTestId('chat-safety-recipient')).toHaveTextContent(RECIPIENT);
    expect(screen.getByTestId('chat-safety-sender')).toHaveTextContent(SENDER);
    expect(screen.getAllByText(/Never send money|Asking for money/)).toHaveLength(2);
  });
});
