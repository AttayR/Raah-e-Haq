/**
 * UI-R18 (shared-support-invite §H1, §H4, §H5): Help & support from real API data (last trip,
 * topics, 3 newest requests + See all, contact rows from public settings, emergency row last);
 * New request (disabled until valid, ride_id, 422 under the field, 429 wait, success replaces
 * with the thread); the ticket thread (support sender, solved Banner, closed bar, 409
 * TICKET_CLOSED, 429 retry_after, refresh on a support push).
 */
import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { Linking } from 'react-native';
import { apiClient } from '../../../src/services/api';
import { rootReducer } from '../../../src/store/rootReducer';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { clearQueryCache } from '../../../src/core/api/queryCache';
import { toast } from '../../../src/core/toast';
import SupportScreen from '../../../src/features/support/screens/SupportScreen';
import SupportNewRequestScreen from '../../../src/features/support/screens/SupportNewRequestScreen';
import SupportTicketScreen from '../../../src/features/support/screens/SupportTicketScreen';
import { emitSupportReplyPush } from '../../../src/features/support/events';
import { makeRide, page } from '../../../test-utils/rideFixtures';

const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockGoBack = jest.fn();
let mockParams: Record<string, unknown> | undefined;
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
  usePreventRemove: jest.fn(),
  useRoute: () => ({ params: mockParams }),
  useNavigation: () => ({
    navigate: mockNavigate,
    replace: mockReplace,
    goBack: mockGoBack,
    setOptions: jest.fn(),
    dispatch: jest.fn(),
  }),
}));

const ticket = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  ticket_number: `TKT-${id}`,
  subject: `Request ${id}`,
  description: 'Something happened on the way.',
  category: 'billing',
  status: 'open',
  ride: null,
  last_reply_preview: null,
  last_reply_at: null,
  unread: false,
  created_at: '2026-10-19T09:00:00Z',
  updated_at: '2026-10-19T09:00:00Z',
  replies: [],
  ...over,
});

const categories = [
  { slug: 'ride_issue', name: 'Ride Issues' },
  { slug: 'billing', name: 'Billing' },
  { slug: 'general', name: 'General' },
];

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  });
};

const renderWith = async (Component: React.ComponentType) => {
  render(
    <Provider store={configureStore({ reducer: rootReducer })}>
      <ThemeProvider>
        <Component />
      </ThemeProvider>
    </Provider>,
  );
  await flush();
};

let mock: MockAdapter;
beforeEach(() => {
  clearQueryCache();
  mock = new MockAdapter(apiClient);
  mockNavigate.mockClear();
  mockReplace.mockClear();
  mockParams = undefined;
  mock.onGet('/support/categories').reply(200, { success: true, data: categories });
  mock.onGet('/settings/public').reply(200, {
    success: true,
    data: [
      { key: 'support_phone', value: '+923001112233' },
      { key: 'support_email', value: 'help@example.test' },
      { key: 'support_hours', value: '9 AM to 9 PM, every day' },
    ],
  });
});
afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

