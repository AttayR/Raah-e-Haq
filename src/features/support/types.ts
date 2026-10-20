/**
 * Help & support models (UI-R18; BE-17 + BE-130, docs/api/CONTRACT_NOTES.md "Help & support
 * (BE-130) and invite programme (BE-131)"). api.ts maps the wire shapes into these; screens only
 * see these. Agents are never more than "support": no name, email or phone is mapped.
 */

/** The server's ticket statuses; anything else is kept as sent (shown sentence case). */
export type TicketStatus = 'open' | 'in_progress' | 'pending_customer' | 'resolved' | 'closed';

/** One topic of GET /support/categories (already filtered for the caller's role). */
export interface SupportCategory {
  slug: string;
  /** The server's English name: the label when the app has no copy for the slug. */
  name: string;
}

/** The ride a ticket is about (BE-130 b). */
export interface TicketRide {
  id: number;
  pickupAddress: string;
  dropoffAddress: string;
  completedAt: string | null;
}

/** One visible reply of a ticket. */
export interface TicketReply {
  id: number;
  message: string;
  /** `support` (staff) or `customer` (the owner). */
  fromSupport: boolean;
  createdAt: string;
}

export interface SupportTicket {
  id: number;
  ticketNumber: string;
  subject: string;
  description: string;
  category: string;
  status: string;
  ride: TicketRide | null;
  /** The newest visible reply's text (≤120 chars), null before any reply. */
  lastReplyPreview: string | null;
  lastReplyAt: string | null;
  /** A support reply the owner has not opened yet. */
  unread: boolean;
  createdAt: string;
  updatedAt: string | null;
  /** Only on GET /support/tickets/{id}. */
  replies: TicketReply[];
}

export interface TicketPage {
  items: SupportTicket[];
  page: number;
  lastPage: number;
  total: number;
}

export interface NewTicketInput {
  category: string;
  subject: string;
  description: string;
  rideId: number | null;
}

/** The support and legal values of GET /settings/public (null when not set). */
export interface SupportContacts {
  supportPhone: string | null;
  supportEmail: string | null;
  supportWhatsapp: string | null;
  supportHours: string | null;
  termsUrl: string | null;
  privacyUrl: string | null;
}
