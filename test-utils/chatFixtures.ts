/** Wire and model fixtures for the chat tests (fake local data only). Not a test file. */
import type { ChatMessage, ChatThreadPage } from '../src/features/chat/types';

export const wireMessage = (overrides: Record<string, unknown> = {}) => ({
  id: 41,
  ride_id: 7,
  client_id: null,
  sender_id: 12,
  sender_role: 'driver',
  is_mine: false,
  body: 'On my way',
  created_at: '2026-10-11T12:00:00+00:00',
  read_at: null,
  ...overrides,
});

export const message = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 41,
  rideId: 7,
  clientId: null,
  senderId: 12,
  senderRole: 'driver',
  isMine: false,
  body: 'On my way',
  createdAt: '2026-10-11T12:00:00+00:00',
  readAt: null,
  ...overrides,
});

export const mine = (id: number, clientId: string | null = null, body = `mine ${id}`): ChatMessage =>
  message({ id, clientId, isMine: true, senderId: 9, senderRole: 'passenger', body });

export const theirs = (id: number, body = `theirs ${id}`, readAt: string | null = null): ChatMessage =>
  message({ id, body, readAt });

export const threadPage = (overrides: Partial<ChatThreadPage> = {}): ChatThreadPage => ({
  rideId: 7,
  rideStatus: 'accepted',
  canSend: true,
  readOnlyUntil: null,
  contactClosesAt: null,
  otherParty: { id: 12, role: 'driver', firstName: 'Bilal', profileImageUrl: null },
  otherPartyReadUpToId: 0,
  messages: [],
  hasMore: false,
  lastId: 0,
  ...overrides,
});
