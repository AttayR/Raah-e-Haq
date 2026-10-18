/**
 * User-facing copy of the sign-in screen and the forgot-password sheet (UI-R6, specs auth-login
 * and auth-forgot-password). One place, so it can move into the i18n catalogue (Urdu) as a unit.
 * Server messages (wrong password, refusals, reset sent) are shown as sent; these only frame them.
 */
export const LOGIN_COPY = {
  brandName: 'Raah-e-Haq',
  title: 'Sign in to Raah-e-Haq',
  subtitle: 'Ride or drive with Raah-e-Haq.',
  methodA11y: 'Sign-in method',
  methods: { phone: 'Phone', email: 'Email' },
  phone: {
    hint: "We'll text a 6-digit code to your mobile number. No password needed.",
    action: 'Continue with phone',
  },
  email: {
    emailLabel: 'Email',
    emailPlaceholder: 'name@example.com',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Your password',
    forgot: 'Forgot password?',
    submit: 'Sign in',
    submitting: 'Signing in',
  },
  validation: {
    emailRequired: 'Enter your email.',
    emailInvalid: 'Enter a valid email, like name@example.com.',
    passwordRequired: 'Enter your password.',
    passwordShort: 'Password must be at least 6 characters.',
  },
  footer: {
    prompt: 'New to Raah-e-Haq?',
    action: 'Create account',
  },
  toasts: {
    success: 'Login successful!',
    failed: 'Login failed. Please try again.',
    unexpected: 'An unexpected error occurred. Please try again.',
    navigation: 'Something went wrong. Please try again.',
  },
  forgot: {
    title: 'Reset your password',
    body: "Enter the email you signed up with. We'll send a link to reset your password.",
    submit: 'Send reset link',
    cancel: 'Cancel',
    sentTitle: 'Check your email',
    /** Shown whether or not the account exists (BE-27: the server answers the same either way). */
    sentBody: (email: string) => `If an account exists for ${email}, you'll get a reset link in a few minutes.`,
    done: 'Done',
    failed: "Couldn't send the link. Try again.",
    sheetA11y: 'Reset your password',
  },
} as const;
