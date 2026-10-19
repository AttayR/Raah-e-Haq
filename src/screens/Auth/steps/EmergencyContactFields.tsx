import React from 'react';
import { View } from 'react-native';
import { AppText, Chip, TextField } from '../../../components/ui';
import { emergencyRelationOptions, REGISTRATION_FIELDS } from '../../../features/auth/copy/registrationFields';
import type { RegistrationFormData } from '../../../features/auth/registration/registrationForm';
import { Anchored, ControlLabel, FieldError, FormGroup, stepStyles, type useStepFields } from './stepParts';

const COPY = REGISTRATION_FIELDS.emergency;

/** The form keeps a mobile as +92… (what the schema and the request expect). */
export const fromPhoneField = (digits: string): string => (digits ? `+92${digits}` : '');

/** The kit phone field shows the national digits after its fixed +92 prefix. */
export const toPhoneField = (stored: string): string => stored.replace(/^\+92/, '').replace(/\D/g, '');

type Props = {
  data: RegistrationFormData;
  fields: ReturnType<typeof useStepFields>;
};

/**
 * "Emergency contact" group of the About-you page: name, mobile and relationship (required for
 * passengers, BE-27; optional for drivers). Relationship is a single-select chip row.
 */
export default function EmergencyContactFields({ data, fields: f }: Props) {
  const { errors } = f;
  return (
    <FormGroup title={COPY.group} helper={COPY.groupHelper}>
      <Anchored field="emergencyContactName">
        <TextField
          label={COPY.name}
          required={f.required('emergencyContactName')}
          placeholder={COPY.namePlaceholder}
          value={data.emergencyContactName}
          onChangeText={(value) => f.set('emergencyContactName', value)}
          onBlur={() => f.blur('emergencyContactName')}
          autoCapitalize="words"
          error={errors.emergencyContactName}
          testID="registration-emergency-name"
        />
      </Anchored>
      <Anchored field="emergencyContactNumber">
        <TextField
          variant="phone"
          label={COPY.phone}
          required={f.required('emergencyContactNumber')}
          value={toPhoneField(data.emergencyContactNumber)}
          onChangeText={(digits) => f.set('emergencyContactNumber', fromPhoneField(digits))}
          onBlur={() => f.blur('emergencyContactNumber')}
          textContentType="none"
          autoComplete="off"
          doneBar
          error={errors.emergencyContactNumber}
          testID="registration-emergency-phone"
        />
      </Anchored>
      <Anchored field="emergencyRelationship">
        <View style={stepStyles.control}>
          <ControlLabel required={f.required('emergencyRelationship')}>{COPY.relationship}</ControlLabel>
          <AppText variant="caption" color="textSecondary">
            {COPY.relationshipHint}
          </AppText>
          <View style={stepStyles.chips} accessibilityRole="radiogroup" accessibilityLabel={COPY.relationship}>
            {emergencyRelationOptions().map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={data.emergencyRelationship === option.value}
                onPress={() => f.set('emergencyRelationship', option.value)}
                accessibilityRole="radio"
                testID={`registration-relation-${option.value}`}
              />
            ))}
          </View>
          <FieldError message={errors.emergencyRelationship} testID="registration-relation-error" />
        </View>
      </Anchored>
    </FormGroup>
  );
}
