import { useCallback, useState } from 'react';
import {
  HOME_HEADER_ESTIMATE,
  HOME_PEEK_GROUP_ESTIMATE,
  HOME_SERVICE_ROW_ESTIMATE,
  homeHalfMinHeight,
  homePeekHeight,
  type HomeHeaderKind,
} from './layout';

type GroupKind = 'plain' | 'live';
type Measured = {
  header: Partial<Record<HomeHeaderKind, number>>;
  group: Partial<Record<GroupKind, number>>;
  row?: number;
};

const changed = (old: number | undefined, next: number) => old === undefined || Math.abs(old - next) >= 1;

/**
 * The Home sheet's peek and `half` floor (UI-R20b, passenger-home V1): handle + the measured
 * header + the measured peek group (the chip row, the "Return" block while live, and the service
 * row with its gap while it is shown in the peek). One height is kept per header kind and per
 * group kind, so a measurement of one never stands in for another; the 1.0× estimate is used
 * until a kind has been measured. A height counts only when it moves by 1pt or more, so layout
 * passes never re-place the sheet.
 *
 * `servicesInPeek` follows the service row's own swap (HomeServiceRow `onShown`): on → off it
 * turns false after the cards have faded out, so the sheet eases down once, after the fade.
 */
export function useHomePeek({ headerKind, live, servicesInPeek }: { headerKind: HomeHeaderKind; live: boolean; servicesInPeek: boolean }) {
  const [measured, setMeasured] = useState<Measured>({ header: {}, group: {} });
  const onHeaderHeight = useCallback(
    (height: number, kind: HomeHeaderKind) =>
      setMeasured(prev => (changed(prev.header[kind], height) ? { ...prev, header: { ...prev.header, [kind]: height } } : prev)),
    [],
  );
  const onGroupHeight = useCallback(
    (height: number, kind: GroupKind) =>
      setMeasured(prev => (changed(prev.group[kind], height) ? { ...prev, group: { ...prev.group, [kind]: height } } : prev)),
    [],
  );
  const onRowHeight = useCallback(
    (height: number) => setMeasured(prev => (changed(prev.row, height) ? { ...prev, row: height } : prev)),
    [],
  );
  const groupKind: GroupKind = live ? 'live' : 'plain';
  const header = measured.header[headerKind] ?? HOME_HEADER_ESTIMATE[headerKind];
  const group = measured.group[groupKind] ?? HOME_PEEK_GROUP_ESTIMATE[groupKind];
  const row = servicesInPeek && !live ? (measured.row ?? HOME_SERVICE_ROW_ESTIMATE) : 0;
  const peek = homePeekHeight({ headerHeight: header, peekGroupHeight: group + row });
  return { peek, halfMin: homeHalfMinHeight(peek), onHeaderHeight, onGroupHeight, onRowHeight };
}
