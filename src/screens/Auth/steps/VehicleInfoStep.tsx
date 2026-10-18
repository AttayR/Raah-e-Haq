import React, { useEffect } from 'react';
import { View } from 'react-native';
import { SelectField, TextField } from '../../../components/ui';
import {
  DRIVING_EXPERIENCE_OPTIONS,
  LICENSE_TYPES,
  REGISTRATION_FIELDS,
  VEHICLE_COLOURS,
  vehicleMakesFor,
} from '../../../features/auth/copy/registrationFields';
import { formatIsoDateInput } from '../../../features/auth/registration/inputFormat';
import { maxVehicleYear, MIN_VEHICLE_YEAR } from '../../../schemas/registrationSchema';
import { RegistrationAcSwitch } from '../../../features/ac/components/RegistrationAcSwitch';
import { acAllowedFor, vehicleYearOptions } from '../../../features/ac/api';
import { useRegistrationVehicleRules } from '../../../features/ac/hooks';
import VehicleTypePicker from './VehicleTypePicker';
import { Anchored, ControlLabel, FieldError, FormGroup, stepStyles, useStepFields, type StepProps } from './stepParts';

const V = REGISTRATION_FIELDS.vehicle;
const L = REGISTRATION_FIELDS.licence;

const toOptions = (values: readonly string[]) => values.map((value) => ({ value, label: value }));
const COLOUR_OPTIONS = toOptions(VEHICLE_COLOURS);
const EXPERIENCE_OPTIONS = DRIVING_EXPERIENCE_OPTIONS.map((value) => ({ value, label: L.experienceValue(value) }));

/** ABC-1234 or ABC-1234-D: letters upper-cased, separators inserted as the user types. */
export const formatVehicleNumber = (value: string): string => {
  const cleaned = (value || '').replace(/[^A-Za-z0-9]/g, '');
  if (cleaned.length <= 3) return cleaned.toUpperCase();
  if (cleaned.length <= 7) return `${cleaned.slice(0, 3).toUpperCase()}-${cleaned.slice(3)}`;
  return `${cleaned.slice(0, 3).toUpperCase()}-${cleaned.slice(3, 7)}-${cleaned.slice(7, 8).toUpperCase()}`;
};

/**
 * Driver page "Vehicle & licence" (UI-R7): vehicle type cards, make, model, year (the server's
 * range, BE-105), colour, the AC declaration for a car (gated by the AC minimum year, T-558), the
 * vehicle number, number plate and registration number, then the driving licence (required,
 * T-207). The bank fields of the same schema step are on the Payout page (PayoutStep).
 */
