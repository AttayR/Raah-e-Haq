/**
 * UI-R18 (shared-support-invite §I): the Invite screen shows the server's code and reward copy
 * from `programme` only; Copy uses the clipboard module (Toast); Share text in the sender's
 * language with the link only when `share_url` is sent; 2 or 3 steps; stats hidden at zero;
 * the PromoCard keeps Copy reachable by VoiceOver.
 */
import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { Share } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { apiClient } from '../../../src/services/api';
import { rootReducer } from '../../../src/store/rootReducer';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { clearQueryCache } from '../../../src/core/api/queryCache';
import { toast } from '../../../src/core/toast';
import { setLocale } from '../../../src/i18n';
import InviteScreen from '../../../src/features/invite/screens/InviteScreen';
import { toInviteCode } from '../../../src/features/invite/api';
import { inviteCardText, inviteShareMessage, inviteSteps } from '../../../src/features/invite/format';
import { PromoCard } from '../../../src/components/ui';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ goBack: jest.fn() }),
}));

const programme = {
  active: true,
  referrer_reward: 150,
  referee_reward: 100,
  currency: 'PKR',
  reward_type: 'ride_credit',
  min_rides: 1,
  expires_days: 30,
};

const codeBody = (over: Record<string, unknown> = {}) => ({
  success: true,
  data: { referral_code: 'R7K2MQ9A', share_url: null, referral_url: null, programme, ...over },
});

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  });
};

const renderInvite = async () => {
  render(
    <Provider store={configureStore({ reducer: rootReducer })}>
      <ThemeProvider>
        <InviteScreen />
      </ThemeProvider>
    </Provider>,
  );
  await flush();
};

let mock: MockAdapter;
beforeEach(() => {
  clearQueryCache();
  mock = new MockAdapter(apiClient);
});
afterEach(() => {
  mock.restore();
  setLocale('en');
  jest.restoreAllMocks();
});

describe('Invite copy from programme (BE-131)', () => {
  it('uses the server amounts, the wallet note for ride credit, and 3 steps with the expiry', () => {
    const invite = toInviteCode(codeBody().data);
    expect(inviteCardText(invite.programme)).toEqual({
      title: 'Get Rs 150 for each friend who rides',
      description: 'Your friend gets Rs 100 off their first ride. Credit goes to your wallet.',
    });
    expect(inviteSteps(invite.programme)).toEqual({
      steps: ['Share your code with a friend.', 'They sign up with your code.', 'After their first ride, you get Rs 150.'],
      expires: 'Rewards expire after 30 days.',
    });
    const many = toInviteCode(codeBody({ programme: { ...programme, min_rides: 3 } }).data);
    expect(inviteSteps(many.programme).steps[2]).toBe('After their first 3 rides, you get Rs 150.');
  });

  it('shows no amounts and two steps when the programme is off', () => {
    const off = toInviteCode(codeBody({ programme: { ...programme, active: false, referrer_reward: 0, referee_reward: 0 } }).data);
    expect(inviteCardText(off.programme)).toEqual({
      title: 'Invite friends to Raah-e-Haq',
      description: 'Share your code. Your friend enters it when they sign up.',
    });
    expect(inviteSteps(off.programme)).toEqual({ steps: ['Share your code with a friend.', 'They sign up with your code.'], expires: null });
  });

  it('adds share_url to the share text only when sent, in the active language', () => {
    expect(inviteShareMessage({ code: 'R7K2', shareUrl: null })).toBe(
      'Ride with me on Raah-e-Haq: fixed fares, pay cash. Use my code R7K2 when you sign up.',
    );
    expect(inviteShareMessage({ code: 'R7K2', shareUrl: 'https://raahehaq.example/get?ref=R7K2' })).toMatch(/sign up\. https:\/\/raahehaq\.example\/get\?ref=R7K2$/);
    setLocale('ur-Latn');
    expect(inviteShareMessage({ code: 'R7K2', shareUrl: null })).toBe(
      'Raah-e-Haq par sawari karein: tay shuda kiraya, cash payment. Sign up par mera code R7K2 likhein.',
    );
  });
});

describe('Invite screen (§I2)', () => {
  it('shows the code, copies it, shares it, and hides the stats at zero', async () => {
    mock.onGet('/referrals/code/mine').reply(200, codeBody());
    mock.onGet('/referrals/stats').reply(200, { success: true, data: { total_referrals: 0, completed_referrals: 0, total_rewards: 0 } });
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    const success = jest.spyOn(toast, 'success');
    await renderInvite();

    expect(screen.getByTestId('invite-code')).toHaveTextContent('R7K2MQ9A');
    expect(screen.getByTestId('invite-code').props.accessibilityLabel).toBe('Your invite code: R, 7, K, 2, M, Q, 9, A');
    expect(screen.getByTestId('invite-step-3')).toBeTruthy();
    expect(screen.queryByTestId('invite-stats')).toBeNull();

    fireEvent.press(screen.getByTestId('invite-copy'));
    expect(Clipboard.setString).toHaveBeenCalledWith('R7K2MQ9A');
    expect(success).toHaveBeenCalledWith('Code copied');

    fireEvent.press(screen.getByTestId('invite-share'));
    expect(share).toHaveBeenCalledWith({ message: expect.stringContaining('Use my code R7K2MQ9A when you sign up.') });
    expect(share.mock.calls[0][0]).toEqual({ message: expect.not.stringContaining('http') });
  });

  it('shows Joined / Took a ride / Earned once someone joined', async () => {
    mock.onGet('/referrals/code/mine').reply(200, codeBody());
    mock.onGet('/referrals/stats').reply(200, { success: true, data: { total_referrals: 2, completed_referrals: 1, total_rewards: 150 } });
    await renderInvite();
    expect(screen.getByTestId('invite-stat-joined').props.accessibilityLabel).toBe('Joined: 2');
    expect(screen.getByTestId('invite-stat-earned').props.accessibilityLabel).toBe('Earned: Rs 150');
  });

  it('shows an error with retry when the code cannot load, and no Share', async () => {
    mock.onGet('/referrals/code/mine').reply(500);
    mock.onGet('/referrals/stats').reply(500);
    await renderInvite();
    expect(screen.getByTestId('invite-error')).toBeTruthy();
    expect(screen.queryByTestId('invite-share')).toBeNull();
  });
});

describe('PromoCard childrenInteractive (kit delta)', () => {
  const renderCard = async (card: React.ReactElement) => {
    render(
      <Provider store={configureStore({ reducer: rootReducer })}>
        <ThemeProvider>{card}</ThemeProvider>
      </Provider>,
    );
    await flush();
  };

  it('is not one accessibility element, so a control inside stays reachable', async () => {
    await renderCard(<PromoCard kind="invite" title="T" description="D" childrenInteractive testID="promo" />);
    expect(screen.getByTestId('promo').props.accessible).toBe(false);
    expect(screen.getByTestId('promo-text').props.accessible).toBe(true);
    expect(screen.getByTestId('promo-text').props.accessibilityLabel).toBe('T. D');
  });

  it('stays one element by default', async () => {
    await renderCard(<PromoCard title="T" description="D" testID="promo" />);
    expect(screen.getByTestId('promo').props.accessible).toBe(true);
  });
});
