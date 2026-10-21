import { useCallback, useState } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

export type BookingSheetHeight = {
  /** T-314: what covers the map, so recentring and fitting keep points above the sheet. */
  sheetHeight: number;
  /** The same on the UI thread: the map's end-side control rides 16 above the sheet (UI-R10). */
  sheetHeightValue: SharedValue<number>;
  /** Sets both (the centre-pin picker's height, the booking sheet's height). */
  setSheetHeight: (height: number) => void;
  /** Sets the React value only (the trip sheet writes `sheetHeightValue` itself). */
  setSheetHeightState: (height: number) => void;
  /**
   * For the booking sheet's `onHeightChange`: sets both, then tells the "Where to?" arrival that
   * the sheet laid out (UI-R9b review: the layout after the keyboard event starts its one move).
   */
  onBookingSheetHeight: (height: number) => void;
};

/** The booking map's sheet height, in React state and on the UI thread. */
export function useBookingSheetHeight(onSheetLayout: () => void): BookingSheetHeight {
  const [sheetHeight, setSheetHeightState] = useState(0);
  const sheetHeightValue = useSharedValue(0);
  const setSheetHeight = useCallback(
    (height: number) => {
      sheetHeightValue.value = height;
      setSheetHeightState(height);
    },
    [sheetHeightValue],
  );
  const onBookingSheetHeight = useCallback(
    (height: number) => {
      setSheetHeight(height);
      onSheetLayout();
    },
    [setSheetHeight, onSheetLayout],
  );
  return { sheetHeight, sheetHeightValue, setSheetHeight, setSheetHeightState, onBookingSheetHeight };
}