export default function VehicleInfoStep(props: StepProps) {
  const { data, onDataChange } = props;
  const f = useStepFields('vehicle', props);
  const { errors } = f;
  // BE-105: the server's year range and AC minimum year (null until loaded or on an older server).
  const vehicleRules = useRegistrationVehicleRules();
  const acRule = acAllowedFor(vehicleRules, data.vehicleType, data.vehicleYear);
  // Rules that arrive after an old year was picked with AC on turn the declaration off.
  const hasAc = data.vehicleHasAc === true;
  useEffect(() => {
    if (acRule.tooOld && hasAc) onDataChange({ vehicleHasAc: false });
  }, [acRule.tooOld, hasAc, onDataChange]);

  // The newest 20 model years the backend accepts (BE-29 / BE-105 meta.vehicle_year, AUTH-12).
  const yearOptions = toOptions(vehicleYearOptions(vehicleRules?.vehicleYear ?? null, maxVehicleYear(), MIN_VEHICLE_YEAR));

  // T-570: the makes of the chosen type (bike makes for a bike); none until a type is chosen.
  const makes = vehicleMakesFor(data.vehicleType);
  const makeOptions = toOptions(makes);

  const selectType = (type: string) => {
    f.set('vehicleType', type);
    // A make the new type does not list (Toyota after switching to Bike) is cleared, not kept.
    if (data.vehicleBrand && !vehicleMakesFor(type).includes(data.vehicleBrand)) f.set('vehicleBrand', '');
  };

  const selectYear = (year: string) => {
    // BE-105: a year older than the AC minimum turns the AC declaration off.
    const tooOld = acAllowedFor(vehicleRules, data.vehicleType, year).tooOld;
    if (tooOld && data.vehicleHasAc) onDataChange({ vehicleHasAc: false });
    f.set('vehicleYear', year);
  };

  const text = (
    field: 'vehicleModel' | 'licensePlate' | 'registrationNumber' | 'licenseNumber',
    label: string,
    placeholder: string,
    extra: Partial<React.ComponentProps<typeof TextField>> = {},
  ) => (
    <Anchored field={field}>
      <TextField
        label={label}
        required={f.required(field)}
        placeholder={placeholder}
        value={data[field]}
        onChangeText={(value) => f.set(field, value)}
        onBlur={() => f.blur(field)}
        error={errors[field]}
        {...extra}
      />
    </Anchored>
  );

  return (
    <View style={stepStyles.step}>
      <FormGroup title={V.group}>
        <Anchored field="vehicleType">
          <View style={stepStyles.control}>
            <ControlLabel required={f.required('vehicleType')}>{V.type}</ControlLabel>
            <VehicleTypePicker value={data.vehicleType} onChange={selectType} accessibilityLabel={V.type} />
            <FieldError message={errors.vehicleType} testID="registration-vehicle-type-error" />
          </View>
        </Anchored>
        <Anchored field="vehicleBrand">
          <SelectField
            label={V.make}
            required={f.required('vehicleBrand')}
            sheetTitle={V.makeSheet}
            value={data.vehicleBrand}
            options={makeOptions}
            onChange={(value) => f.set('vehicleBrand', value)}
            disabled={makes.length === 0}
            helper={makes.length === 0 ? V.makeNeedsType : undefined}
            error={errors.vehicleBrand}
            testID="registration-vehicle-make"
          />
        </Anchored>
        {text('vehicleModel', V.model, V.modelPlaceholder, { testID: 'registration-vehicle-model' })}
        <Anchored field="vehicleYear">
          <SelectField
            label={V.year}
            required={f.required('vehicleYear')}
            sheetTitle={V.yearSheet}
            value={data.vehicleYear}
            options={yearOptions}
            onChange={selectYear}
            error={errors.vehicleYear}
            testID="registration-vehicle-year"
          />
        </Anchored>
        <Anchored field="vehicleColor">
          <SelectField
            label={V.colour}
            required={f.required('vehicleColor')}
            sheetTitle={V.colourSheet}
            value={data.vehicleColor}
            options={COLOUR_OPTIONS}
            onChange={(value) => f.set('vehicleColor', value)}
            error={errors.vehicleColor}
            testID="registration-vehicle-colour"
          />
        </Anchored>
        {/* BE-86: optional AC declaration, cars only (an admin checks it before AC rides).
            BE-105: off and disabled below the server's AC minimum year; the 422 stays the check. */}
        {acRule.shown ? (
          <Anchored field="vehicleHasAc">
            <RegistrationAcSwitch
              value={data.vehicleHasAc}
              onChange={(on) => f.set('vehicleHasAc', on)}
              error={errors.vehicleHasAc}
              tooOldMinYear={acRule.tooOld ? vehicleRules?.acMinVehicleYear ?? null : null}
            />
          </Anchored>
        ) : null}
        <Anchored field="vehicleNumber">
          <TextField
            label={V.vehicleNumber}
            required={f.required('vehicleNumber')}
            placeholder={V.vehicleNumberPlaceholder}
            value={data.vehicleNumber}
            onChangeText={(value) => f.set('vehicleNumber', formatVehicleNumber(value))}
            onBlur={() => f.blur('vehicleNumber')}
            autoCapitalize="characters"
            autoCorrect={false}
            error={errors.vehicleNumber}
            testID="registration-vehicle-number"
          />
        </Anchored>
        {text('licensePlate', V.licensePlate, V.licensePlatePlaceholder, {
          autoCapitalize: 'characters',
          autoCorrect: false,
          testID: 'registration-license-plate',
        })}
        {text('registrationNumber', V.registrationNumber, V.registrationNumberPlaceholder, {
          autoCapitalize: 'characters',
          autoCorrect: false,
          testID: 'registration-registration-number',
        })}
      </FormGroup>

      <FormGroup title={L.group}>
        {/* Driving licence number (T-207: required for drivers, sent as license_number). */}
        {text('licenseNumber', L.number, L.numberPlaceholder, {
          autoCapitalize: 'characters',
          autoCorrect: false,
          maxLength: 50,
          testID: 'registration-license-number',
        })}
        <Anchored field="licenseType">
          <SelectField
            label={L.type}
            required={f.required('licenseType')}
            value={data.licenseType}
            options={LICENSE_TYPES}
            onChange={(value) => f.set('licenseType', value)}
            error={errors.licenseType}
            testID="registration-license-type"
          />
        </Anchored>
        <Anchored field="licenseExpiryDate">
          <TextField
            label={L.expiry}
            required={f.required('licenseExpiryDate')}
            placeholder={L.expiryPlaceholder}
            helper={L.expiryHelper}
            value={data.licenseExpiryDate}
            onChangeText={(value) => f.set('licenseExpiryDate', formatIsoDateInput(value))}
            onBlur={() => f.blur('licenseExpiryDate')}
            keyboardType="number-pad"
            maxLength={10}
            doneBar
            error={errors.licenseExpiryDate}
            testID="registration-license-expiry"
          />
        </Anchored>
        <Anchored field="drivingExperience">
          <SelectField
            label={L.experience}
            required={f.required('drivingExperience')}
            value={data.drivingExperience}
            options={EXPERIENCE_OPTIONS}
            onChange={(value) => f.set('drivingExperience', value)}
            error={errors.drivingExperience}
            testID="registration-driving-experience"
          />
        </Anchored>
      </FormGroup>
    </View>
  );
}
