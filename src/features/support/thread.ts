import type { ChatMessage, ChatRole } from '../chat/types';
import type { SupportTicket } from './types';

/**
 * The ticket as chat messages, oldest first, so the thread reuses the ride chat's bubbles, run
 * grouping and day pills (shared-support-invite §H5, "no fork"). The first message is the
 * ticket's description, from the user; then every visible reply (support's or the user's).
 * Only the fields a bubble reads matter: `rideId` carries the ticket id, `senderId` is unused
 * (0) and `senderRole` is the viewer's role on the user's side (support has no ride role).
 */
export const DESCRIPTION_MESSAGE_ID = 0;

export const ticketMessages = (ticket: SupportTicket, viewerRole: ChatRole): ChatMessage[] => {
  const supportRole: ChatRole = viewerRole === 'driver' ? 'passenger' : 'driver';
  const base = { rideId: ticket.id, clientId: null, senderId: 0, readAt: null, safetyWarning: null };
  const first: ChatMessage = {
    ...base,
    id: DESCRIPTION_MESSAGE_ID,
    senderRole: viewerRole,
    isMine: true,
    body: ticket.description,
    createdAt: ticket.createdAt,
  };
  const replies = ticket.replies.map(
    (reply): ChatMessage => ({
      ...base,
      id: reply.id,
      senderRole: reply.fromSupport ? supportRole : viewerRole,
      isMine: !reply.fromSupport,
      body: reply.message,
      createdAt: reply.createdAt,
    }),
  );
  return ticket.description ? [first, ...replies] : replies;
};
