/**
 * User-facing copy of the registration form and its phone step (T-201). Server text (the
 * BE-35/BE-38 `message` of register, phone/verify and phone/resend) is shown as sent; these
 * strings only frame it or stand in when a response has none. Code-entry strings shared with
 * phone sign-in come from PHONE_AUTH_COPY.
 */
export const REGISTRATION_COPY = {
  form: {
    progress: (step: number, of: number) => `Step ${step} of ${of}`,
    /** A backend from before BE-35 (no phone step): the old success message. */
    created: 'Your account has been created successfully! Please wait for admin approval.',
    fixErrors: 'Please fix the highlighted fields.',
    /** T-202: a 422 whose fields no input shows; the messages are listed above the action bar. */
    notAccepted: 'Your details could not be accepted. See the message below.',
    /** UI-R7: one primary action per page (spec auth-registration). */
    continue: 'Continue',
    back: 'Back',
    create: 'Create account',
    creating: 'Creating account',
    /** BE-53 register limiter (429 rate_limited): Create account waits for retry_after. */
    createIn: (countdown: string) => `Create account (${countdown})`,
    chooseRoleFirst: 'Choose how you will use Raah-e-Haq.',
    legal: 'By creating an account you agree to the Terms and Privacy Policy.',
  },
  /** Page titles and descriptions (UI-R7). */
  pages: {
    role: { title: 'How will you use Raah-e-Haq?', description: "You can't switch later from the app." },
    personal: { title: 'About you', description: 'Your details as they appear on your CNIC.' },
    vehicle: { title: 'Vehicle & licence', description: 'The vehicle you will drive and your driving licence.' },
    documentsDriver: { title: 'Documents', description: 'Clear photos of your documents. Our team checks them before you can drive.' },
    documentsPassenger: { title: 'Verify your identity', description: 'We use your CNIC to keep riders and drivers safe.' },
    payout: { title: 'Payout', description: 'We pay your earnings here. Only you and the admin team can see this.' },
    review: { title: 'Check your details', description: 'Make sure everything is right before you create your account.' },
  },
  role: {
    groupA11y: 'Account type',
    rideTitle: 'I want to ride',
    rideBody: 'Book rides around your city.',
    driveTitle: 'I want to drive',
    driveBody: 'Earn by giving rides. Needs your licence, vehicle and documents.',
  },
  /** Leaving the form with details typed (spec: Dialog, not a native alert). */
  leave: {
    title: 'Discard sign-up?',
    body: "Your details won't be saved.",
    confirm: 'Discard',
    cancel: 'Keep going',
  },
  verify: {
    headerTitle: 'Verify your number',
    title: 'Enter verification code',
    subtitle: (phone: string) => `Enter the code sent by SMS to ${phone}.`,
    /** register answered code_sent: false without a message. */
    notSentYet: 'No code was sent yet. Please request one when the timer ends.',
    /** BE-38: password sign-in works only after the phone (or the email link) proves the account. */
    signInHint:
      'You can sign in with your password once your number is verified. If you leave this screen, open the confirmation link we emailed you to finish signing up.',
    /** otp_verify_limit / otp_ip_limit: the code step is capped for now. */
    limitHint: 'You can still finish signing up with the confirmation link we emailed you.',
    /** verification_token_invalid for a driver: with no token, sign-in waits for approval anyway. */
    driverApprovalHint: 'Driver accounts can sign in once an admin approves them.',
    /** 409 phone_needs_review. */
    supportHint: (email: string) => `Contact support at ${email}.`,
    /** No endpoint changes an unconfirmed number: the email link, then Profile (T-504). */
    wrongNumber: 'Wrong number? Open the link we emailed you, sign in, then change it in Profile.',
    /** beforeRemove while the code is being entered: leaving drops the verification token. */
    leaveTitle: 'Leave verification?',
    leaveMessage: 'You can finish later from the emailed link.',
    leaveConfirm: 'Leave',
    leaveCancel: 'Stay',
    resent: 'A new code is on its way.',
    doneTitle: 'Number verified',
    pendingApproval:
      'Phone number verified. Your account is pending admin approval; you can sign in once it is approved.',
    goToSignIn: 'Go to Sign In',
    /** The phone step's Header back: leaving asks first (usePreventRemove). */
    backA11y: 'Leave verification',
  },
  fallbacks: {
    register: 'Registration failed',
    verify: 'Phone verification failed',
    resend: 'Failed to resend code',
  },
} as const;
