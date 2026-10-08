/**
 * User-facing copy of the phone (OTP) sign-in screen (T-101, T-111).
 *
 * Every string the screen shows lives here (no inline literals), so it can move into the
 * i18n catalogue (Urdu) as one unit. Server refusal text (BE-28 `message`) is never written
 * here: the screen shows it as sent, and these strings only frame it.
 */
export const PHONE_AUTH_COPY = {
  header: {
    phoneTitle: 'Phone Verification',
    phoneSubtitle: 'Enter your phone number to get started',
    codeTitle: 'Verify Code',
    codeSubtitle: 'Enter the code sent to your phone',
  },
  phoneStep: {
    title: 'Enter your phone number',
    subtitle: "We'll send you a verification code",
    placeholder: 'Enter phone number',
    send: 'Send Code',
    sending: 'Sending...',
    sendIn: (countdown: string) => `Send Code (${countdown})`,
    invalidPhone: 'Invalid phone number',
  },
  codeStep: {
    title: 'Enter verification code',
    subtitle: (phone: string) => `We sent a code to ${phone}. Enter it to verify your phone number.`,
    placeholder: (length: number) => `${length}-digit code`,
    expiresIn: (countdown: string) => `Code expires in ${countdown}`,
    expired: 'Code expired. Please request a new code.',
    /** BE-28 code_exhausted: too many wrong tries, the server has burned this code. */
    burned: 'This code can no longer be used. Please request a new code.',
    verify: 'Verify Code',
    verifying: 'Verifying...',
    resend: 'Resend Code',
    resending: 'Resending...',
    resendIn: (countdown: string) => `Resend code in ${countdown}`,
    changePhone: 'Change Phone Number',
    invalidCode: 'Invalid OTP code',
  },
  /** BE-28 otp_ip_limit / otp_verify_limit: phone sign-in is capped for today. */
  emailFallback: {
    hint: 'You can still sign in with your email and password.',
    action: 'Sign in with email',
  },
  toasts: {
    sent: 'OTP sent successfully',
    resent: 'Verification code sent again',
    verified: 'Phone number verified successfully!',
  },
  fallbacks: {
    send: 'Failed to send OTP',
    resend: 'Failed to resend code',
    verify: 'Failed to verify code',
    invalidCode: 'Invalid verification code',
  },
} as const;
