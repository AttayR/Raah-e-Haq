import { useState } from 'react';
import { launchImageLibrary, type ImagePickerResponse } from 'react-native-image-picker';
import { logger } from '../../../core/logging/logger';
import { toast } from '../../../core/toast';
import { DOCUMENT_PICKER_OPTIONS, uploadProblem } from '../../../features/driverDocuments/upload';
import { REGISTRATION_FIELDS } from '../../../features/auth/copy/registrationFields';
import { setVehiclePhoto, type RegistrationFormData } from '../../../features/auth/registration/registrationForm';

/** The single-photo fields of the documents page; `vehiclePictures` is picked per slot. */
export type PhotoField = 'driverPicture' | 'cnicPicture' | 'cnicFrontPicture' | 'cnicBackPicture' | 'licenseFrontPicture' | 'profilePicture';

type Options = {
  data: RegistrationFormData;
  set: <K extends keyof RegistrationFormData>(field: K, value: RegistrationFormData[K]) => void;
  setError: (field: keyof RegistrationFormData, message: string) => void;
};

/**
 * Picks a document photo from the library (T-203): scaled down by the picker, then checked
 * against the server's rule (JPEG/PNG/GIF up to 5 MB) so a refused file says so now, not after
 * Create account. `picking` is true while the library is open (tiles are disabled meanwhile).
 */
export function useDocumentPicker({ data, set, setError }: Options) {
  const [picking, setPicking] = useState(false);

  /** `slot`: for vehicle photos, the tapped side (its index is the side it is sent as). */
  const pick = (field: PhotoField | 'vehiclePictures', slot = 0) => {
    setPicking(true);
    launchImageLibrary(DOCUMENT_PICKER_OPTIONS, (response: ImagePickerResponse) => {
      setPicking(false);
      if (response.didCancel) return;
      // Some providers return an errorMessage but still include a valid asset.
      const asset = response.assets?.[0];
      if (!asset?.uri) {
        logger.debug('Registration photo picker returned no image', { code: response.errorCode });
        toast.error(REGISTRATION_FIELDS.documents.pickFailed);
        return;
      }
      const problem = uploadProblem(asset);
      if (problem) {
        setError(field, problem);
        return;
      }
      if (field === 'vehiclePictures') {
        // Index-stable: the photo replaces the tapped slot only (T-203).
        set('vehiclePictures', setVehiclePhoto(data.vehiclePictures || [], slot, asset.uri));
      } else {
        set(field, asset.uri);
      }
    });
  };

  /** Clears one vehicle slot; the other sides keep their photos and positions. */
  const removeVehicle = (index: number) => set('vehiclePictures', setVehiclePhoto(data.vehiclePictures || [], index, ''));

  return { picking, pick, removeVehicle };
}
