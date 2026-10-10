/** T-110 / BE-20: Call only with the driver's phone. T-304: real driver and vehicle, no invented ETA or "Car". */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import DriverAssignedCard from '../../src/components/passenger/DriverAssignedCard';
import type { DriverCardInfo } from '../../src/features/active-ride/stage';

const driver: DriverCardInfo = { name: 'Ali', rating: 4.8, vehicleName: 'Toyota Corolla', color: 'White', plate: 'LEA-1234' };

describe('DriverAssignedCard', () => {
  it('hides Call without a phone handler', () => {
    const { queryByTestId } = render(<DriverAssignedCard driver={driver} />);
    expect(queryByTestId('driver-call-button')).toBeNull();
  });

  it('shows Call and calls the handler when given', () => {
    const onCall = jest.fn();
    const { getByTestId } = render(<DriverAssignedCard driver={driver} onCall={onCall} />);
    fireEvent.press(getByTestId('driver-call-button'));
    expect(onCall).toHaveBeenCalledTimes(1);
  });

  it('shows the server driver, rating, vehicle and plate, and no ETA', () => {
    const { getByText, queryByText } = render(<DriverAssignedCard driver={driver} />);
    expect(getByText('Ali')).toBeTruthy();
    expect(getByText('4.8★')).toBeTruthy();
    expect(getByText('Toyota Corolla · White')).toBeTruthy();
    expect(getByText('Plate LEA-1234')).toBeTruthy();
    expect(queryByText(/ETA|min/)).toBeNull();
  });

  it('leaves out what the server did not send (no "Car" or rating fallback), and hides Message', () => {
    const { queryByTestId, queryByText } = render(
      <DriverAssignedCard driver={{ name: 'Ali', rating: null, vehicleName: null, color: null, plate: null }} />,
    );
    expect(queryByTestId('driver-rating')).toBeNull();
    expect(queryByTestId('driver-vehicle')).toBeNull();
    expect(queryByTestId('driver-plate')).toBeNull();
    expect(queryByText(/Car/)).toBeNull();
    expect(queryByText('Message')).toBeNull();
  });
});
