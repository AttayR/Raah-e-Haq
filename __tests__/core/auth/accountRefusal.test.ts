/**
 * T-714 (BE-141): login / verify-otp answer 403 ADMIN_USE_PANEL for an admin account. The app
 * shows its own admin copy ("Admins use the web dashboard") in the active language, never the
 * server's text.
 */
import { accountRefusalMessage, accountRefusalParts, isAdminUsePanelRefusal } from '../../../src/core/auth/accountRefusal';
import type { ThunkRejection } from '../../../src/core/api/errors';
import { setLocale } from '../../../src/i18n';
import '../../../src/i18n/copy-ur-Latn';

const admin: ThunkRejection = {
  message: 'Server text for admins',
  kind: 'forbidden',
  status: 403,
  code: 'ADMIN_USE_PANEL',
  fieldErrors: {},
};

describe('accountRefusalParts: ADMIN_USE_PANEL (T-714)', () => {
  afterEach(() => setLocale('en'));

  it('recognises only a 403 with the code', () => {
    expect(isAdminUsePanelRefusal(admin)).toBe(true);
    expect(isAdminUsePanelRefusal({ ...admin, status: 401 })).toBe(false);
    expect(isAdminUsePanelRefusal({ ...admin, code: 'ACCOUNT_SUSPENDED' })).toBe(false);
    expect(isAdminUsePanelRefusal(undefined)).toBe(false);
  });

  it('maps to the admin copy, not the server text', () => {
    expect(accountRefusalParts(admin, 'fallback')).toEqual({
      message: 'This app is for passengers and drivers',
      reason: 'Admins use the web dashboard. Sign in with a passenger or driver account.',
    });
    expect(accountRefusalMessage(admin, 'fallback')).toBe(
      'This app is for passengers and drivers\nAdmins use the web dashboard. Sign in with a passenger or driver account.',
    );
  });

  it('reads in Roman Urdu when that language is active', () => {
    setLocale('ur-Latn');
    expect(accountRefusalParts(admin, 'fallback')).toEqual({
      message: 'Ye app sawariyon aur drivers ke liye hai',
      reason: 'Admins web dashboard istemal karte hain. Passenger ya driver account se sign in karein.',
    });
  });

  it('any other 403 keeps the server message', () => {
    expect(accountRefusalParts({ ...admin, code: 'SOMETHING_ELSE' }, 'fallback')).toEqual({
      message: 'Server text for admins',
      reason: null,
    });
  });
});
