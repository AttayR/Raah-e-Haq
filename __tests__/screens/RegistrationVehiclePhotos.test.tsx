/**
 * T-203 (reviewer retry 1): vehicle photo slots are index-stable. Removing a photo clears only
 * its slot, a new photo goes into the tapped slot, and the request sends each slot as its own
 * side (vehicle_front/back/left/right_image). The licence back picker is gone (no server field).
 */
import React, { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import DocumentsStep from '../../src/screens/Auth/steps/DocumentsStep';
import { ThemeProvider } from '../../src/app/providers/ThemeProvider';
import {
  INITIAL_REGISTRATION_FORM,
  type RegistrationFormData,
} from '../../src/features/auth/registration/registrationForm';
import { buildRegistrationRequest } from '../../src/features/auth/registration/buildRegistrationRequest';

type PickerCallback = (response: { assets: Array<Record<string, unknown>> }) => void;

/** The next picker call answers with this photo through the callback (as DocumentsStep uses it). */
const nextPhoto = (uri: string) =>
  (launchImageLibrary as jest.Mock).mockImplementationOnce((_options: unknown, callback: PickerCallback) => {
    callback({ assets: [{ uri, type: 'image/jpeg', fileSize: 1000 }] });
    return Promise.resolve({});
  });

let latest: RegistrationFormData;

function Harness() {
  const [form, setForm] = useState<RegistrationFormData>({
    ...INITIAL_REGISTRATION_FORM,
    role: 'driver',
    phoneNumber: '03009990002',
  });
  latest = form;
  return (
    <DocumentsStep
      data={form}
      onDataChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
      errors={{}}
    />
  );
}

const renderStep = async () => {
  render(
    <ThemeProvider>
      <Harness />
    </ThemeProvider>,
  );
  await act(async () => {});
};

const tapSlot = async (index: number, uri: string) => {
  nextPhoto(uri);
  await act(async () => {
    fireEvent.press(screen.getByTestId(`vehicle-photo-slot-${index}`));
  });
};

describe('vehicle photo slots (T-203)', () => {
  it('fill 4, remove Front, pick a new one: it is sent as the front and Right keeps the original', async () => {
    await renderStep();
    await tapSlot(0, 'file:///front.jpg');
    await tapSlot(1, 'file:///back.jpg');
    await tapSlot(2, 'file:///left.jpg');
    await tapSlot(3, 'file:///right.jpg');
    expect(screen.getByText('4/4 pictures uploaded')).toBeTruthy();

    fireEvent.press(screen.getByTestId('vehicle-photo-remove-0'));
    expect(latest.vehiclePictures).toEqual(['', 'file:///back.jpg', 'file:///left.jpg', 'file:///right.jpg']);
    expect(screen.getByText('3/4 pictures uploaded')).toBeTruthy();

    await tapSlot(0, 'file:///front-new.jpg');
    const request = buildRegistrationRequest(latest);
    expect(request).toMatchObject({
      vehicle_front_image: 'file:///front-new.jpg',
      vehicle_back_image: 'file:///back.jpg',
      vehicle_left_image: 'file:///left.jpg',
      vehicle_right_image: 'file:///right.jpg',
    });
  });

  it('a slot filled out of order lands on its own side; empty slots are not sent', async () => {
    await renderStep();
    await tapSlot(3, 'file:///right.jpg');
    expect(latest.vehiclePictures).toEqual(['', '', '', 'file:///right.jpg']);
    const request = buildRegistrationRequest(latest);
    expect(request.vehicle_right_image).toBe('file:///right.jpg');
    expect(request).not.toHaveProperty('vehicle_front_image');
  });

  it('every slot shows its side label, filled or empty; no licence back picker', async () => {
    await renderStep();
    await tapSlot(0, 'file:///front.jpg');
    for (const label of ['Front', 'Back', 'Left side', 'Right side']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.queryByText('License Back')).toBeNull();
  });
});
