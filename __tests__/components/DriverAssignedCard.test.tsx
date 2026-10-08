/** T-110 / BE-20: the Call button exists only when the screen has the driver's phone. */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import DriverAssignedCard from '../../src/components/passenger/DriverAssignedCard';

describe('DriverAssignedCard', () => {
  it('hides Call without a phone handler', () => {
    const { queryByTestId } = render(<DriverAssignedCard name="Ali" vehicle="car" eta="4 min" />);
    expect(queryByTestId('driver-call-button')).toBeNull();
  });

  it('shows Call and calls the handler when given', () => {
    const onCall = jest.fn();
    const { getByTestId } = render(<DriverAssignedCard name="Ali" vehicle="car" eta="4 min" onCall={onCall} />);
    fireEvent.press(getByTestId('driver-call-button'));
    expect(onCall).toHaveBeenCalledTimes(1);
  });
});
