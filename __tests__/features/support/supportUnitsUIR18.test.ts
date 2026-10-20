/**
 * UI-R18 (shared-support-invite §H, BE-130): the support mappers read only what the contract
 * sends (no agent identity, internal notes dropped, https-only legal links), the status pills and
 * topic labels, the 429 wait, and support notifications open the ticket (push + inbox row).
 */
import { ApiError } from '../../../src/core/api/errors';
import { toCategories, toCreateBody, toSupportContacts, toTicket, toTicketPage } from '../../../src/features/support/api';
import { retryMinutes, ticketPreview, ticketStatusPill, topicGlyph, topicLabel } from '../../../src/features/support/format';
import { ticketMessages } from '../../../src/features/support/thread';
import { toAppNotification, toPushPayload } from '../../../src/features/notifications/api';
import { resolveNotificationTarget } from '../../../src/features/notifications/routing';
import { routeForTarget } from '../../../src/features/notifications/navigation';
import { setLocale } from '../../../src/i18n';

const rawTicket = {
  id: 7,
  ticket_number: 'TKT-0007',
  subject: 'Driver took a longer route',
  description: 'The fare was higher than shown.',
  category: 'ride_issue',
  status: 'pending_customer',
  ride: { id: 41, pickup_address: 'Gulberg', dropoff_address: 'DHA', completed_at: '2026-10-19T08:00:00Z' },
  assigned_to: { name: 'Sana', role: 'support' },
  last_reply_preview: 'Can you share the time?',
  last_reply_at: '2026-10-20T09:00:00Z',
  unread: true,
  created_at: '2026-10-19T09:00:00Z',
  updated_at: '2026-10-20T09:00:00Z',
  replies: [
    { id: 1, message: 'Can you share the time?', author_role: 'support', is_internal: false, created_at: '2026-10-20T09:00:00Z', user: { name: 'Sana', role: 'support' } },
    { id: 2, message: 'internal note', author_role: 'support', is_internal: true, created_at: '2026-10-20T09:01:00Z' },
    { id: 3, message: 'Around 8 AM', author_role: 'customer', is_internal: false, created_at: '2026-10-20T09:05:00Z' },
  ],
};

afterEach(() => setLocale('en'));

describe('support mappers (BE-130)', () => {
  it('maps a ticket with its ride and visible replies only, never the agent', () => {
    const ticket = toTicket(rawTicket);
    expect(ticket).toMatchObject({
      id: 7,
      ticketNumber: 'TKT-0007',
      status: 'pending_customer',
      ride: { id: 41, pickupAddress: 'Gulberg', dropoffAddress: 'DHA' },
      unread: true,
      lastReplyPreview: 'Can you share the time?',
    });
    expect(ticket?.replies.map((r) => [r.id, r.fromSupport])).toEqual([
      [1, true],
      [3, false],
    ]);
    expect(JSON.stringify(ticket)).not.toContain('Sana');
  });

  it('reads the list meta for "See all" and paging', () => {
    const page = toTicketPage({ success: true, data: [rawTicket], meta: { current_page: 1, last_page: 2, per_page: 20, total: 23 } }, 1);
    expect(page).toMatchObject({ page: 1, lastPage: 2, total: 23 });
    expect(page.items).toHaveLength(1);
  });

  it('keeps topics with a slug and falls back to the server name for an unknown slug', () => {
    const topics = toCategories([{ slug: 'billing', name: 'Billing' }, { name: 'no slug' }, { slug: 'lost_item', name: 'Lost item' }]);
    expect(topics.map((c) => c.slug)).toEqual(['billing', 'lost_item']);
    expect(topicLabel(topics[0])).toBe('Fare and payment');
    expect(topicLabel(topics[1])).toBe('Lost item');
    expect(topicGlyph('lost_item')).toBe('help');
    setLocale('ur-Latn');
    expect(topicLabel(topics[0])).toBe('Kiraya aur payment');
  });

  it('reads public settings and drops non-https legal links and blank values', () => {
    const contacts = toSupportContacts([
      { key: 'support_phone', value: '+923001112233' },
      { key: 'support_email', value: 'help@example.test' },
      { key: 'support_whatsapp', value: '' },
      { key: 'terms_url', value: 'http://example.test/terms' },
      { key: 'privacy_url', value: 'https://example.test/privacy' },
      { key: 'fare_base', value: '100' },
    ]);
    expect(contacts).toEqual({
      supportPhone: '+923001112233',
      supportEmail: 'help@example.test',
      supportWhatsapp: null,
      supportHours: null,
      termsUrl: null,
      privacyUrl: 'https://example.test/privacy',
    });
  });

  it('sends ride_id only with a trip, and trims the text', () => {
    expect(toCreateBody({ category: 'billing', subject: ' Fare ', description: ' Too high fare ', rideId: null })).toEqual({
      category: 'billing',
      subject: 'Fare',
      description: 'Too high fare',
    });
    expect(toCreateBody({ category: 'billing', subject: 'a', description: 'b', rideId: 41 })).toMatchObject({ ride_id: 41 });
  });
});

