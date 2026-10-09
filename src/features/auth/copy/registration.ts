/**
 * User-facing copy of the registration form and its phone step (T-201). Server text (the
 * BE-35/BE-38 `message` of register, phone/verify and phone/resend) is shown as sent; these
 * strings only frame it or stand in when a response has none. Code-entry strings shared with
 * phone sign-in come from PHONE_AUTH_COPY.
 */
export const REGISTRATION_COPY = {
  form: {
    title: 'Create Account',
    subtitle: (role: 'driver' | 'passenger') => `Join RaaH-e-Haq as ${role === 'driver' ? 'Driver' : 'Passenger'}`,
    progress: (step: number, of: number) => `Step ${step} of ${of}`,
    /** A backend from before BE-35 (no phone step): the old success message. */
    created: 'Your account has been created successfully! Please wait for admin approval.',
    fixErrors: 'Please fix the highlighted fields.',
    next: 'Next',
    previous: 'Previous',
    create: 'Create Account',
    creating: 'Creating Account...',
    /** BE-53 register limiter (429 rate_limited): Create Account waits for retry_after. */
    createIn: (countdown: string) => `Create Account (${countdown})`,
  },
  verify: {
    headerTitle: 'Verify Your Number',
    headerSubtitle: 'One last step to finish signing up',
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
  },
  fallbacks: {
    register: 'Registration failed',
    verify: 'Phone verification failed',
    resend: 'Failed to resend code',
  },
} as const;
