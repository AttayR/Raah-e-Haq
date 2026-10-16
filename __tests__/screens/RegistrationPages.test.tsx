/**
 * UI-R7: the wizard's pages per role (passenger 3 steps, driver 5 with the vehicle step shown as
 * "Vehicle & licence" + "Payout"), page validation, where a 422 or the final re-check lands, and
 * the Review page (masked CNIC and account, Edit jumps to the page).
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../src/app/providers/ThemeProvider';
import {
  firstInvalidPage,
  pageOfField,
  pageProgress,
  registrationPages,
  validatePage,
} from '../../src/features/auth/registration/pages';
import { INITIAL_REGISTRATION_FORM, type RegistrationFormData } from '../../src/features/auth/registration/registrationForm';
import { hasFormInput } from '../../src/features/auth/registration/useRegistrationWizard';
import ReviewStep, { maskAccount, maskCnic } from '../../src/screens/Auth/steps/ReviewStep';
import PayoutStep from '../../src/screens/Auth/steps/PayoutStep';

const driver: RegistrationFormData = {
  ...INITIAL_REGISTRATION_FORM,
  role: 'driver',
  fullName: 'Test Driver',
  email: 'driver@example.test',
  phoneNumber: '+923009990002',
  cnic: '35202-1234567-1',
  address: 'House 1, Street 2, Lahore',
  dateOfBirth: '1990-01-15',
  gender: 'male',
  password: 'Secret123',
  confirmPassword: 'Secret123',
  vehicleType: 'car',
  vehicleNumber: 'LEA-1234',
  vehicleBrand: 'Toyota',
  vehicleModel: 'Corolla',
  vehicleYear: '2020',
  vehicleColor: 'White',
  licenseNumber: 'LHR-123',
  licenseType: 'LTV',
  licenseExpiryDate: '2099-01-01',
  licensePlate: 'LEA-1234',
  registrationNumber: 'REG-1',
  drivingExperience: '5',
  bankName: 'Test Bank',
  bankBranch: 'Main',
  bankAccountNumber: 'PK36SCBL0000001123456702',
  driverPicture: 'file:///me.jpg',
  cnicPicture: 'file:///cf.jpg',
  cnicBackPicture: 'file:///cb.jpg',
  licenseFrontPicture: 'file:///lf.jpg',
  vehiclePictures: ['file:///1.jpg', 'file:///2.jpg', 'file:///3.jpg', 'file:///4.jpg'],
};

describe('registration pages (UI-R7)', () => {
  it('passengers get 3 counted steps, drivers 5; the role page is not counted', () => {
    expect(registrationPages('passenger')).toEqual(['role', 'personal', 'documents', 'review']);
    expect(registrationPages('driver')).toEqual(['role', 'personal', 'vehicle', 'documents', 'payout', 'review']);
    expect(pageProgress('role', 'driver')).toBeNull();
    expect(pageProgress('personal', 'passenger')).toEqual({ current: 1, total: 3 });
    expect(pageProgress('payout', 'driver')).toEqual({ current: 4, total: 5 });
  });

  it('the vehicle page checks the vehicle and licence fields only; payout the bank fields only', () => {
    const missing = { ...driver, vehicleBrand: '', bankAccountNumber: '' };
    expect(Object.keys(validatePage('vehicle', missing))).toEqual(['vehicleBrand']);
    expect(Object.keys(validatePage('payout', missing))).toEqual(['bankAccountNumber']);
    expect(validatePage('role', missing)).toEqual({});
  });

  it('a refused bank field opens Payout; any vehicle field opens Vehicle first', () => {
    expect(pageOfField('vehicle', 'bankName')).toBe('payout');
    expect(pageOfField('vehicle', 'licenseNumber')).toBe('vehicle');
    expect(pageOfField('personal', 'email')).toBe('personal');
    expect(firstInvalidPage({ ...driver, bankBranch: '' })).toEqual({
      page: 'payout',
      errors: { bankBranch: 'Bank branch is required' },
    });
    expect(firstInvalidPage({ ...driver, bankBranch: '', vehicleColor: '' })?.page).toBe('vehicle');
    expect(firstInvalidPage(driver)).toBeNull();
  });

  it('the leave guard only counts details typed, not the role', () => {
    expect(hasFormInput({ ...INITIAL_REGISTRATION_FORM, role: 'driver' })).toBe(false);
    expect(hasFormInput({ ...INITIAL_REGISTRATION_FORM, email: 'a@b.test' })).toBe(true);
    expect(hasFormInput({ ...INITIAL_REGISTRATION_FORM, vehiclePictures: ['', 'file:///x.jpg'] })).toBe(true);
  });
});

describe('ReviewStep (UI-R7)', () => {
  it('masks the CNIC and the account, keeping the last digits', () => {
    expect(maskCnic('35202-1234567-1')).toBe('•••••-•••••••-1');
    expect(maskAccount('PK36SCBL0000001123456702')).toBe('•••• 6702');
    expect(maskAccount('')).toBe('');
  });

  it('shows a card per page with Edit links that open that page', async () => {
    const onEdit = jest.fn();
    render(
      <ThemeProvider>
        <ReviewStep data={{ ...driver, vehicleHasAc: true }} onEdit={onEdit} />
      </ThemeProvider>,
    );
    await act(async () => {});
    expect(screen.getByText('•••••-•••••••-1')).toBeTruthy();
    expect(screen.getByText('•••• 6702')).toBeTruthy();
    expect(screen.queryByText('35202-1234567-1')).toBeNull();
    expect(screen.getByTestId('review-vehicle-ac')).toBeTruthy();
    expect(screen.getByText('Toyota Corolla')).toBeTruthy();
    fireEvent.press(screen.getByTestId('review-payout-edit'));
    expect(onEdit).toHaveBeenLastCalledWith('payout');
    fireEvent.press(screen.getByTestId('review-vehicle-edit'));
    expect(onEdit).toHaveBeenLastCalledWith('vehicle');
    expect(screen.getByText('By creating an account you agree to the Terms and Privacy Policy.')).toBeTruthy();
  });

  it('a passenger review has no vehicle or payout card', async () => {
    render(
      <ThemeProvider>
        <ReviewStep data={{ ...INITIAL_REGISTRATION_FORM, fullName: 'Rider' }} onEdit={jest.fn()} />
      </ThemeProvider>,
    );
    await act(async () => {});
    expect(screen.queryByTestId('review-vehicle')).toBeNull();
    expect(screen.queryByTestId('review-payout')).toBeNull();
    expect(screen.getByText('Identity')).toBeTruthy();
    expect(screen.getAllByText('Not provided').length).toBeGreaterThan(0);
  });
});

describe('PayoutStep (UI-R7)', () => {
  it('edits the bank fields, upper-cases an IBAN and shows their errors', async () => {
    const onDataChange = jest.fn();
    render(
      <ThemeProvider>
        <PayoutStep data={driver} onDataChange={onDataChange} errors={{ bankName: 'Bank name is required' }} />
      </ThemeProvider>,
    );
    await act(async () => {});
    expect(screen.getByText('Bank name is required')).toBeTruthy();
    expect(screen.getByText('Bank name *')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('registration-bank-account-input'), 'pk36scbl01');
    expect(onDataChange).toHaveBeenLastCalledWith({ bankAccountNumber: 'PK36SCBL01' });
  });
});
