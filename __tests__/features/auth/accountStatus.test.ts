/**
 * T-106: the account-status variant comes from apiAuth.user status + role only, with copy
 * from the copy file; login/verify-otp refusals show the server message plus the reason.
 */
import { accountStatusView, resolveAccountStatusVariant } from '../../../src/features/auth/accountStatus';
import { ACCOUNT_STATUS_VARIANTS } from '../../../src/features/auth/copy/accountStatus';
import { accountRefusalMessage, accountRefusalParts } from '../../../src/core/auth/accountRefusal';
import { routesHome } from '../../../src/core/auth/normalizeUser';
import { DarkTheme, LightTheme } from '../../../src/theme';
import { toRejectedItems, uploadProblem, MAX_UPLOAD_BYTES } from '../../../src/features/auth/documentsApi';
import type { AccountStatus, UserRole } from '../../../src/services/api';

const u = (status: AccountStatus, role: UserRole | null, rejection_reason?: string | null) => ({ status, role, rejection_reason });

describe('resolveAccountStatusVariant', () => {
  it.each([
    [u('pending', 'driver'), 'pendingDriver'],
    [u('pending', 'passenger'), 'pendingPassenger'],
    [u('pending', null), 'pendingPassenger'],
    [u('suspended', 'driver'), 'suspended'],
    [u('rejected', 'driver'), 'rejected'],
    [u('inactive', 'passenger'), 'inactive'],
    [u('active', 'admin'), 'unsupportedRole'],
    [u('active', null), 'unsupportedRole'],
  ])('%p -> %s', (user, variant) => {
    expect(resolveAccountStatusVariant(user, false)).toBe(variant);
  });

  it('an unconfirmed status (malformed 200) wins over the stored status', () => {
    expect(resolveAccountStatusVariant(u('inactive', 'driver'), true)).toBe('unverified');
    expect(resolveAccountStatusVariant(u('active', 'driver'), true)).toBe('unverified');
  });

  it('every variant has distinct copy', () => {
    const titles = Object.values(ACCOUNT_STATUS_VARIANTS).map((c) => c.title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});

describe('accountStatusView', () => {
  it('shows the rejection reason for rejected (and suspended) only', () => {
    expect(accountStatusView(u('rejected', 'driver', ' Blurry licence '), false).reason).toBe('Blurry licence');
    expect(accountStatusView(u('pending', 'driver', 'old reason'), false).reason).toBeNull();
    expect(accountStatusView(u('rejected', 'driver', null), false).reason).toBeNull();
  });

  it('pending drivers get the rejected-documents list; nobody else does', () => {
    expect(accountStatusView(u('pending', 'driver'), false).showRejectedDocuments).toBe(true);
    expect(accountStatusView(u('pending', 'passenger'), false).showRejectedDocuments).toBe(false);
    expect(accountStatusView(u('rejected', 'driver'), false).showRejectedDocuments).toBe(false);
  });

  it('an active admin is not offered Check Status; an account without a role is', () => {
    expect(accountStatusView(u('active', 'admin'), false).canCheckStatus).toBe(false);
    expect(accountStatusView(u('active', null), false).canCheckStatus).toBe(true);
    expect(accountStatusView(u('pending', 'driver'), false).canCheckStatus).toBe(true);
  });
});

describe('accountRefusalMessage (login / verify-otp 403)', () => {
  it('adds the rejection reason to the server message', () => {
    const message = accountRefusalMessage(
      {
        message: 'Your account application was not approved. Please contact support.',
        kind: 'forbidden',
        status: 403,
        code: 'ACCOUNT_REJECTED',
        fieldErrors: {},
        account: { status: 'rejected', rejectionReason: 'Licence expired' },
      },
      'Login failed',
    );
    expect(message).toBe('Your account application was not approved. Please contact support.\nReason: Licence expired');
  });

  it('shows the server message for other refusals, and leaves other errors alone', () => {
    expect(
      accountRefusalMessage(
        { message: 'Your account has been suspended.', kind: 'forbidden', status: 403, code: 'ACCOUNT_SUSPENDED', fieldErrors: {}, account: { status: 'suspended' } },
        'Login failed',
      ),
    ).toBe('Your account has been suspended.');
    expect(accountRefusalMessage({ message: 'Wrong password', kind: 'auth', status: 401, fieldErrors: {} }, 'Login failed')).toBe('Wrong password');
    expect(accountRefusalMessage(undefined, 'Login failed')).toBe('Login failed');
  });
});

describe('documents (GET /profile/documents)', () => {
  it('lists only rejected documents and vehicles, with their reasons', () => {
    const items = toRejectedItems({
      cnic_front_image: 'https://signed.example.test/x',
      documents: [
        { id: 1, document_type: 'cnic_front', verification_status: 'rejected', rejection_reason: 'Blurry' },
        { id: 2, document_type: 'driving_license', verification_status: 'approved', rejection_reason: null },
        { id: 3, document_type: 'police_certificate', verification_status: 'rejected', rejection_reason: null },
      ],
      vehicles: [
        { id: 10, verification_status: 'approved', rejection_reason: null },
        { id: 9, verification_status: 'rejected', rejection_reason: 'Plate not visible' },
      ],
    });
    expect(items).toEqual([
      { key: 'document-1', kind: 'document', id: 1, label: 'CNIC (front)', reason: 'Blurry' },
      { key: 'document-3', kind: 'document', id: 3, label: 'Police certificate', reason: null },
      // Named by position in the whole vehicle list (the payload has no make/plate).
      { key: 'vehicle-9', kind: 'vehicle', id: 9, label: 'Vehicle #2', reason: 'Plate not visible' },
    ]);
    expect(toRejectedItems(null)).toEqual([]);
  });

  it('accepts JPEG/PNG up to 5 MB only', () => {
    expect(uploadProblem({ type: 'image/jpeg', fileSize: 1000 })).toBeNull();
    expect(uploadProblem({ type: 'image/png' })).toBeNull();
    expect(uploadProblem({ type: 'image/heic', fileSize: 1000 })).not.toBeNull();
    expect(uploadProblem({ type: 'image/jpeg', fileSize: MAX_UPLOAD_BYTES + 1 })).not.toBeNull();
    expect(uploadProblem({})).not.toBeNull();
  });
});

describe('accountRefusalParts (toast: reason as the second line)', () => {
  it('splits message and reason, so a 2-line title limit never cuts the reason', () => {
    expect(
      accountRefusalParts(
        { message: 'Not approved.', kind: 'forbidden', status: 403, code: 'ACCOUNT_REJECTED', fieldErrors: {}, account: { status: 'rejected', rejectionReason: 'Licence expired' } },
        'Login failed',
      ),
    ).toEqual({ message: 'Not approved.', reason: 'Reason: Licence expired' });
    expect(accountRefusalParts({ message: 'Wrong password', kind: 'auth', status: 401, fieldErrors: {} }, 'x')).toEqual({
      message: 'Wrong password',
      reason: null,
    });
  });
});

describe('routesHome ("Login successful" only when it is true)', () => {
  it('is true only for an active driver or passenger', () => {
    expect(routesHome({ status: 'active', role: 'driver' })).toBe(true);
    expect(routesHome({ status: 'active', role: 'passenger' })).toBe(true);
    expect(routesHome({ status: 'active', role: 'admin' })).toBe(false);
    expect(routesHome({ status: 'active', role: null })).toBe(false);
    expect(routesHome({ status: 'pending', role: 'driver' })).toBe(false);
  });
});

/** WCAG relative luminance of #rgb / #rrggbb / #rrggbbaa (alpha ignored: opaque fills). */
const luminance = (hex: string): number => {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('theme tokens for outline / disabled controls (QA T-106 dark mode)', () => {
  it.each([
    ['light', LightTheme],
    ['dark', DarkTheme],
  ])('%s: accent text >= 4.5:1 on surface and background; disabled label >= 4.5:1', (_mode, theme) => {
    const { colors } = theme;
    expect(contrast(colors.accent, colors.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.accent, colors.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.disabledText, colors.disabledFill)).toBeGreaterThanOrEqual(4.5);
  });

  it('dark mode outline controls use primaryText, not the primary fill', () => {
    // T-601: the dark primary fill (navy-500) is only 3.09:1 on surface, below text contrast.
    expect(contrast(DarkTheme.colors.primary, DarkTheme.colors.surface)).toBeLessThan(4.5);
    expect(DarkTheme.colors.accent).toBe(DarkTheme.colors.primaryText);
    expect(DarkTheme.colors.accent).not.toBe(DarkTheme.colors.primary);
  });
});
