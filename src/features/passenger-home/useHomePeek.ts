import { useCallback, useState } from 'react';
import { HOME_HEADER_ESTIMATE, homeHalfMinHeight, homePeekHeight, type HomeHeaderKind } from './components/HomeSheet';

type Measured = Partial<Record<HomeHeaderKind, number>>;

/**
 * The Home sheet's peek and `half` floor (passenger-home § Services S5), wired to HomeSheetTop's
 * `onHeight` / `onShown`. The peek follows the header that is shown (it swaps after the old one
 * has faded out), so a change eases the sheet once, in step with the header: one height per
 * header kind is kept (a measurement of one kind never stands in for another), with the 1.0×
 * estimate until that kind has been measured. The "Return to your ride" extra goes with the
 * greeting, which shows exactly while a ride is live. A new height counts only when it moves by
 * 1pt or more, so layout passes never re-place the sheet.
 */
export function useHomePeek(initialKind: HomeHeaderKind) {
  const [shown, setShown] = useState<HomeHeaderKind>(initialKind);
  const [measured, setMeasured] = useState<Measured>({});
  const onHeaderHeight = useCallback(
    (height: number, kind: HomeHeaderKind) =>
      setMeasured(prev => {
        const old = prev[kind];
        return old !== undefined && Math.abs(old - height) < 1 ? prev : { ...prev, [kind]: height };
      }),
    [],
  );
  const onHeaderShown = useCallback((kind: HomeHeaderKind) => setShown(kind), []);
  const peek = homePeekHeight({ headerHeight: measured[shown] ?? HOME_HEADER_ESTIMATE[shown], live: shown === 'greeting' });
  return { peek, halfMin: homeHalfMinHeight(peek), onHeaderHeight, onHeaderShown };
}
