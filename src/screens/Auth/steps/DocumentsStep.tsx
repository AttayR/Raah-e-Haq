import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Banner, UploadTile } from '../../../components/ui';
import { REGISTRATION_FIELDS } from '../../../features/auth/copy/registrationFields';
import {
  VEHICLE_PHOTO_SLOTS,
  filledVehiclePhotoCount,
  vehiclePhotoSlotLabel,
} from '../../../features/auth/registration/registrationForm';
import { space } from '../../../theme';
import { Anchored, ControlLabel, FieldError, FormGroup, stepStyles, useStepFields, type StepProps } from './stepParts';
import { useDocumentPicker, type PhotoField } from './useDocumentPicker';

const D = REGISTRATION_FIELDS.documents;

/**
 * Documents page (UI-R7, T-203/T-207). Passengers ("Verify your identity"): an optional profile
 * photo and the CNIC front and back. Drivers: their photo, CNIC front and back, driving licence
 * front (required) and the four vehicle sides, each slot index-stable. Required tiles get a `*`
 * from the schema (T-206); a "photo tips" Banner replaces the old guidelines card.
 */
export default function DocumentsStep(props: StepProps) {
  const { data } = props;
  const f = useStepFields('documents', props);
  const { errors } = f;
  const picker = useDocumentPicker({ data, set: f.set, setError: f.setError });

  const tile = (field: PhotoField, label: string) => (
    <Anchored field={field} key={field}>
      <UploadTile
        label={label}
        uri={data[field]}
        onPress={() => picker.pick(field)}
        required={f.required(field)}
        error={errors[field]}
        disabled={picker.picking}
        testID={`registration-photo-${field}`}
      />
    </Anchored>
  );

  const tips = <Banner tone="info" icon="info" text={D.tips} testID="registration-photo-tips" />;

  if (data.role === 'passenger') {
    return (
      <View style={stepStyles.step}>
        <FormGroup>
          {tips}
          {tile('cnicFrontPicture', D.cnicFront)}
          {tile('cnicBackPicture', D.cnicBack)}
          {tile('profilePicture', D.profileOptional)}
        </FormGroup>
      </View>
    );
  }

  const filled = filledVehiclePhotoCount(data.vehiclePictures);
  return (
    <View style={stepStyles.step}>
      <FormGroup>
        {tips}
        {tile('driverPicture', D.driverPicture)}
        {/* CNIC front (cnic_front_image) and back (cnic_back_image, T-203). */}
        {tile('cnicPicture', D.cnicFront)}
        {tile('cnicBackPicture', D.cnicBack)}
        {/* Licence front (license_image). The server has no licence-back field, so none is asked. */}
        {tile('licenseFrontPicture', D.licenceFront)}
      </FormGroup>
      <Anchored field="vehiclePictures">
        <View style={stepStyles.control}>
          <ControlLabel required={f.required('vehiclePictures')}>{D.vehiclePhotos}</ControlLabel>
          <AppText variant="caption" color="textSecondary">
            {D.vehiclePhotosHint}
          </AppText>
          <View style={styles.grid}>
            {VEHICLE_PHOTO_SLOTS.map((slot, index) => (
              <UploadTile
                key={slot.field}
                shape="square"
                label={vehiclePhotoSlotLabel(slot)}
                uri={data.vehiclePictures?.[index]}
                onPress={() => picker.pick('vehiclePictures', index)}
                onRemove={() => picker.removeVehicle(index)}
                disabled={picker.picking}
                style={styles.slot}
                testID={`vehicle-photo-slot-${index}`}
                removeTestID={`vehicle-photo-remove-${index}`}
              />
            ))}
          </View>
          <AppText variant="caption" color="textSecondary" testID="registration-vehicle-photo-count">
            {D.count(filled, VEHICLE_PHOTO_SLOTS.length)}
          </AppText>
          <FieldError message={errors.vehiclePictures} testID="registration-vehicle-photos-error" />
        </View>
      </Anchored>
    </View>
  );
}

const styles = StyleSheet.create({
  // Two sides per row on every phone (4 across is too small to check a plate on an SE).
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  slot: { flexBasis: '45%', flexGrow: 1 },
});
