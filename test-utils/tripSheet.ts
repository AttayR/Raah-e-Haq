import { act, fireEvent, screen } from '@testing-library/react-native';

const layout = (testID: string, height: number) => {
  const node = screen.getByTestId(testID, { includeHiddenElements: true });
  act(() => {
    fireEvent(node, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height } } });
  });
};

/**
 * Expands a trip sheet (shared-trip-sheet TS1) the way a screen-reader user does: the sheet is laid
 * out (container, header, peek group, body), then the handle's adjustable "increment" action takes
 * it from `peek` to `expanded`, where the details (Cancel, TS8) become reachable. `testID` is the
 * TripSheet's (`driver-ride-panel` for the driver, `trip-sheet` for the passenger).
 */
export const expandTripSheet = (testID = 'driver-ride-panel') => {
  // The container is the sheet's parent absolute-fill view (BottomSheet map mode).
  const sheet = screen.getByTestId(testID, { includeHiddenElements: true });
  act(() => {
    fireEvent(sheet.parent!.parent!, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 874 } } });
  });
  layout(`${testID}-header`, 80);
  // TripSheet measures its own header block (inside the BottomSheet header) for the peek height.
  const header = screen.getByTestId(`${testID}-header`, { includeHiddenElements: true });
  const inner = header.findAll((node) => typeof node.props.onLayout === 'function' && node !== header)[0];
  if (!inner) throw new Error(`expandTripSheet: no measured header block in ${testID}`);
  act(() => {
    fireEvent(inner, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 80 } } });
  });
  layout(`${testID}-peek`, 300);
  layout(`${testID}-body`, 600);
  act(() => {
    fireEvent(screen.getByTestId(`${testID}-handle`), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
  });
};