describe('Help & support (§H1)', () => {
  it('shows the last trip, topics, the 3 newest requests with See all, contacts and emergency last', async () => {
    mock.onGet('/rides').reply(200, page([makeRide({ id: 41, status: 'completed' })]));
    mock.onGet('/support/tickets').reply(200, {
      success: true,
      data: [ticket(1, { unread: true, status: 'pending_customer' }), ticket(2), ticket(3), ticket(4)],
      meta: { current_page: 1, last_page: 1, per_page: 20, total: 4 },
    });
    await renderWith(SupportScreen);

    expect(screen.getByTestId('support-trip-card')).toBeTruthy();
    expect(screen.getByTestId('support-topic-billing')).toHaveTextContent(/Fare and payment/);
    expect(screen.getByTestId('support-ticket-1')).toBeTruthy();
    expect(screen.getByTestId('support-ticket-1-unread')).toBeTruthy();
    expect(screen.getByTestId('support-ticket-1-status')).toHaveTextContent(/Waiting for you/);
    expect(screen.getByTestId('support-ticket-1').props.accessibilityLabel).toContain('Waiting for you');
    expect(screen.queryByTestId('support-ticket-4')).toBeNull();
    expect(screen.getByTestId('support-see-all')).toBeTruthy();
    expect(screen.getByTestId('support-contact-phone')).toHaveTextContent(/\+92 300 1112233/);
    expect(screen.getByTestId('support-contact-hours')).toHaveTextContent(/9 AM to 9 PM, every day/);
    expect(screen.queryByTestId('support-contact-whatsapp')).toBeNull();

    // The emergency group is the last section.
    // Depth-first order of every node with a test id (on-screen order).
    const ids = screen.UNSAFE_root.findAll((node) => typeof node.props.testID === 'string').map((node) => node.props.testID as string);
    const order = ['support-trip', 'support-topics', 'support-requests-section', 'support-contact', 'support-emergency'].map((id) =>
      ids.indexOf(id),
    );
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(screen.getByTestId('support-emergency-call').props.accessibilityLabel).toBe('Call Police, 15');

    fireEvent.press(screen.getByTestId('support-trip-card'));
    expect(mockNavigate).toHaveBeenCalledWith('SupportNewRequest', { trip: expect.objectContaining({ id: 41 }) });
    fireEvent.press(screen.getByTestId('support-topic-billing'));
    expect(mockNavigate).toHaveBeenCalledWith('SupportNewRequest', { category: 'billing' });
    fireEvent.press(screen.getByTestId('support-ticket-2'));
    expect(mockNavigate).toHaveBeenCalledWith('SupportTicket', { id: 2 });
    fireEvent.press(screen.getByTestId('support-see-all'));
    expect(mockNavigate).toHaveBeenCalledWith('SupportRequests');
  });

  it('hides the trip without rides, shows the empty requests state and dials 15 directly', async () => {
    mock.onGet('/rides').reply(200, page([]));
    mock.onGet('/support/tickets').reply(200, { success: true, data: [], meta: { total: 0 } });
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await renderWith(SupportScreen);
    expect(screen.queryByTestId('support-trip')).toBeNull();
    expect(screen.getByTestId('support-requests-empty')).toBeTruthy();
    fireEvent.press(screen.getByTestId('support-emergency-call'));
    expect(openURL).toHaveBeenCalledWith('tel:15');
    fireEvent.press(screen.getByTestId('support-contact-email'));
    expect(openURL).toHaveBeenCalledWith('mailto:help@example.test?subject=Raah-e-Haq%20support');
  });

  it('replaces the topics with "Write to us" and shows a retry when requests fail', async () => {
    mock.onGet('/rides').reply(200, page([]));
    mock.onGet('/support/categories').reply(500);
    mock.onGet('/support/tickets').reply(500);
    await renderWith(SupportScreen);
    expect(screen.getByTestId('support-write-to-us')).toBeTruthy();
    expect(screen.getByTestId('support-requests-error')).toBeTruthy();
  });
});

