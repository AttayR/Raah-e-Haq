/** UI-R1: Icon renders MaterialCommunityIcons and every semantic name maps to a real MDI glyph. */
import React from 'react';
import { StyleSheet } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import mdiGlyphMap from 'react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { Icon } from '../../../src/components/ui/Icon';
import {
  backGlyph,
  directionalIcons,
  iconGlyphs,
  shouldMirrorIcon,
  type IconName,
} from '../../../src/components/ui/icons';
import { LightTheme } from '../../../src/theme';

const names = Object.keys(iconGlyphs) as IconName[];

describe('icon map', () => {
  it.each(names)('%s maps to a glyph present in the bundled MDI font', name => {
    expect(Object.prototype.hasOwnProperty.call(mdiGlyphMap, iconGlyphs[name])).toBe(true);
  });

  it('keeps the semantic names screens already use', () => {
    const existing: IconName[] = [
      'account', 'back', 'bell', 'car', 'chat', 'bike', 'van', 'chevronEnd', 'check', 'clock', 'help',
      'info', 'lock', 'locate', 'locationOff', 'logout', 'phone', 'pin', 'promo', 'power', 'retry',
      'rides', 'send', 'settings', 'shield', 'star', 'theme', 'wallet', 'warning', 'add', 'bookmark',
      'clear', 'close', 'distance', 'edit', 'history', 'origin', 'refresh', 'savings', 'search',
      'starOutline', 'swap', 'document', 'upload', 'calendar', 'email',
    ];
    existing.forEach(name => expect(iconGlyphs[name]).toBeTruthy());
  });

  it('maps the v1.1 ride-hailing glyphs (DESIGN_SYSTEM §4, §8.1)', () => {
    expect(iconGlyphs.car).toBe('car-side');
    expect(iconGlyphs.bike).toBe('motorbike');
    expect(iconGlyphs.rickshaw).toBe('rickshaw');
    expect(iconGlyphs.van).toBe('van-passenger');
    expect(iconGlyphs.cash).toBe('cash');
    expect(iconGlyphs.steering).toBe('steering');
    expect(iconGlyphs.promo).toBe('tag-outline');
    expect(iconGlyphs.chat).toBe('message-text-outline');
    expect(iconGlyphs.home).toBe('home-outline');
    expect(iconGlyphs.homeActive).toBe('home');
    expect(iconGlyphs.inbox).toBe('inbox-outline');
    expect(iconGlyphs.accountCircle).toBe('account-circle-outline');
  });

  it('uses chevron-left on iOS and arrow-left on Android for back', () => {
    expect(backGlyph('ios')).toBe('chevron-left');
    expect(backGlyph('android')).toBe('arrow-left');
  });

  it('mirrors only direction glyphs, and only in RTL', () => {
    expect(directionalIcons.has('back')).toBe(true);
    expect(shouldMirrorIcon('back', true)).toBe(true);
    expect(shouldMirrorIcon('chevronEnd', true)).toBe(true);
    expect(shouldMirrorIcon('back', false)).toBe(false);
    expect(shouldMirrorIcon('home', true)).toBe(false);
    // T-533: the registration Back / Next arrows.
    expect(shouldMirrorIcon('arrowBack', true)).toBe(true);
    expect(shouldMirrorIcon('arrowForward', true)).toBe(true);
  });
});

describe('Icon', () => {
  it('renders the MDI glyph in the token colour, hidden from screen readers', async () => {
    render(
      <ThemeProvider>
        <Icon name="rickshaw" size={32} color="primaryText" testID="icon" />
      </ThemeProvider>,
    );
    await act(async () => {});
    const icon = screen.getByTestId('icon');
    expect(screen.getByText('rickshaw')).toBeTruthy();
    expect(icon.props.size).toBe(32);
    expect(icon.props.color).toBe(LightTheme.colors.primaryText);
    expect(icon.props.accessible).toBe(false);
    expect(StyleSheet.flatten(icon.props.style)).toBeUndefined();
  });
});
