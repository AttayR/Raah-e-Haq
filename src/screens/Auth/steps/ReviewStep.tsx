import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../../components/ui';
import { t } from '../../../i18n';
import { REGISTRATION_COPY } from '../../../features/auth/copy/registration';
import {
  EMERGENCY_RELATION_OPTIONS,
  LICENSE_TYPES,
  REGISTRATION_FIELDS as F,
} from '../../../features/auth/copy/registrationFields';
import type { RegistrationPage } from '../../../features/auth/registration/pages';
import {
  VEHICLE_PHOTO_SLOTS,
  vehicleTypeLabel,
  type RegistrationFormData,
} from '../../../features/auth/registration/registrationForm';
import { space } from '../../../theme';
import { ReviewRow, ReviewSection, ReviewThumbs } from './ReviewSection';

const R = F.review;

type Props = {
  data: RegistrationFormData;
  onDataChange?: (patch: Partial<RegistrationFormData>) => void;
  /** Opens the page that edits a section (the header "Edit" buttons); hidden without it. */
  onEdit?: (page: RegistrationPage) => void;
};

/** CNIC with all but the last digit hidden: 35202-1234567-1 → •••••-•••••••-1. */
export const maskCnic = (cnic: string): string => cnic.replace(/\d(?=[\d-]*\d$)/g, '•');

/** Account number or IBAN with only the last 4 shown. */
export const maskAccount = (account: string): string => {
  const plain = account.replace(/\s/g, '');
  return plain.length > 4 ? `•••• ${plain.slice(-4)}` : plain;
};

const labelOf = (options: ReadonlyArray<{ value: string; label: string }>, value: string) =>
  options.find((option) => option.value === value)?.label ?? value;

const capitalise = (value: string) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);

/**
 * Review page "Check your details" (UI-R7): one card per page with an Edit link to it, CNIC and
 * bank account masked, document thumbnails, and the legal line above the action bar.
 */
export default function ReviewStep({ data, onEdit }: Props) {
  const driver = data.role === 'driver';
  const edit = (page: RegistrationPage) => (onEdit ? () => onEdit(page) : undefined);
  const P = F.personal;

  return (
    <View style={styles.step}>
      <ReviewSection title={R.account} onEdit={edit('role')} testID="review-account">
        <ReviewRow label={R.signingUpAs} value={driver ? R.driver : R.rider} />
      </ReviewSection>

      <ReviewSection title={R.personal} onEdit={edit('personal')} testID="review-personal">
        <ReviewRow label={P.fullName} value={data.fullName} />
        <ReviewRow label={P.email} value={data.email} />
        <ReviewRow label={P.phone} value={data.phoneNumber} />
        <ReviewRow label={P.cnic} value={maskCnic(data.cnic)} testID="review-cnic" />
        <ReviewRow label={P.dob} value={data.dateOfBirth} />
        <ReviewRow label={P.gender} value={capitalise(data.gender)} />
        <ReviewRow label={P.address} value={data.address} />
      </ReviewSection>

      {data.emergencyContactName || data.emergencyContactNumber ? (
        <ReviewSection title={R.emergency} onEdit={edit('personal')} testID="review-emergency">
          <ReviewRow label={F.emergency.name} value={data.emergencyContactName} />
          <ReviewRow label={F.emergency.phone} value={data.emergencyContactNumber} />
          <ReviewRow
            label={F.emergency.relationship}
            value={data.emergencyRelationship ? labelOf(EMERGENCY_RELATION_OPTIONS, data.emergencyRelationship) : ''}
          />
        </ReviewSection>
      ) : null}

      {driver ? (
        <ReviewSection title={R.vehicle} onEdit={edit('vehicle')} testID="review-vehicle">
          <ReviewRow label={F.vehicle.type} value={data.vehicleType ? vehicleTypeLabel(data.vehicleType) : ''} />
          <ReviewRow label={F.vehicle.make} value={[data.vehicleBrand, data.vehicleModel].filter(Boolean).join(' ')} />
          <ReviewRow label={F.vehicle.year} value={data.vehicleYear} />
          <ReviewRow label={F.vehicle.colour} value={data.vehicleColor} />
          {data.vehicleType === 'car' && data.vehicleHasAc ? (
            <ReviewRow label={t('ac.registerLabel')} value={t('common.yes')} testID="review-vehicle-ac" />
          ) : null}
          <ReviewRow label={F.vehicle.vehicleNumber} value={data.vehicleNumber} />
          <ReviewRow label={F.vehicle.licensePlate} value={data.licensePlate} />
          <ReviewRow label={F.vehicle.registrationNumber} value={data.registrationNumber} />
          <ReviewRow label={F.licence.number} value={data.licenseNumber} />
          <ReviewRow label={F.licence.type} value={data.licenseType ? labelOf(LICENSE_TYPES, data.licenseType) : ''} />
          <ReviewRow label={F.licence.expiry} value={data.licenseExpiryDate} />
          <ReviewRow
            label={F.licence.experience}
            value={data.drivingExperience ? F.licence.experienceValue(data.drivingExperience) : ''}
          />
        </ReviewSection>
      ) : null}

      <ReviewSection title={driver ? R.documents : R.identity} onEdit={edit('documents')} testID="review-documents">
        <ReviewThumbs
          items={
            driver
              ? [
                  { label: F.documents.driverPicture, uri: data.driverPicture },
                  { label: F.documents.cnicFront, uri: data.cnicPicture },
                  { label: F.documents.cnicBack, uri: data.cnicBackPicture },
                  { label: F.documents.licenceFront, uri: data.licenseFrontPicture },
                  ...VEHICLE_PHOTO_SLOTS.map(({ label }, index) => ({ label, uri: data.vehiclePictures?.[index] })),
                ]
              : [
                  { label: F.documents.cnicFront, uri: data.cnicFrontPicture },
                  { label: F.documents.cnicBack, uri: data.cnicBackPicture },
                  { label: F.documents.profileOptional, uri: data.profilePicture },
                ]
          }
        />
      </ReviewSection>

      {driver ? (
        <ReviewSection title={R.payout} onEdit={edit('payout')} testID="review-payout">
          <ReviewRow label={F.payout.bankName} value={data.bankName} />
          <ReviewRow label={F.payout.bankBranch} value={data.bankBranch} />
          <ReviewRow label={F.payout.account} value={maskAccount(data.bankAccountNumber)} testID="review-account-number" />
        </ReviewSection>
      ) : null}

      <AppText variant="bodySmall" color="textSecondary" testID="registration-legal">
        {REGISTRATION_COPY.form.legal}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { gap: space[4] },
});
