/**
 * T-510: the BE-13 chat endpoints are called with the documented shapes and mapped into typed
 * models; malformed rows are dropped and refusals keep their server code.
 */
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../../../src/services/api';
import { isApiError } from '../../../src/core/api/errors';
import { CHAT_CODES, chatApi } from '../../../src/features/chat/api';
import { CLIENT_ID_PATTERN, createClientId } from '../../../src/features/chat/clientId';
import { envelope } from '../../../test-utils/rideFixtures';
import { wireMessage } from '../../../test-utils/chatFixtures';

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
});

afterEach(() => {
  mock.restore();
});

describe('chatApi', () => {
  it('GET /chats maps rows and drops ones without a ride id', async () => {
    mock.onGet('/chats').reply(
      200,
      envelope({
        chats: [
          {
            ride_id: 7,
            ride_status: 'accepted',
            can_send: true,
            read_only_until: null,
            other_party: { id: 12, role: 'driver', first_name: 'Bilal', profile_image_url: null },
            last_message: wireMessage(),
            unread_count: 2,
          },
          { ride_id: 8, ride_status: 'completed', can_send: false, read_only_until: '2026-10-12T12:00:00+00:00', contact_closes_at: '2026-10-11T12:30:00+00:00', other_party: null, last_message: null, unread_count: 0 },
          { ride_status: 'accepted' },
        ],
      }),
    );

    const chats = await chatApi.listChats();

    expect(chats).toHaveLength(2);
    expect(chats[0]).toEqual({
      rideId: 7,
      rideStatus: 'accepted',
      canSend: true,
      readOnlyUntil: null,
      contactClosesAt: null,
      otherParty: { id: 12, role: 'driver', firstName: 'Bilal', profileImageUrl: null },
      lastMessage: expect.objectContaining({ id: 41, body: 'On my way', isMine: false, senderRole: 'driver' }),
      unreadCount: 2,
    });
    expect(chats[1]).toMatchObject({ rideId: 8, canSend: false, contactClosesAt: '2026-10-11T12:30:00+00:00', otherParty: null, lastMessage: null });
  });

  it('GET /rides/{id}/messages sends one cursor and the limit, and maps the page', async () => {
    mock.onGet('/rides/7/messages').reply(
      200,
      envelope({
        ride_id: 7,
        ride_status: 'started',
        can_send: true,
        read_only_until: null,
        other_party: { id: 12, role: 'driver', first_name: null, profile_image_url: 'https://example.test/a.jpg' },
        messages: [wireMessage({ id: 42 }), { id: 'x' }, wireMessage({ id: 43, is_mine: true, client_id: 'c-1', sender_role: 'passenger' })],
        has_more: true,
        last_id: 43,
        other_party_read_up_to_id: 40,
      }),
    );

    const page = await chatApi.getMessages(7, { afterId: 41 });

    expect(mock.history.get[0].params).toEqual({ limit: 50, after_id: 41 });
    expect(page.messages.map((m) => m.id)).toEqual([42, 43]);
    expect(page.messages[1]).toMatchObject({ isMine: true, clientId: 'c-1' });
    expect(page).toMatchObject({
      rideStatus: 'started',
      canSend: true,
      hasMore: true,
      lastId: 43,
      otherPartyReadUpToId: 40,
      otherParty: { firstName: null, profileImageUrl: 'https://example.test/a.jpg' },
    });

    await chatApi.getMessages(7, { beforeId: 42, limit: 20 });
    expect(mock.history.get[1].params).toEqual({ limit: 20, before_id: 42 });
  });

  it('POST /rides/{id}/messages sends body + client_id and returns the stored message', async () => {
    mock.onPost('/rides/7/messages').reply(201, envelope({ message: wireMessage({ id: 50, is_mine: true, client_id: 'abc' }) }));

    const sent = await chatApi.sendMessage(7, 'Hello', 'abc');

    expect(JSON.parse(mock.history.post[0].data)).toEqual({ body: 'Hello', client_id: 'abc' });
    expect(sent).toMatchObject({ id: 50, isMine: true, clientId: 'abc' });
  });

  it('a refusal keeps its BE-13 code (409 chat_closed, 429 Retry-After)', async () => {
    mock.onPost('/rides/7/messages').replyOnce(409, { success: false, message: 'Ride ended', error: { code: 'chat_closed' } });
    mock.onPost('/rides/7/messages').replyOnce(429, { success: false, message: 'Slow down', error: { code: 'rate_limited' } }, { 'retry-after': '30' });

    const closed = await chatApi.sendMessage(7, 'Hi', 'a').catch((e: unknown) => e);
    expect(isApiError(closed) && closed.code).toBe(CHAT_CODES.closed);

    const limited = await chatApi.sendMessage(7, 'Hi', 'a').catch((e: unknown) => e);
    expect(isApiError(limited) && limited.kind).toBe('rate_limited');
    expect(isApiError(limited) && limited.retryAfter).toBe(30);
  });

  it('POST /rides/{id}/messages/read sends up_to_id', async () => {
    mock.onPost('/rides/7/messages/read').reply(200, envelope({ ride_id: 7, marked: 3, unread_count: 0 }));

    await expect(chatApi.markRead(7, 45)).resolves.toEqual({ rideId: 7, marked: 3, unreadCount: 0 });
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ up_to_id: 45 });
  });

  it('client ids are v4 UUIDs inside the server pattern, unique per message', () => {
    const ids = new Set(Array.from({ length: 50 }, createClientId));
    expect(ids.size).toBe(50);
    ids.forEach((id) => {
      expect(id).toMatch(CLIENT_ID_PATTERN);
      expect(id).toMatch(/^[A-Za-z0-9._:-]{1,64}$/);
    });
  });
});
