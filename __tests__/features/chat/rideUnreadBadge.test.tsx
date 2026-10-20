/**
 * BE-136 app follow-up (shared-trip-sheet.md TS5, TS11): the trip sheet's Message badge comes
 * from the ride read's `chat.unread_count`, on the passenger and the driver sheet. No key (older
 * server) or 0 draws nothing; the count is in the Message action's accessibility label; no
 * `/chats` request is made for it.
 */
import React from 'react';
import { renderHook, render, screen } from '@testing-library/react-native';
import { NavigationContext } from '@react-navigation/native';
import { apiClient } from '../../../src/services/api';
import MockAdapter from 'axios-mock-adapter';
import { PersonCard } from '../../../src/components/ui';
import { rideChatUnread, unreadBadgeCount, withUnreadA11y } from '../../../src/features/chat/rideUnread';
import { passengerTripView, usePassengerTripActions } from '../../../src/features/active-ride/trip/usePassengerTripView';
import { DriverTripSheet } from '../../../src/features/driver-ride/trip/DriverTripSheet';
import type { RideResource } from '../../../src/services/rideService';
import { makeRide } from '../../../test-utils/rideFixtures';

const liveRide = (over: Partial<RideResource> = {}): RideResource =>
  makeRide({ id: 7, status: 'accepted', driver_id: 5, driver: { id: 5, name: 'Ali' }, ...over });

describe('rideChatUnread', () => {
  it('reads chat.unread_count as a whole number ≥ 0; anything else is no count', () => {
    expect(rideChatUnread(liveRide())).toBeNull();
    expect(rideChatUnread(liveRide({ chat: null }))).toBeNull();
    expect(rideChatUnread(liveRide({ chat: {} }))).toBeNull();
    expect(rideChatUnread(liveRide({ chat: { unread_count: -1 } }))).toBeNull();
    expect(rideChatUnread(liveRide({ chat: { unread_count: 0 } }))).toBe(0);
    expect(rideChatUnread(liveRide({ chat: { unread_count: '3' } }))).toBe(3);
    expect(rideChatUnread(null)).toBeNull();
  });

  it('badge only above 0; the label carries the count', () => {
    expect(unreadBadgeCount(null)).toBeUndefined();
    expect(unreadBadgeCount(0)).toBeUndefined();
    expect(unreadBadgeCount(2)).toBe(2);
    expect(withUnreadA11y('Message Ali', 0)).toBe('Message Ali');
    expect(withUnreadA11y('Message Ali', 2)).toBe('Message Ali, 2 unread');
  });
});

describe('passenger trip sheet Message action', () => {
  const navigation = { navigate: jest.fn() } as unknown as React.ContextType<typeof NavigationContext>;
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <NavigationContext.Provider value={navigation}>{children}</NavigationContext.Provider>
  );
  const messageOf = (ride: RideResource) => {
    const view = passengerTripView('driver_en_route', ride, {}, false);
    const { result } = renderHook(() => usePassengerTripActions(view, {}), { wrapper });
    return result.current.find(a => a.key === 'message');
  };

  it('carries the badge from the ride read, none without the key or at 0', () => {
    expect(messageOf(liveRide({ chat: { unread_count: 4 } }))).toMatchObject({ badgeCount: 4, accessibilityLabel: expect.stringContaining('4 unread') });
    expect(messageOf(liveRide({ chat: { unread_count: 0 } }))?.badgeCount).toBeUndefined();
    expect(messageOf(liveRide())?.badgeCount).toBeUndefined();
  });

  it('PersonCard draws the badge on the Message cell (row and inline layouts)', () => {
    const action = { key: 'message', icon: 'chat' as const, label: 'Message', onPress: jest.fn(), badgeCount: 3, testID: 'msg' };
    const { rerender } = render(<PersonCard name="Ali" fallbackName="Driver" actions={[action]} />);
    expect(screen.getByTestId('msg-badge')).toHaveTextContent('3');
    rerender(<PersonCard name="Ali" fallbackName="Driver" actions={[action]} actionsLayout="inline" />);
    // Inline: the badge is a sibling hidden from screen readers (the button's label says the count).
    expect(screen.getByTestId('msg-badge', { includeHiddenElements: true })).toHaveTextContent('3');
    rerender(<PersonCard name="Ali" fallbackName="Driver" actions={[{ ...action, badgeCount: undefined }]} />);
    expect(screen.queryByTestId('msg-badge')).toBeNull();
  });
});

describe('driver trip sheet Message action', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => mock.restore());

  const renderSheet = (ride: RideResource) =>
    render(
      <DriverTripSheet onDone={() => undefined} onRatingChange={() => undefined}
        ride={ride}
        step="to_pickup"
        pendingAction={null}
        canCall={false}
        canNavigate={false}
        onCall={jest.fn()}
        onMessage={jest.fn()}
        onNavigate={jest.fn()}
        onArrived={jest.fn()}
        onStart={jest.fn()}
        onComplete={jest.fn()}
        onCompleteStop={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

  it('shows the ride read count on Message, follows the next read, and makes no /chats request', () => {
    const { rerender } = renderSheet(liveRide({ chat: { unread_count: 2 } }));
    expect(screen.getByTestId('driver-ride-message-badge')).toHaveTextContent('2');
    expect(screen.getByTestId('driver-ride-message').props.accessibilityLabel).toBe('Message the passenger, 2 unread');
    rerender(
      <DriverTripSheet onDone={() => undefined} onRatingChange={() => undefined}
        ride={liveRide({ chat: { unread_count: 0 } })}
        step="to_pickup"
        pendingAction={null}
        canCall={false}
        canNavigate={false}
        onCall={jest.fn()}
        onMessage={jest.fn()}
        onNavigate={jest.fn()}
        onArrived={jest.fn()}
        onStart={jest.fn()}
        onComplete={jest.fn()}
        onCompleteStop={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.queryByTestId('driver-ride-message-badge')).toBeNull();
    expect(mock.history.get.filter(r => (r.url ?? '').includes('/chats'))).toHaveLength(0);
  });

  it('no badge when the read has no chat key', () => {
    renderSheet(liveRide());
    expect(screen.getByTestId('driver-ride-message')).toBeTruthy();
    expect(screen.queryByTestId('driver-ride-message-badge')).toBeNull();
  });
});
