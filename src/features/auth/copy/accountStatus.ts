/**
 * User-facing copy of the account-status screen (T-106, AUTH-01, DRV-12).
 *
 * This is the app's static copy file for the screen: every string the screen, its
 * components and hooks show lives here (no inline literals), so it can move into the i18n
 * catalogue (Urdu) as one unit. Dynamic text (the server's refusal message, a
 * rejection_reason) is never written here; it comes from the API.
 *
 * Variants (features/auth/accountStatus.ts resolveAccountStatusVariant):
 * - pendingDriver      driver awaiting admin approval (status pending)
 * - pendingPassenger   any other account awaiting approval (status pending)
 * - suspended          status suspended
 * - rejected           status rejected (the reason is shown when it is in memory)
 * - inactive           status inactive (deactivated)
 * - unverified         GET /auth/profile answered 2xx without a profile: status unknown
 * - unsupportedRole    active, but admin or no role this app serves
 */

export type AccountStatusTone = 'pending' | 'danger' | 'info';

export interface AccountStatusVariantCopy {
  /** MaterialIcons glyph name. */
  icon: string;
  tone: AccountStatusTone;
  /** Header line above the card. */
  heading: string;
  title: string;
  message: string;
  /** Short lines under the message (what to expect / what to do). */
  notes: string[];
  /**
   * Whether Check Status is offered. For unsupportedRole it is offered only when the account
   * has no role at all (that may be fixed on the server), never to an active admin.
   */
  canCheckStatus: boolean;
  /** Whether the support contact line is shown. */
  showSupport: boolean;
}

export type AccountStatusVariant =
  | 'pendingDriver'
  | 'pendingPassenger'
  | 'suspended'
  | 'rejected'
  | 'inactive'
  | 'unverified'
  | 'unsupportedRole';

export const ACCOUNT_STATUS_VARIANTS: Record<AccountStatusVariant, AccountStatusVariantCopy> = {
  pendingDriver: {
    icon: 'hourglass-empty',
    tone: 'pending',
    heading: 'Driver application',
    title: 'Application under review',
    message:
      'Our team is reviewing your documents and vehicle details. You can start driving as soon as your account is approved.',
    notes: [
      'Reviews usually take 24 to 48 hours.',
      'If a document is rejected, it is listed below and you can upload a new one.',
      'Tap Check Status to see whether you have been approved.',
    ],
    canCheckStatus: true,
    showSupport: false,
  },
  pendingPassenger: {
    icon: 'hourglass-empty',
    tone: 'pending',
    heading: 'Your account',
    title: 'Account awaiting approval',
    message: 'Your account is waiting for approval. You can book rides as soon as it is approved.',
    notes: ['Tap Check Status to see whether your account is ready.'],
    canCheckStatus: true,
    showSupport: false,
  },
  suspended: {
    icon: 'pause-circle-filled',
    tone: 'danger',
    heading: 'Your account',
    title: 'Account suspended',
    message: 'Your account has been suspended, so you cannot use the app right now.',
    notes: ['Contact support to find out why and how to restore your account.'],
    canCheckStatus: true,
    showSupport: true,
  },
  rejected: {
    icon: 'cancel',
    tone: 'danger',
    heading: 'Your account',
    title: 'Application not approved',
    message: 'Your account application was not approved.',
    notes: ['Contact support if you think this is a mistake.'],
    canCheckStatus: true,
    showSupport: true,
  },
  inactive: {
    icon: 'block',
    tone: 'danger',
    heading: 'Your account',
    title: 'Account deactivated',
    message: 'Your account has been deactivated, so you cannot use the app right now.',
    notes: ['Contact support to reactivate your account.'],
    canCheckStatus: true,
    showSupport: true,
  },
  unverified: {
    icon: 'help-outline',
    tone: 'info',
    heading: 'Your account',
    title: "We couldn't confirm your account",
    message:
      'The server sent an unexpected answer, so we could not check your account status. This is usually temporary.',
    notes: ['Tap Check Status to try again.'],
    canCheckStatus: true,
    showSupport: true,
  },
  unsupportedRole: {
    icon: 'admin-panel-settings',
    tone: 'info',
    heading: 'Your account',
    title: 'This app is for passengers and drivers',
    message:
      'Your account does not have a passenger or driver role, so there is nothing to show in this app. Admins use the web dashboard.',
    notes: ['Sign out and sign in with a passenger or driver account.'],
    canCheckStatus: false,
    showSupport: true,
  },
};

export const ACCOUNT_STATUS_COPY = {
  checkStatus: 'Check Status',
  checking: 'Checking…',
  signOut: 'Sign Out',
  signingOut: 'Signing out…',
  /** Pending driver, status unchanged after Check Status. */
  stillPending: 'Not approved yet. We will keep your application in review.',
  /** Pending passenger (or any non-driver), status unchanged after Check Status. */
  stillPendingPassenger: 'Your account is not approved yet. Please check again later.',
  stillBlocked: 'Your account status has not changed.',
  approved: 'Your account is approved. Welcome!',
  checkFailed: 'Could not check your status. Please try again.',
  reasonLabel: 'Reason',
  supportPrefix: 'Support:',
  /** Fallback name in the header when the profile has none. */
  fallbackName: 'Welcome',
} as const;

export const REJECTED_DOCUMENTS_COPY = {
  title: 'Needs your attention',
  intro: 'These items were rejected. Upload a clear new photo of each one.',
  loading: 'Loading your documents…',
  loadFailed: 'Could not load your documents.',
  retry: 'Try again',
  empty: 'None of your documents need changes right now.',
  reupload: 'Upload new photo',
  uploading: 'Uploading…',
  uploaded: 'Uploaded. It will be reviewed again.',
  uploadFailed: 'Upload failed. Please try again.',
  /** 409 DOCUMENT_NOT_REJECTED: the item changed on the server meanwhile. */
  alreadyChanged: 'This item was already updated. The list has been refreshed.',
  tooLarge: 'The photo is larger than 5 MB. Choose a smaller one.',
  wrongType: 'Choose a JPEG or PNG photo.',
  pickFailed: 'Could not open your photos.',
  noReason: 'No reason given.',
  /** Labels for the item kinds; other document types show the server's type, humanised. */
  documentFallback: 'Document',
  vehicleLabel: 'Vehicle',
  /** `{n}`: the vehicle's position in the driver's vehicle list (the payload has no make/plate). */
  vehicleNumbered: 'Vehicle #{n}',
  /** `{count}`: how many more rejected items are hidden. */
  showMore: 'Show {count} more',
  showFewer: 'Show fewer',
  choosePhotos: 'Choose new photos',
  cancel: 'Cancel',
  vehicleIntro: 'Choose a new photo for each part that needs one, then send them together.',
  selected: 'Selected',
  sendForReview: 'Send for review',
  vehicleFields: {
    front_image: 'Front photo',
    back_image: 'Back photo',
    left_image: 'Left side photo',
    right_image: 'Right side photo',
    insurance_document: 'Insurance document',
    registration_document: 'Registration document',
  },
  documentTypes: {
    cnic_front: 'CNIC (front)',
    cnic_back: 'CNIC (back)',
    driving_license: 'Driving licence',
    license_front: 'Driving licence (front)',
    license_back: 'Driving licence (back)',
    profile_photo: 'Profile photo',
    vehicle_registration: 'Vehicle registration',
    insurance: 'Insurance',
  } as Record<string, string>,
} as const;

/** Fills `{name}` placeholders of a copy template. */
export const fillCopy = (template: string, values: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