describe('New request (§H4)', () => {
  const fill = (subject: string, description: string) => {
    fireEvent.changeText(screen.getByTestId('support-new-subject'), subject);
    fireEvent.changeText(screen.getByTestId('support-new-description'), description);
  };

  it('stays disabled until valid, sends ride_id and replaces itself with the thread', async () => {
    mockParams = { trip: { id: 41, pickupAddress: 'Gulberg', dropoffAddress: 'DHA', at: null }, category: 'ride_issue' };
    let body: Record<string, unknown> = {};
    mock.onPost('/support/tickets').reply((config) => {
      body = JSON.parse(config.data);
      return [201, { success: true, data: ticket(9) }];
    });
    const success = jest.spyOn(toast, 'success');
    await renderWith(SupportNewRequestScreen);

    expect(screen.getByTestId('support-new-send')).toBeDisabled();
    fill('Long route', 'short');
    expect(screen.getByTestId('support-new-send')).toBeDisabled();
    fill('Long route', 'The driver took a much longer route.');
    expect(screen.getByTestId('support-new-description-counter')).toHaveTextContent(/36\/2000/);
    fireEvent.press(screen.getByTestId('support-new-send'));
    await flush();
    expect(body).toEqual({ category: 'ride_issue', subject: 'Long route', description: 'The driver took a much longer route.', ride_id: 41 });
    expect(mockReplace).toHaveBeenCalledWith('SupportTicket', { id: 9 });
    expect(success).toHaveBeenCalledWith("Request sent. We'll reply here.");
  });

  it('a removed trip is not sent; 422 shows under its field; 429 shows the wait in minutes', async () => {
    mockParams = { trip: { id: 41, pickupAddress: 'Gulberg', dropoffAddress: 'DHA', at: null }, category: 'billing' };
    const bodies: Record<string, unknown>[] = [];
    mock
      .onPost('/support/tickets')
      .replyOnce((config) => {
        bodies.push(JSON.parse(config.data));
        return [422, { success: false, message: 'Invalid', errors: { subject: ['The subject is too long.'] } }];
      })
      .onPost('/support/tickets')
      .replyOnce(429, { success: false, code: 'rate_limited', message: 'Too many', retry_after: 1800 });
    await renderWith(SupportNewRequestScreen);
    fireEvent.press(screen.getByTestId('support-new-trip-remove'));
    expect(screen.queryByTestId('support-new-trip')).toBeNull();
    fill('Fare', 'I was charged twice for one ride.');
    fireEvent.press(screen.getByTestId('support-new-send'));
    await flush();
    expect(bodies[0].ride_id).toBeUndefined();
    expect(screen.getByText('The subject is too long.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('support-new-send'));
    await flush();
    expect(screen.getByTestId('support-new-wait')).toHaveTextContent(/You've sent several requests\. Try again in 30 min\./);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe('Ticket thread (§H5)', () => {
  const thread = (over: Record<string, unknown> = {}) => ({
    success: true,
    data: ticket(7, {
      subject: 'Charged twice',
      replies: [{ id: 1, message: 'We are checking it.', author_role: 'support', is_internal: false, created_at: '2026-10-19T10:00:00Z' }],
      ...over,
    }),
  });

  it('shows the summary, my description, support replies with the brand sender, and sends a reply', async () => {
    mockParams = { id: 7 };
    mock.onGet('/support/tickets/7').reply(200, thread());
    mock.onPost('/support/tickets/7/reply').reply(201, {
      success: true,
      data: { id: 2, message: 'Thanks', author_role: 'customer', is_internal: false, created_at: '2026-10-19T11:00:00Z' },
    });
    await renderWith(SupportTicketScreen);
    expect(screen.getByTestId('support-ticket-summary')).toBeTruthy();
    expect(screen.getByTestId('support-ticket-topic')).toHaveTextContent(/Fare and payment/);
    expect(screen.getByText('Something happened on the way.')).toBeTruthy();
    expect(screen.getByText('We are checking it.')).toBeTruthy();
    expect(screen.getAllByTestId('support-sender')).toHaveLength(1);

    fireEvent.changeText(screen.getByTestId('chat-input'), 'Thanks');
    await act(async () => {
      fireEvent.press(screen.getByTestId('chat-send'));
      await new Promise<void>((resolve) => setTimeout(resolve, 150));
    });
    await flush();
    expect(screen.getByText('Thanks')).toBeTruthy();
    expect(screen.queryByTestId('chat-retry-')).toBeNull();
  });

  it('a solved request shows the Banner; a closed one shows the closed bar and New request', async () => {
    mockParams = { id: 7 };
    mock.onGet('/support/tickets/7').replyOnce(200, thread({ status: 'resolved' }));
    await renderWith(SupportTicketScreen);
    expect(screen.getByTestId('support-ticket-resolved')).toBeTruthy();
    expect(screen.getByTestId('chat-composer')).toBeTruthy();

    // A support push for this request re-reads it (no polling).
    mock.onGet('/support/tickets/7').replyOnce(200, thread({ status: 'closed' }));
    await act(async () => emitSupportReplyPush(7));
    await flush();
    expect(screen.queryByTestId('chat-composer')).toBeNull();
    expect(screen.getByTestId('chat-closed-notice')).toHaveTextContent(/This request is closed\. Start a new one if you need help\./);
    fireEvent.press(screen.getByTestId('support-ticket-new'));
    expect(mockNavigate).toHaveBeenCalledWith('SupportNewRequest');
  });

  it('409 TICKET_CLOSED closes the thread; 429 shows how long to wait', async () => {
    mockParams = { id: 7 };
    mock.onGet('/support/tickets/7').reply(200, thread());
    mock
      .onPost('/support/tickets/7/reply')
      .replyOnce(429, { success: false, code: 'rate_limited', message: 'Too many', retry_after: 20 })
      .onPost('/support/tickets/7/reply')
      .replyOnce(409, { success: false, error: { code: 'TICKET_CLOSED', message: 'closed' } });
    await renderWith(SupportTicketScreen);

    const sendText = async (text: string) => {
      fireEvent.changeText(screen.getByTestId('chat-input'), text);
      await act(async () => {
        fireEvent.press(screen.getByTestId('chat-send'));
        await new Promise<void>((resolve) => setTimeout(resolve, 150));
      });
      await flush();
    };
    await sendText('First');
    expect(screen.getByTestId('support-ticket-wait')).toHaveTextContent(/You're replying quickly\. Try again in 20 s\./);
    await sendText('Second');
    expect(screen.queryByTestId('chat-composer')).toBeNull();
    expect(within(screen.getByTestId('chat-closed-notice')).getByText(/This request is closed/)).toBeTruthy();
    expect(screen.queryByText('Second')).toBeNull();
  });
});
