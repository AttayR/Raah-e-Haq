/**
 * Field labels, placeholders and helpers of the registration steps (UI-R7, spec
 * auth-registration). Validation messages stay in src/schemas/registrationSchema; server
 * messages (422) are shown as sent.
 */
export const REGISTRATION_FIELDS = {
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
} as const;

/** Pakistani licence classes the backend accepts in `license_type` (max 10 characters). */
export const LICENSE_TYPES = [
  { value: 'LTV', label: 'LTV (Light Transport Vehicle)' },
  { value: 'HTV', label: 'HTV (Heavy Transport Vehicle)' },
  { value: 'Motorcycle', label: 'Motorcycle' },
  { value: 'PSV', label: 'PSV (Public Service Vehicle)' },
  { value: 'other', label: 'Other' },
] as const;

export const DRIVING_EXPERIENCE_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '15', '20', '25', '30'];

export const VEHICLE_BRANDS = [
  'Toyota', 'Honda', 'Suzuki', 'Nissan', 'Mitsubishi', 'Hyundai', 'Kia', 'Ford', 'Chevrolet', 'BMW',
  'Mercedes-Benz', 'Audi', 'Volkswagen', 'Mazda', 'Subaru', 'Lexus', 'Infiniti', 'Acura', 'Other',
];

export const VEHICLE_COLOURS = [
  'White', 'Black', 'Silver', 'Gray', 'Red', 'Blue', 'Green', 'Yellow', 'Orange', 'Brown', 'Gold',
  'Purple', 'Pink', 'Other',
];

/** passenger_emergency_contact_relation values the API accepts, with their labels. */
export const EMERGENCY_RELATION_OPTIONS: { value: string; label: string }[] = [
  { value: 'father', label: 'Father' },
  { value: 'mother', label: 'Mother' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'brother', label: 'Brother' },
  { value: 'sister', label: 'Sister' },
  { value: 'friend', label: 'Friend' },
  { value: 'other', label: 'Other' },
];
