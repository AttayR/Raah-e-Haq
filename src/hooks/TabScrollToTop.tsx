import React, { useContext } from 'react';
import { NavigationContext, useScrollToTop } from '@react-navigation/native';

type ScrollTarget = Parameters<typeof useScrollToTop>[0];

function ScrollToTopListener({ scrollRef }: { scrollRef: ScrollTarget }) {
  useScrollToTop(scrollRef);
  return null;
}

/**
 * T-577: tapping the tab that is already selected scrolls this list back to the top (React
 * Navigation's useScrollToTop, as on the Account tab via useTabScrollReset). Render it next to a
 * tab-root list (Activity rides and wallet, Inbox lists, Earnings). Outside a navigator (a list
 * rendered on its own) it renders nothing, and pushed above the tabs (a stack screen) the hook
 * finds no tab navigator and does nothing.
 */
export function TabScrollToTop({ scrollRef }: { scrollRef: ScrollTarget }) {
  const navigation = useContext(NavigationContext);
  if (navigation === undefined) return null;
  return <ScrollToTopListener scrollRef={scrollRef} />;
}
