import { useEffect, type RefObject } from 'react';
import { useNavigation, useRoute, useScrollToTop } from '@react-navigation/native';

type Scrollable = { scrollTo: (options: { x?: number; y?: number; animated?: boolean }) => void };

/**
 * T-514: tab-root scroll screens (Account) open at the top. Tab screens stay mounted, so a
 * ScrollView kept the offset it was left at and the screen "opened scrolled down" on the next
 * visit. When the user switches to another TAB the list goes back to the top (no animation, out
 * of sight). A stack screen pushed over the tabs (Account → Profile) also blurs this screen, but
 * the tab navigator still has this tab selected: the offset is kept, so Back returns to the same
 * place and nothing jumps during the push. Tapping the active tab scrolls up (useScrollToTop).
 */
export function useTabScrollReset<T extends Scrollable>(ref: RefObject<T | null>): void {
  const navigation = useNavigation();
  const { key } = useRoute();
  useScrollToTop(ref);
  useEffect(
    () =>
      navigation.addListener('blur', () => {
        // `navigation` is this tab's navigator: blur events follow its committed state, so the
        // selected route is already the new one when the user switched tabs.
        const state = navigation.getState();
        const selected = state ? state.routes[state.index]?.key : undefined;
        if (selected !== key) ref.current?.scrollTo({ y: 0, animated: false });
      }),
    [navigation, key, ref],
  );
}