describe('support format', () => {
  it('maps every status to a word and tone; unknown statuses read as sent', () => {
    expect(ticketStatusPill('pending_customer')).toEqual({ label: 'Waiting for you', tone: 'warning' });
    expect(ticketStatusPill('resolved')).toEqual({ label: 'Solved', tone: 'success' });
    expect(ticketStatusPill('on_hold')).toEqual({ label: 'On hold', tone: 'neutral' });
    setLocale('ur-Latn');
    expect(ticketStatusPill('closed').label).toBe('Band');
  });

  it('previews the last reply, else the description, on one line', () => {
    const ticket = toTicket({ ...rawTicket, last_reply_preview: null, description: 'Line one\nline two' });
    expect(ticket && ticketPreview(ticket)).toBe('Line one line two');
  });

  it('turns a 429 retry_after into whole minutes', () => {
    expect(retryMinutes(new ApiError({ kind: 'rate_limited', message: 'x', status: 429, retryAfter: 125 }))).toBe(3);
    expect(retryMinutes(new ApiError({ kind: 'network', message: 'x' }))).toBeNull();
  });

  it('builds the thread: the description first from the user, then the replies by side', () => {
    const ticket = toTicket(rawTicket);
    const messages = ticket ? ticketMessages(ticket, 'passenger') : [];
    expect(messages.map((m) => [m.body, m.isMine])).toEqual([
      ['The fare was higher than shown.', true],
      ['Can you share the time?', false],
      ['Around 8 AM', true],
    ]);
  });
});

describe('support notifications open the ticket (BE-130 push / inbox)', () => {
  it('reads ticket_id from a push and from an inbox row', () => {
    const push = toPushPayload({ notification_id: '5', type: 'support', ticket_id: '7', category: 'system' });
    expect(push.ticketId).toBe(7);
    const row = toAppNotification({ id: 5, type: 'support', category: 'system', title: 'Raah-e-Haq support replied', data: { ticket_id: 7, reply_id: 9 } });
    expect(row?.data.ticketId).toBe(7);
    // Other notifications carry no ticketId key at all.
    expect('ticketId' in toPushPayload({ type: 'ride_completed', ride_id: '3' })).toBe(false);
  });

  it('routes a support notification to SupportTicket on both roles, or to Help without an id', () => {
    for (const role of ['passenger', 'driver'] as const) {
      const target = resolveNotificationTarget({ category: 'system', type: 'support', rideId: null, ticketId: 7 }, role);
      expect(target).toEqual({ kind: 'supportTicket', ticketId: 7 });
      expect(routeForTarget(role, target, true)).toEqual({ screen: 'SupportTicket', params: { id: 7 }, initial: false });
    }
    const noId = resolveNotificationTarget({ category: 'system', type: 'support', rideId: null }, 'passenger');
    expect(routeForTarget('passenger', noId, true)).toEqual({ screen: 'Support', initial: false });
  });
});
