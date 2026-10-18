import { act, fireEvent, screen } from '@testing-library/react-native';
import { motionPatterns } from '../src/theme';

const layoutEvent = (height: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width: 390, height } } });

/**
 * [T-573] Places the driver cancel / no-show sheet on screen (its Modal container and body are
 * measured, so it settles on a snap) and moves the clock past its arming window: its destructive
 * button takes taps only after that. Returns the clock spy; restore it at the end of the test.
 */
export const settleCancelSheet = (): jest.SpyInstance<number, []> => {
  const sheet = screen.getByTestId('cancel-reason-sheet');
  act(() => {
    if (sheet.parent?.parent) fireEvent(sheet.parent.parent, 'layout', layoutEvent(874));
    fireEvent(screen.getByTestId('cancel-reason-sheet-body'), 'layout', layoutEvent(260));
  });
  const realNow = Date.now.bind(Date);
  return jest.spyOn(Date, 'now').mockImplementation(() => realNow() + motionPatterns.destructiveArmMs);
};
