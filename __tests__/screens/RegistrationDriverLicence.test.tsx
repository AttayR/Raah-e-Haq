/**
 * T-207 (owner decision 2026-10-11): drivers give a driving licence. The vehicle step has its
 * own licence-number input (no longer the vehicle number) and the documents step marks the
 * licence front picture required; both `*` markers come from the schema (isStepFieldRequired).
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import VehicleInfoStep from '../../src/screens/Auth/steps/VehicleInfoStep';
import DocumentsStep from '../../src/screens/Auth/steps/DocumentsStep';
import { ThemeProvider } from '../../src/app/providers/ThemeProvider';
import {
  INITIAL_REGISTRATION_FORM,
  type RegistrationFormData,
} from '../../src/features/auth/registration/registrationForm';

const driver: RegistrationFormData = { ...INITIAL_REGISTRATION_FORM, role: 'driver' };

const renderInTheme = async (node: React.ReactElement) => {
  render(<ThemeProvider>{node}</ThemeProvider>);
  // ThemeProvider holds children until the stored appearance is read (T-601).
  await act(async () => {});
};

describe('T-207: driving licence inputs', () => {
  it('the vehicle step has a required licence-number input that edits licenseNumber, not vehicleNumber', async () => {
    const onDataChange = jest.fn();
    await renderInTheme(<VehicleInfoStep data={driver} onDataChange={onDataChange} errors={{}} />);

    expect(screen.getByText('Driving License Number *')).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText('As printed on your driving license'), 'LHR-123');
    expect(onDataChange).toHaveBeenLastCalledWith({ licenseNumber: 'LHR-123' });
  });

  it('shows a server or schema error under the licence-number input', async () => {
    await renderInTheme(
      <VehicleInfoStep
        data={driver}
        onDataChange={jest.fn()}
        errors={{ licenseNumber: 'The license number field is required.' }}
      />,
    );
    expect(screen.getByText('The license number field is required.')).toBeTruthy();
  });

  it('the documents step marks the licence front picture required (and shows its error)', async () => {
    await renderInTheme(
      <DocumentsStep
        data={driver}
        onDataChange={jest.fn()}
        errors={{ licenseFrontPicture: 'The license image field is required.' }}
      />,
    );
    expect(screen.getByText('The license image field is required.')).toBeTruthy();
    // One `*` per required driver document: profile picture, CNIC, licence front, vehicle
    // pictures (the licence back stays optional). Before T-207 there were three.
    expect(screen.getAllByText('*')).toHaveLength(4);
  });
});
