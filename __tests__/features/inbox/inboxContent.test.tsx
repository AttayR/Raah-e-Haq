/**
 * UI-R14: Inbox content pieces. Notification day grouping and category tones, the notification
 * row (unread dot, long press marks read, card corners), chat thread rows (runs and day pills),
 * the Messages row time, and the bubble's sending / failed / read states.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { groupNotificationsByDay, notificationTone } from '../../../src/features/notifications/format';
import { NotificationRow, rowPosition } from '../../../src/features/notifications/components/NotificationRow';
import type { AppNotification } from '../../../src/features/notifications/types';
import { chatRowsNewestFirst, RUN_GAP_MS } from '../../../src/features/chat/rows';
import { threadItemsNewestFirst, type ThreadItem } from '../../../src/features/chat/thread';
import { formatChatListTime } from '../../../src/features/chat/copy';
import { MessageBubble } from '../../../src/features/chat/components/MessageBubble';
import { chatSections } from '../../../src/features/chat/components/ChatList';
import { QuickReplies } from '../../../src/features/chat/components/QuickReplies';
import { message } from '../../../test-utils/chatFixtures';

const notification = (id: number, createdAt: string, overrides: Partial<AppNotification> = {}): AppNotification => ({
  id,
  type: 'driver_arrived',
  category: 'ride',
  title: `Title ${id}`,
  body: `Body ${id}`,
  data: { rideId: 1, stopId: null, messageId: null, fare: null, cancelledBy: null, requeued: false },
  imageUrl: null,
  actionUrl: null,
  actionText: null,
  isBroadcast: false,
  readAt: null,
  createdAt,
  ...overrides,
});

// Local-time ISO strings so day boundaries do not depend on the test machine's zone.
const local = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m, d, h, min).toISOString();
const NOW = new Date(2026, 9, 19, 15, 0);

describe('groupNotificationsByDay', () => {
  it('groups newest-first rows by local day with Today / Yesterday / date titles', () => {
    const sections = groupNotificationsByDay(
      [
        notification(1, local(2026, 9, 19, 14)),
        notification(2, local(2026, 9, 19, 9)),
        notification(3, local(2026, 9, 18, 20)),
        notification(4, local(2026, 9, 10, 8)),
      ],
      NOW,
    );
    expect(sections.map((s) => [s.title, s.data.map((n) => n.id)])).toEqual([
      ['Today', [1, 2]],
      ['Yesterday', [3]],
      ['Sat, 10 Oct', [4]],
    ]);
  });

  it('a day that comes back out of order gets its own section with a unique key; bad dates are undated', () => {
    const sections = groupNotificationsByDay(
      [notification(1, local(2026, 9, 19)), notification(2, local(2026, 9, 18)), notification(3, local(2026, 9, 19)), notification(4, 'nope')],
      NOW,
    );
    expect(new Set(sections.map((s) => s.key)).size).toBe(4);
    expect(sections[3]).toMatchObject({ key: 'undated', title: '' });
  });
});

describe('notificationTone', () => {
  it('gives each category its own glyph and tone (§12.4)', () => {
    expect(notificationTone('ride')).toEqual({ icon: 'rides', tile: 'infoSoft', glyph: 'info' });
    expect(notificationTone('chat')).toEqual({ icon: 'chat', tile: 'primarySoft', glyph: 'onPrimarySoft' });
    expect(notificationTone('wallet')).toEqual({ icon: 'cash', tile: 'successSoft', glyph: 'success' });
    expect(notificationTone('promo')).toEqual({ icon: 'promo', tile: 'warningSoft', glyph: 'warning' });
    expect(notificationTone('system')).toEqual({ icon: 'bell', tile: 'surfaceAlt', glyph: 'textSecondary' });
  });
});

describe('NotificationRow', () => {
  it('unread: dot, spoken "Unread"; press opens; long press marks read without opening', () => {
    const onPress = jest.fn();
    const onMarkRead = jest.fn();
    const item = notification(5, local(2026, 9, 19, 14, 30));
    render(<NotificationRow item={item} onPress={onPress} onMarkRead={onMarkRead} />);
    const row = screen.getByTestId('notification-row-5');
    expect(screen.getByTestId('notification-unread-5')).toBeTruthy();
    expect(row.props.accessibilityLabel).toBe('Unread, Title 5, Body 5, 2:30 PM');
    expect(row.props.accessibilityActions).toEqual([{ name: 'markRead', label: 'Mark as read' }]);

    fireEvent(row, 'longPress');
    expect(onMarkRead).toHaveBeenCalledWith(item);
    expect(onPress).not.toHaveBeenCalled();

    fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'markRead' } });
    expect(onMarkRead).toHaveBeenCalledTimes(2);

    fireEvent.press(row);
    expect(onPress).toHaveBeenCalledWith(item);
  });

  it('read: no dot and no mark-read action', () => {
    render(<NotificationRow item={notification(6, local(2026, 9, 19), { readAt: local(2026, 9, 19) })} onPress={jest.fn()} onMarkRead={jest.fn()} />);
    expect(screen.queryByTestId('notification-unread-6')).toBeNull();
    expect(screen.getByTestId('notification-row-6').props.accessibilityActions).toBeUndefined();
  });

  it('rowPosition rounds the first and last row of a day card', () => {
    expect(rowPosition(0, 1)).toBe('only');
    expect([0, 1, 2].map((i) => rowPosition(i, 3))).toEqual(['first', 'middle', 'last']);
  });
});

describe('chatRowsNewestFirst', () => {
  const items = (messages: ReturnType<typeof message>[]): ThreadItem[] => threadItemsNewestFirst({ messages, pending: [] });

  it('runs: same side, same day, within 5 minutes; the time goes under the newest of a run', () => {
    const rows = chatRowsNewestFirst(
      items([
        message({ id: 1, createdAt: local(2026, 9, 19, 10, 0) }),
        message({ id: 2, createdAt: local(2026, 9, 19, 10, 2) }),
        message({ id: 3, createdAt: new Date(new Date(2026, 9, 19, 10, 2).getTime() + RUN_GAP_MS + 1000).toISOString() }),
        message({ id: 4, isMine: true, createdAt: local(2026, 9, 19, 10, 9) }),
      ]),
      NOW,
    );
    const bubbles = rows.filter((r) => r.kind === 'bubble');
    expect(bubbles.map((r) => r.kind === 'bubble' && [r.key, r.firstInRun, r.lastInRun, r.mine])).toEqual([
      ['m-4', true, true, true],
      ['m-3', true, true, false],
      ['m-2', false, true, false],
      ['m-1', true, false, false],
    ]);
  });

  it('a day pill follows each day\'s oldest message (it sits above it in the inverted list)', () => {
    const rows = chatRowsNewestFirst(
      items([
        message({ id: 1, createdAt: local(2026, 9, 18, 22) }),
        message({ id: 2, createdAt: local(2026, 9, 19, 9) }),
        message({ id: 3, createdAt: local(2026, 9, 19, 9, 1) }),
      ]),
      NOW,
    );
    expect(rows.map((r) => (r.kind === 'day' ? `day:${r.label}` : r.key))).toEqual(['m-3', 'm-2', 'day:Today', 'm-1', 'day:Yesterday']);
  });
});

describe('formatChatListTime', () => {
  it('today the time, then "Yesterday", then the date', () => {
    expect(formatChatListTime(local(2026, 9, 19, 9, 5), NOW)).toBe('9:05 AM');
    expect(formatChatListTime(local(2026, 9, 18, 9, 5), NOW)).toBe('Yesterday');
    expect(formatChatListTime(local(2026, 9, 2, 9, 5), NOW)).toBe('2 Oct');
    expect(formatChatListTime(local(2025, 9, 2, 9, 5), NOW)).toBe('2 Oct 2025');
    expect(formatChatListTime('nope', NOW)).toBe('');
  });
});

describe('chatSections', () => {
  it('rides in progress go under "Current ride", the rest under "Earlier"; empty sections are left out', () => {
    const chat = (rideId: number, rideStatus: string) => ({
      rideId,
      rideStatus,
      canSend: true,
      readOnlyUntil: null,
      contactClosesAt: null,
      otherParty: null,
      lastMessage: null,
      unreadCount: 0,
    });
    expect(chatSections([chat(1, 'ongoing'), chat(2, 'completed'), chat(3, 'accepted')]).map((s) => [s.title, s.data.map((c) => c.rideId)])).toEqual([
      ['Current ride', [1, 3]],
      ['Earlier', [2]],
    ]);
    expect(chatSections([chat(2, 'completed')]).map((s) => s.key)).toEqual(['earlier']);
  });
});

describe('MessageBubble states', () => {
  const pending = (status: 'sending' | 'failed', error: 'network' | 'closed' | null = null): ThreadItem => ({
    kind: 'pending',
    key: 'p-c1',
    pending: { clientId: 'c1', body: 'Hello', createdAt: local(2026, 9, 19, 9, 5), status, error },
  });

  it('sending: time with a clock, spoken "Sending"', () => {
    render(<MessageBubble item={pending('sending')} seen={false} onRetry={jest.fn()} />);
    expect(screen.getByLabelText('9:05 AM, Sending…')).toBeTruthy();
  });

  it('failed and retryable: the spec line in danger, tap retries with the client id', () => {
    const onRetry = jest.fn();
    render(<MessageBubble item={pending('failed', 'network')} seen={false} onRetry={onRetry} />);
    // T-581: the shared-chat-thread copy, not the longer connection hint.
    expect(screen.getByText('Not sent. Tap to retry.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('chat-retry-c1'));
    expect(onRetry).toHaveBeenCalledWith('c1');
  });

  it('failed and final: no retry target', () => {
    render(<MessageBubble item={pending('failed', 'closed')} seen={false} onRetry={jest.fn()} />);
    expect(screen.getByText('Not sent. Chat closed for this ride.')).toBeTruthy();
    expect(screen.queryByTestId('chat-retry-c1')).toBeNull();
  });

  it('yours: sent vs read; a bubble inside a run shows no time', () => {
    const mineItem: ThreadItem = { kind: 'message', key: 'm-9', message: message({ id: 9, isMine: true, createdAt: local(2026, 9, 19, 9, 5) }) };
    const { rerender } = render(<MessageBubble item={mineItem} seen={false} onRetry={jest.fn()} />);
    expect(screen.getByLabelText('9:05 AM, Sent')).toBeTruthy();
    rerender(<MessageBubble item={mineItem} seen={false} read onRetry={jest.fn()} />);
    expect(screen.getByLabelText('9:05 AM, Seen')).toBeTruthy();
    rerender(<MessageBubble item={mineItem} seen={false} lastInRun={false} onRetry={jest.fn()} />);
    expect(screen.queryByText('9:05 AM')).toBeNull();
  });
});

describe('thread item identity (memoised bubbles)', () => {
  it('the same message object keeps the same item across rebuilds; a new object gets a new item', () => {
    const a = message({ id: 1 });
    const b = message({ id: 2 });
    const first = threadItemsNewestFirst({ messages: [a, b], pending: [] });
    const second = threadItemsNewestFirst({ messages: [a, b, message({ id: 3 })], pending: [] });
    expect(second[1]).toBe(first[0]);
    expect(second[2]).toBe(first[1]);
    const replaced = threadItemsNewestFirst({ messages: [a, { ...b }], pending: [] });
    expect(replaced[0]).not.toBe(first[0]);
  });
});

describe('QuickReplies', () => {
  it('a double tap sends once; a refused send can be tapped again', () => {
    const onSend = jest.fn().mockReturnValueOnce(false).mockReturnValue(true);
    render(<QuickReplies role="driver" onSend={onSend} />);
    fireEvent.press(screen.getByText("I've arrived"));
    fireEvent.press(screen.getByText("I've arrived"));
    fireEvent.press(screen.getByText("I'm on my way"));
    expect(onSend.mock.calls).toEqual([["I've arrived"], ["I've arrived"]]);
  });
});
