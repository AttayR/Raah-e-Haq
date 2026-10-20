import { useEffect, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SafeMapViewRef } from '../../SafeMapView';
import type { LatLng } from '../../../features/driver-requests/api';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { space } from '../../../theme';

/**
 * UI-R11 R1: while a request is on the Drive map, the camera fits the driver, the pickup and the
 * drop-off (padding: top `insets.top + 24`, bottom = the request sheet + 24, sides 48), once per
 * request and again only when the sheet height moves by 24 or more. No route request. When the
 * request leaves, `onDone` lets the follow camera centre on the driver again.
 */
export function useRequestFraming({
  mapRef,
  ready,
  requestId,
  points,
  sheetHeight,
  onDone,
}: {
  mapRef: React.RefObject<SafeMapViewRef | null>;
  ready: boolean;
  requestId: number | null;
  points: readonly (LatLng | null)[];
  sheetHeight: number;
  onDone: () => void;
}): void {
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const framed = useRef<{ id: number; height: number } | null>(null);
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (requestId === null) {
      if (framed.current) {
        framed.current = null;
        onDoneRef.current();
      }
      return;
    }
    if (!ready || sheetHeight <= 0) return;
    const last = framed.current;
    if (last && last.id === requestId && Math.abs(last.height - sheetHeight) < space[6]) return;
    const coordinates = pointsRef.current.filter((p): p is LatLng => p !== null);
    if (coordinates.length === 0) return;
    framed.current = { id: requestId, height: sheetHeight };
    mapRef.current?.fitToCoordinates(coordinates, {
      edgePadding: {
        top: insets.top + space[6],
        bottom: sheetHeight + space[6],
        left: space[12],
        right: space[12],
      },
      animated: !reduce,
    });
  }, [insets.top, mapRef, ready, reduce, requestId, sheetHeight]);
}
