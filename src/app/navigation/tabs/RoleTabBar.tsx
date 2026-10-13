import React from 'react';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { TabBar, type IconName, type TabBarItem } from '../../../components/ui';
import { t, type TranslationKey } from '../../../i18n';

/** One tab of a role (DESIGN_SYSTEM §8.1): route name, label key and the two MDI glyphs. */
export type RoleTabSpec = {
  name: string;
  label: TranslationKey;
  icon: IconName;
  activeIcon: IconName;
};

/** Passenger: Home · Activity · Inbox · Account. */
export const PASSENGER_TABS: ReadonlyArray<RoleTabSpec> = [
  { name: 'Home', label: 'nav.home', icon: 'home', activeIcon: 'homeActive' },
  { name: 'Activity', label: 'nav.activity', icon: 'activity', activeIcon: 'activityActive' },
  { name: 'Inbox', label: 'nav.inbox', icon: 'inbox', activeIcon: 'inboxActive' },
  { name: 'Account', label: 'nav.account', icon: 'accountCircle', activeIcon: 'accountCircleActive' },
];

/** Driver: Drive · Earnings · Inbox · Account (`steering` has no outline variant; the pill carries it). */
export const DRIVER_TABS: ReadonlyArray<RoleTabSpec> = [
  { name: 'Drive', label: 'nav.drive', icon: 'steering', activeIcon: 'steering' },
  { name: 'Earnings', label: 'nav.earnings', icon: 'wallet', activeIcon: 'walletActive' },
  { name: 'Inbox', label: 'nav.inbox', icon: 'inbox', activeIcon: 'inboxActive' },
  { name: 'Account', label: 'nav.account', icon: 'accountCircle', activeIcon: 'accountCircleActive' },
];

export const INBOX_TAB = 'Inbox';

type Props = BottomTabBarProps & {
  specs: ReadonlyArray<RoleTabSpec>;
  /**
   * GET /notifications/unread-count. The server keeps one unread `chat_message` notification per
   * ride with unread messages (BE-13 ChatNotifier), so this one number is unread notifications
   * plus unread chats (§5.3).
   */
  inboxUnread: number;
  hidden?: boolean;
};

/**
 * React Navigation adapter for the kit TabBar (§5.3): both role tab navigators pass this as
 * `tabBar`, so the two bars are the same component with different specs. Tab presses follow the
 * library contract (a `tabPress` event that a screen may prevent, then navigate).
 */
export function RoleTabBar({ state, navigation, specs, inboxUnread, hidden }: Props) {
  const items: TabBarItem[] = state.routes.map(route => {
    const spec = specs.find(s => s.name === route.name);
    const label = spec ? t(spec.label) : route.name;
    const isInbox = route.name === INBOX_TAB;
    return {
      key: route.name,
      label,
      icon: spec?.icon ?? 'more',
      activeIcon: spec?.activeIcon ?? 'more',
      badgeCount: isInbox ? inboxUnread : undefined,
      badgeAccessibilityLabel: isInbox ? t('nav.inboxBadgeA11y', { count: inboxUnread }) : undefined,
    };
  });
  const active = state.routes[state.index]?.name ?? '';

  const routeOf = (name: string) => state.routes.find(route => route.name === name);

  return (
    <TabBar
      items={items}
      activeKey={active}
      hidden={hidden}
      accessibilityLabel={t('nav.tabsA11y')}
      onSelect={name => {
        const route = routeOf(name);
        if (!route) return;
        const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        if (name !== active && !event.defaultPrevented) {
          navigation.navigate(route.name, route.params);
        }
      }}
      onLongPress={name => {
        const route = routeOf(name);
        if (route) navigation.emit({ type: 'tabLongPress', target: route.key });
      }}
    />
  );
}
