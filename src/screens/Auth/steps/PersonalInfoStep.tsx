import React from 'react';
import { View } from 'react-native';
import { SegmentedControl, TextField } from '../../../components/ui';
import { REGISTRATION_FIELDS } from '../../../features/auth/copy/registrationFields';
import { formatCnicInput, formatIsoDateInput } from '../../../features/auth/registration/inputFormat';
import type { RegistrationFormData } from '../../../features/auth/registration/registrationForm';
import EmergencyContactFields, { fromPhoneField, toPhoneField } from './EmergencyContactFields';
import PasswordStrength from './PasswordStrength';
import { Anchored, ControlLabel, FieldError, FormGroup, stepStyles, useStepFields, type StepProps } from './stepParts';

const COPY = REGISTRATION_FIELDS.personal;

type Gender = RegistrationFormData['gender'];

const GENDER_OPTIONS: ReadonlyArray<{ value: Gender; label: string }> = [
  { value: 'male', label: COPY.genderMale },
  { value: 'female', label: COPY.genderFemale },
  { value: 'other', label: COPY.genderOther },
];

/**
 * Registration page "About you" (UI-R7, both roles): name, email, mobile, password, CNIC, date of
 * birth (drivers 18+, BE-68), gender and address, then the emergency contact (required for
 * passengers). Every field is a kit TextField; the number pads get an iOS Done bar.
 */
export default function PersonalInfoStep(props: StepProps) {
  const { data } = props;
  const f = useStepFields('personal', props);
  const { errors } = f;

  return (
    <View style={stepStyles.step}>
      <FormGroup>
        <Anchored field="fullName">
          <TextField
            label={COPY.fullName}
            required={f.required('fullName')}
            placeholder={COPY.fullNamePlaceholder}
            value={data.fullName}
            onChangeText={(value) => f.set('fullName', value)}
            onBlur={() => f.blur('fullName')}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            error={errors.fullName}
            testID="registration-full-name"
          />
        </Anchored>
        <Anchored field="email">
          <TextField
            label={COPY.email}
            required={f.required('email')}
            placeholder={COPY.emailPlaceholder}
            value={data.email}
            onChangeText={(value) => f.set('email', value)}
            onBlur={() => f.blur('email')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            error={errors.email}
            testID="registration-email"
          />
        </Anchored>
        <Anchored field="phoneNumber">
          <TextField
            variant="phone"
            label={COPY.phone}
            required={f.required('phoneNumber')}
            value={toPhoneField(data.phoneNumber)}
            onChangeText={(digits) => f.set('phoneNumber', fromPhoneField(digits))}
            onBlur={() => f.blur('phoneNumber')}
            doneBar
            error={errors.phoneNumber}
            testID="registration-phone"
          />
        </Anchored>
        <Anchored field="password">
          <TextField
            variant="password"
            label={COPY.password}
            required={f.required('password')}
            placeholder={COPY.passwordPlaceholder}
            helper={COPY.passwordHelper}
            value={data.password}
            onChangeText={(value) => f.set('password', value)}
            onBlur={() => f.blur('password')}
            autoComplete="new-password"
            textContentType="newPassword"
            error={errors.password}
            testID="registration-password"
          />
          <PasswordStrength password={data.password} />
        </Anchored>
        <Anchored field="confirmPassword">
          <TextField
            variant="password"
            label={COPY.confirmPassword}
            required={f.required('confirmPassword')}
            placeholder={COPY.confirmPasswordPlaceholder}
            value={data.confirmPassword}
            onChangeText={(value) => f.set('confirmPassword', value)}
            onBlur={() => f.blur('confirmPassword')}
            autoComplete="new-password"
            textContentType="newPassword"
            error={errors.confirmPassword}
            testID="registration-confirm-password"
          />
        </Anchored>
        <Anchored field="cnic">
          <TextField
            label={COPY.cnic}
            required={f.required('cnic')}
            placeholder={COPY.cnicPlaceholder}
            value={data.cnic}
            onChangeText={(value) => f.set('cnic', formatCnicInput(value))}
            onBlur={() => f.blur('cnic')}
            keyboardType="number-pad"
            maxLength={15}
            doneBar
            error={errors.cnic}
            testID="registration-cnic"
          />
        </Anchored>
        <Anchored field="dateOfBirth">
          <TextField
            label={COPY.dob}
            required={f.required('dateOfBirth')}
            placeholder={COPY.dobPlaceholder}
            helper={data.role === 'driver' ? COPY.dobDriverHelper : COPY.dobHelper}
            value={data.dateOfBirth}
            // The number pad has no "-" on iOS (T-206): type digits, the dashes are inserted.
            onChangeText={(value) => f.set('dateOfBirth', formatIsoDateInput(value))}
            onBlur={() => f.blur('dateOfBirth')}
            keyboardType="number-pad"
            maxLength={10}
            doneBar
            error={errors.dateOfBirth}
            testID="registration-dob"
          />
        </Anchored>
        <Anchored field="gender">
          <View style={stepStyles.control}>
            <ControlLabel required={f.required('gender')}>{COPY.gender}</ControlLabel>
            <SegmentedControl<Gender>
              options={GENDER_OPTIONS}
              value={data.gender}
              onChange={(value) => f.set('gender', value)}
              accessibilityLabel={COPY.gender}
              testID="registration-gender"
            />
            <FieldError message={errors.gender} testID="registration-gender-error" />
          </View>
        </Anchored>
        <Anchored field="address">
          <TextField
            label={COPY.address}
            required={f.required('address')}
            placeholder={COPY.addressPlaceholder}
            value={data.address}
            onChangeText={(value) => f.set('address', value)}
            onBlur={() => f.blur('address')}
            multiline
            doneBar
            autoComplete="street-address"
            textContentType="fullStreetAddress"
            error={errors.address}
            testID="registration-address"
          />
        </Anchored>
      </FormGroup>
      <EmergencyContactFields data={data} fields={f} />
    </View>
  );
}
