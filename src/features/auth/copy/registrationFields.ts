import { perLocale } from '../../../i18n';
import { localizedCopy } from '../../../i18n/localizedCopy';

/**
 * Field labels, placeholders and helpers of the registration steps (UI-R7, spec
 * auth-registration). Validation messages are in ./registrationErrors (T-575); server
 * messages (422) are shown as sent.
 */
export const REGISTRATION_FIELDS = localizedCopy({
  personal: {
    fullName: 'Full name',
    fullNamePlaceholder: 'Enter your full name',
    email: 'Email',
    emailPlaceholder: 'Enter your email address',
    phone: 'Mobile number',
    password: 'Password',
    passwordPlaceholder: 'Create a strong password',
    passwordHelper: 'At least 8 characters, with an upper-case letter, a lower-case letter and a number.',
    confirmPassword: 'Confirm password',
    confirmPasswordPlaceholder: 'Confirm your password',
    cnic: 'CNIC',
    cnicPlaceholder: '00000-0000000-0',
    dob: 'Date of birth',
    dobPlaceholder: 'YYYY-MM-DD',
    dobHelper: 'Type the digits, e.g. 19900115.',
    dobDriverHelper: 'Drivers must be 18 or older. Type the digits, e.g. 19900115.',
    gender: 'Gender',
    genderMale: 'Male',
    genderFemale: 'Female',
    genderOther: 'Other',
    address: 'Address',
    addressPlaceholder: 'Enter your complete address',
    strength: { weak: 'Weak', medium: 'Medium', strong: 'Strong', a11y: (level: string) => `Password strength: ${level}` },
  },
  emergency: {
    group: 'Emergency contact',
    groupHelper: 'We contact this person only in an emergency.',
    name: 'Name',
    namePlaceholder: 'Full name of emergency contact',
    phone: 'Mobile number',
    relationship: 'Relationship',
    relationshipHint: 'Select the relationship to your emergency contact',
  },
  vehicle: {
    group: 'Vehicle',
    type: 'Vehicle type',
    make: 'Make',
    makeSheet: 'Choose the make',
    makeNeedsType: 'Choose the vehicle type first.',
    model: 'Model',
    modelPlaceholder: 'e.g. Corolla, Alto, CD 70',
    year: 'Year',
    yearSheet: 'Model year',
    colour: 'Colour',
    colourSheet: 'Choose the colour',
    vehicleNumber: 'Vehicle number',
    vehicleNumberPlaceholder: 'ABC-1234 or ABC-1234-D',
    licensePlate: 'Number plate',
    licensePlatePlaceholder: 'e.g. LEA-1234',
    registrationNumber: 'Registration number',
    registrationNumberPlaceholder: 'As on your registration book',
  },
  licence: {
    group: 'Driving licence',
    number: 'Driving licence number',
    numberPlaceholder: 'As printed on your driving licence',
    type: 'Licence type',
    expiry: 'Expiry date',
    expiryPlaceholder: 'YYYY-MM-DD',
    expiryHelper: 'Must not be expired. Type the digits, e.g. 20300115.',
    experience: 'Driving experience',
    experienceValue: (years: string) => (years === '1' ? '1 year' : `${years} years`),
  },
  payout: {
    bankName: 'Bank name',
    bankNamePlaceholder: 'e.g. HBL, UBL, MCB',
    bankBranch: 'Branch',
    bankBranchPlaceholder: 'Branch name or city',
    account: 'Account number or IBAN',
    accountPlaceholder: 'IBAN or account number',
  },
  documents: {
    tips: 'Use good light, keep all text readable, no glare.',
    driverPicture: 'Your photo',
    cnicFront: 'CNIC front',
    cnicBack: 'CNIC back',
    licenceFront: 'Driving licence front',
    profileOptional: 'Profile photo (optional)',
    vehiclePhotos: 'Vehicle photos',
    vehiclePhotosHint: 'Front, back, left side and right side.',
    vehicleSlotA11y: (side: string) => `Vehicle ${side} picture`,
    count: (filled: number, total: number) => `${filled}/${total} pictures uploaded`,
    pickFailed: 'Could not open that photo. Please try again.',
  },
  review: {
    account: 'Account type',
    signingUpAs: 'Signing up as',
    rider: 'Rider',
    driver: 'Driver',
    personal: 'About you',
    emergency: 'Emergency contact',
    vehicle: 'Vehicle & licence',
    documents: 'Documents',
    identity: 'Identity',
    payout: 'Payout',
    edit: 'Edit',
    editA11y: (section: string) => `Edit ${section}`,
    notProvided: 'Not provided',
    noPhoto: 'No photo',
  },
  /** Option labels (T-575); the values sent to the API stay as listed below. */
  options: {
    vehicleTypes: {
      car: { label: 'Car', description: 'Sedan, Hatchback, SUV' },
      bike: { label: 'Bike', description: 'Motorcycle, Scooter' },
      rickshaw: { label: 'Rickshaw', description: 'Auto rickshaw, Qingqi' },
      van: { label: 'Van', description: 'Minivan, Hiace' },
    },
    photoSlots: {
      vehicle_front_image: 'Front',
      vehicle_back_image: 'Back',
      vehicle_left_image: 'Left side',
      vehicle_right_image: 'Right side',
    },
    licenseTypes: {
      LTV: 'LTV (Light Transport Vehicle)',
      HTV: 'HTV (Heavy Transport Vehicle)',
      Motorcycle: 'Motorcycle',
      PSV: 'PSV (Public Service Vehicle)',
      other: 'Other',
    },
    relations: {
      father: 'Father',
      mother: 'Mother',
      spouse: 'Spouse',
      brother: 'Brother',
      sister: 'Sister',
      friend: 'Friend',
      other: 'Other',
    },
    colours: {
      White: 'White',
      Black: 'Black',
      Silver: 'Silver',
      Gray: 'Gray',
      Red: 'Red',
      Blue: 'Blue',
      Green: 'Green',
      Yellow: 'Yellow',
      Orange: 'Orange',
      Brown: 'Brown',
      Gold: 'Gold',
      Purple: 'Purple',
      Pink: 'Pink',
      Other: 'Other',
    },
  },
} as const);

