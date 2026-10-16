import React, { useState } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Header, Screen } from '../../../components/ui';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { layout } from '../../../theme';
import { REGISTRATION_COPY as COPY } from '../../auth/copy/registration';
import { pageProgress, type RegistrationPage } from '../../auth/registration/pages';
import {
  INITIAL_REGISTRATION_FORM,
  type RegistrationFormData,
  type RegistrationRole,
} from '../../auth/registration/registrationForm';
import RegistrationHeader from '../../../screens/Auth/RegistrationHeader';
import { styles } from '../../../screens/Auth/RegistrationScreen.styles';
import RoleStep from '../../../screens/Auth/steps/RoleStep';
import PersonalInfoStep from '../../../screens/Auth/steps/PersonalInfoStep';
import VehicleInfoStep from '../../../screens/Auth/steps/VehicleInfoStep';
import DocumentsStep from '../../../screens/Auth/steps/DocumentsStep';
import PayoutStep from '../../../screens/Auth/steps/PayoutStep';
import ReviewStep from '../../../screens/Auth/steps/ReviewStep';

/**
 * Debug kit gallery: the registration wizard pages (UI-R7) in the same frame as
 * RegistrationScreen (Header, page header, step, sticky action bar), fed by form fixtures.
 * Gallery only; the screen never imports this. `-RHKitGallerySection screen-reg-<page>`.
 */
const noop = () => {};
// A bundled image stands in for a picked photo (gallery fixture only).
const PHOTO = Image.resolveAssetSource(require('../../../assets/images/logo.png')).uri;

const filledDriver: RegistrationFormData = {
  ...INITIAL_REGISTRATION_FORM,
  role: 'driver',
  fullName: 'Gallery Driver',
  email: 'driver@example.test',
  phoneNumber: '+923001234567',
  cnic: '35202-1234567-1',
  address: 'House 1, Street 2, Gulberg, Lahore',
  dateOfBirth: '1990-01-15',
  gender: 'male',
  password: 'Secret123',
  confirmPassword: 'Secret123',
  vehicleType: 'car',
  vehicleNumber: 'LEA-1234',
  vehicleBrand: 'Toyota',
  vehicleModel: 'Corolla',
  vehicleYear: '2018',
  vehicleColor: 'White',
  vehicleHasAc: true,
  licenseNumber: 'LHR-0000123',
  licenseType: 'LTV',
  licenseExpiryDate: '2030-01-15',
  licensePlate: 'LEA-1234',
  registrationNumber: 'REG-0001',
  drivingExperience: '5',
  bankName: 'HBL',
  bankBranch: 'Gulberg',
  bankAccountNumber: 'PK36SCBL0000001123456702',
  driverPicture: PHOTO,
  cnicPicture: PHOTO,
  cnicBackPicture: '',
  licenseFrontPicture: '',
  vehiclePictures: [PHOTO, '', '', ''],
};

const pageCopy = (page: RegistrationPage, role: RegistrationRole) => {
  if (page === 'documents') return role === 'driver' ? COPY.pages.documentsDriver : COPY.pages.documentsPassenger;
  return COPY.pages[page];
};

type PreviewProps = {
  page: RegistrationPage;
  role?: RegistrationRole;
  form?: RegistrationFormData;
  errors?: Partial<Record<string, string>>;
};

export function RegistrationPreview({ page, role = 'passenger', form, errors = {} }: PreviewProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<RegistrationFormData>(form ?? { ...INITIAL_REGISTRATION_FORM, role });
  const onDataChange = (patch: Partial<RegistrationFormData>) => setData((prev) => ({ ...prev, ...patch }));
  const copy = pageCopy(page, data.role);
  const stepProps = { data, onDataChange, errors };
  const body = {
    role: <RoleStep value={page === 'role' && !form ? null : data.role} onChange={(next) => onDataChange({ role: next })} />,
    personal: <PersonalInfoStep {...stepProps} />,
    vehicle: <VehicleInfoStep {...stepProps} />,
    documents: <DocumentsStep {...stepProps} />,
    payout: <PayoutStep {...stepProps} />,
    review: <ReviewStep data={data} onEdit={noop} />,
  }[page];
  return (
    <Screen keyboardAvoiding edges={['top', 'bottom']} testID={`preview-registration-${page}`}>
      <Header tone="background" onBack={noop} backLabel={COPY.form.back} />
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <RegistrationHeader title={copy.title} description={copy.description} progress={pageProgress(page, data.role)} />
          {body}
        </View>
      </ScrollView>
      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom > 0 ? layout.bottomActionOffset : layout.bottomActionMinOffset,
            borderTopWidth: theme.borderWidth.hairline,
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.background,
          },
        ]}
      >
        <Button
          label={page === 'review' ? COPY.form.create : COPY.form.continue}
          onPress={noop}
          disabled={page === 'role' && !form}
          trailingIcon={page === 'review' ? undefined : 'arrowForward'}
        />
      </View>
    </Screen>
  );
}

const personalErrors = {
  fullName: 'Full name is required',
  phoneNumber: 'Phone number is required',
  password: 'Password must contain at least one uppercase letter',
};

export const REGISTRATION_PREVIEWS: Array<[string, () => React.ReactElement]> = [
  ['screen-reg-role', () => <RegistrationPreview page="role" />],
  ['screen-reg-role-driver', () => <RegistrationPreview page="role" form={{ ...INITIAL_REGISTRATION_FORM, role: 'driver' }} />],
  ['screen-reg-personal', () => <RegistrationPreview page="personal" />],
  ['screen-reg-personal-errors', () => <RegistrationPreview page="personal" errors={personalErrors} />],
  ['screen-reg-personal-filled', () => <RegistrationPreview page="personal" form={filledDriver} />],
  ['screen-reg-vehicle', () => <RegistrationPreview page="vehicle" form={filledDriver} />],
  ['screen-reg-vehicle-empty', () => <RegistrationPreview page="vehicle" role="driver" />],
  ['screen-reg-documents', () => <RegistrationPreview page="documents" form={filledDriver} errors={{ licenseFrontPicture: 'License front picture is required' }} />],
  ['screen-reg-identity', () => <RegistrationPreview page="documents" role="passenger" />],
  ['screen-reg-payout', () => <RegistrationPreview page="payout" form={filledDriver} />],
  ['screen-reg-review', () => <RegistrationPreview page="review" form={filledDriver} />],
];
