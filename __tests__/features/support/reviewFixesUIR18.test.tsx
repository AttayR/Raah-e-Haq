/**
 * UI-R18 design review round 1: the ticket meta line leads with the date; a preselected topic chip
 * is scrolled into view and the chip row bleeds to the screen edges; the revealed invite field
 * takes focus once laid out; the invite card's loading state is two skeleton lines with no empty
 * text; an inbox support row uses the lifebuoy glyph on the grey system tile; Help shows a
 * placeholder while the last trip loads.
 */
import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ScrollView, StyleSheet, TextInput } from 'react-native';
import { apiClient } from '../../../src/services/api';
import { rootReducer } from '../../../src/store/rootReducer';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { clearQueryCache } from '../../../src/core/api/queryCache';
import { PromoCard } from '../../../src/components/ui';
import { layout } from '../../../src/theme';
import { toTicket } from '../../../src/features/support/api';
import { ticketMeta } from '../../../src/features/support/format';
import { chipScrollX, TopicChips } from '../../../src/features/support/components/TopicChips';
import InviteCodeField from '../../../src/screens/Auth/steps/InviteCodeField';
import { NotificationRow } from '../../../src/features/notifications/components/NotificationRow';
import SupportScreen from '../../../src/features/support/screens/SupportScreen';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}));

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 8; i += 1) await Promise.resolve();
  });
};

const renderIn = async (node: React.ReactElement) => {
  render(
    <Provider store={configureStore({ reducer: rootReducer })}>
      <ThemeProvider>{node}</ThemeProvider>
    </Provider>,
  );
  await flush();
};

const layoutEvent = (x: number, width: number) => ({ nativeEvent: { layout: { x, y: 0, width, height: 32 } } });

let mock: MockAdapter | null = null;
afterEach(() => {
  mock?.restore();
  mock = null;
  jest.restoreAllMocks();
});

describe('ticket meta (§H2)', () => {
  it('is "{date} · #{number}", so a long number truncates instead of the date', () => {
    const ticket = toTicket({ id: 1, ticket_number: 'TK202645236', subject: 's', created_at: '2026-09-13T10:00:00', status: 'open' });
    expect(ticket && ticketMeta(ticket, new Date('2026-10-20T10:00:00'))).toBe('Sun, 13 Sep · #TK202645236');
  });
});

describe('topic chips (§H4.1, DESIGN_SYSTEM §5.11)', () => {
  const topics = ['ride_issue', 'billing', 'account', 'technical', 'general'].map((slug) => ({ slug, name: slug }));

  it('clamps the scroll so the chip starts at the inset, or the row ends at the edge', () => {
    expect(chipScrollX(300, 700, 402)).toBe(300 - layout.gutter);
    expect(chipScrollX(650, 700, 402)).toBe(700 - 402);
    expect(chipScrollX(10, 700, 402)).toBe(0);
  });

  it('bleeds to the screen edges and scrolls a preselected chip into view once, without animation', async () => {
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => undefined);
    await renderIn(<TopicChips topics={topics} selected="general" onSelect={jest.fn()} />);
    const row = screen.getByTestId('support-new-topics');
    expect(StyleSheet.flatten(row.props.style)).toMatchObject({ marginHorizontal: -layout.gutter });
    expect(StyleSheet.flatten(row.props.contentContainerStyle)).toMatchObject({ paddingHorizontal: layout.gutter });

    fireEvent(row, 'layout', layoutEvent(0, 402));
    fireEvent(row, 'contentSizeChange', 760, 32);
    // The wrapper View around the chip reports its x.
    const wrappers = screen.UNSAFE_root.findAll((node) => typeof node.props.onLayout === 'function' && node.props.testID === undefined);
    wrappers.forEach((node, index) => fireEvent(node, 'layout', layoutEvent(16 + index * 150, 140)));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ x: 760 - 402, animated: false });
  });
});

describe('invite code field (§I4)', () => {
  it('focuses the revealed field once it is laid out', async () => {
    const focus = jest.spyOn(TextInput.prototype, 'focus').mockImplementation(() => undefined);
    await renderIn(<InviteCodeField value="" onChange={jest.fn()} />);
    fireEvent.press(screen.getByTestId('registration-invite-toggle'));
    fireEvent(screen.getByTestId('registration-invite'), 'layout', layoutEvent(0, 343));
    expect(focus).toHaveBeenCalledTimes(1);
    fireEvent(screen.getByTestId('registration-invite'), 'layout', layoutEvent(0, 343));
    expect(focus).toHaveBeenCalledTimes(1);
  });
});

describe('invite card loading (§I2)', () => {
  it('draws two skeleton lines and no text while loading', async () => {
    await renderIn(<PromoCard kind="invite" title="Invite friends" description="Share your code." loading childrenInteractive testID="card" />);
    expect(screen.getByTestId('card-loading')).toBeTruthy();
    expect(screen.queryByText('Invite friends')).toBeNull();
    expect(screen.queryByTestId('card-text')).toBeNull();
  });
});

describe('inbox support row (shared-notifications)', () => {
  it('uses the lifebuoy glyph and the system tile', async () => {
    await renderIn(
      <NotificationRow
        item={{
          id: 5,
          type: 'support',
          category: 'system',
          title: 'Raah-e-Haq support replied',
          body: 'New reply on your request.',
          data: { rideId: null, stopId: null, messageId: null, fare: null, cancelledBy: null, requeued: false, ticketId: 7 },
          imageUrl: null,
          actionUrl: null,
          actionText: null,
          isBroadcast: false,
          readAt: null,
          createdAt: '2026-10-20T10:00:00Z',
        }}
        onPress={jest.fn()}
        onMarkRead={jest.fn()}
      />,
    );
    expect(screen.getByText('lifebuoy')).toBeTruthy();
  });
});

describe('Help last trip placeholder', () => {
  it('holds the trip slot while the recent ride loads', async () => {
    clearQueryCache();
    mock = new MockAdapter(apiClient);
    mock.onGet('/rides').reply(() => new Promise(() => undefined));
    mock.onAny().reply(404);
    await renderIn(<SupportScreen />);
    expect(screen.getByTestId('support-trip-loading')).toBeTruthy();
  });

});