export type RegistrationOption = { value: string; label: string };

type OptionLabels = typeof REGISTRATION_FIELDS.options;

/** Pakistani licence classes the backend accepts in `license_type` (max 10 characters). */
const LICENSE_TYPE_VALUES: readonly (keyof OptionLabels['licenseTypes'])[] = ['LTV', 'HTV', 'Motorcycle', 'PSV', 'other'];

/** Licence type options, labelled in the active language (T-575); call at render time. */
export const licenseTypeOptions = perLocale((): readonly RegistrationOption[] =>
  LICENSE_TYPE_VALUES.map((value) => ({ value, label: REGISTRATION_FIELDS.options.licenseTypes[value] })),
);

export const DRIVING_EXPERIENCE_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '15', '20', '25', '30'];

/** "1 year", "2 years" … in the active language (T-575); call at render time. */
export const drivingExperienceOptions = perLocale((): readonly RegistrationOption[] =>
  DRIVING_EXPERIENCE_OPTIONS.map((value) => ({ value, label: REGISTRATION_FIELDS.licence.experienceValue(value) })),
);

/**
 * T-570 (QA 2026-10-18): the Make list follows the vehicle type, so a bike shows bike makes.
 * T-572 / BE-108: the server's lists (GET /public/vehicle-types `meta.vehicle_makes`, admin
 * editable) are used when present; these static lists (the ones the server was seeded with) stand
 * in while it loads, on an older server or when the request fails. Keyed by the vehicle type id
 * (registrationForm VEHICLE_TYPES); each list ends with 'Other'. vehicle_brand stays free text.
 */
export const VEHICLE_MAKES_BY_TYPE: Readonly<Record<string, readonly string[]>> = {
  car: [
    'Toyota', 'Honda', 'Suzuki', 'KIA', 'Hyundai', 'Changan', 'MG', 'Haval', 'Proton', 'Nissan',
    'Mitsubishi', 'Daihatsu', 'Mercedes-Benz', 'BMW', 'Audi', 'Lexus', 'Other',
  ],
  bike: [
    'Honda', 'Yamaha', 'Suzuki', 'United', 'Road Prince', 'Super Power', 'Unique', 'Super Star',
    'Hi-Speed', 'Metro', 'Crown', 'Benelli', 'Other',
  ],
  rickshaw: [
    'Sazgar', 'New Asia', 'Tez Raftar', 'Siwa', 'United', 'Road Prince', 'Super Power', 'Unique',
    'Other',
  ],
  van: ['Suzuki', 'Toyota', 'Changan', 'FAW', 'Hyundai', 'KIA', 'Daihatsu', 'Nissan', 'Other'],
};

const ownList = (lists: Readonly<Record<string, readonly string[]>> | null | undefined, key: string) =>
  lists && Object.prototype.hasOwnProperty.call(lists, key) ? lists[key] : undefined;

/**
 * The makes for a vehicle type; none until a known type is chosen. `serverMakes` (BE-108) wins
 * when it has a non-empty list for the type, else the static list.
 */
export const vehicleMakesFor = (
  vehicleType: string,
  serverMakes?: Readonly<Record<string, readonly string[]>> | null,
): readonly string[] => {
  const server = ownList(serverMakes, vehicleType);
  if (server && server.length > 0) return server;
  return ownList(VEHICLE_MAKES_BY_TYPE, vehicleType) ?? [];
};

/** The colour values sent as `vehicle_color` (English, as the server stores them). */
export const VEHICLE_COLOURS: readonly (keyof OptionLabels['colours'])[] = [
  'White', 'Black', 'Silver', 'Gray', 'Red', 'Blue', 'Green', 'Yellow', 'Orange', 'Brown', 'Gold',
  'Purple', 'Pink', 'Other',
];

/** Colour options: English values, labels in the active language (T-575); call at render time. */
export const vehicleColourOptions = perLocale((): readonly RegistrationOption[] =>
  VEHICLE_COLOURS.map((value) => ({ value, label: REGISTRATION_FIELDS.options.colours[value] })),
);

/** passenger_emergency_contact_relation values the API accepts. */
const EMERGENCY_RELATION_VALUES: readonly (keyof OptionLabels['relations'])[] = [
  'father', 'mother', 'spouse', 'brother', 'sister', 'friend', 'other',
];

/** Relation options, labelled in the active language (T-575); call at render time. */
export const emergencyRelationOptions = perLocale((): readonly RegistrationOption[] =>
  EMERGENCY_RELATION_VALUES.map((value) => ({ value, label: REGISTRATION_FIELDS.options.relations[value] })),
);
