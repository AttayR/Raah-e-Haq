import React from 'react';
import { useLocale } from '../../i18n/languagePreference';

/**
 * T-523: how screens follow a language switch without an app restart.
 *
 * Screens read their copy at render time (`t()`, `FOO_COPY.x`), so each one has to render again
 * after a switch. `localeScreenLayout` is the `screenLayout` of every navigator whose screens
 * are leaf screens: the screen's content is keyed on the language, so a switch remounts the
 * screen and it reads the new copy. A focused screen remounts at once; a frozen one
 * (`freezeOnBlur`) when it is next shown.
 *
 * Only screens are remounted, never a navigator or the container: the navigation state stays as
 * it is, and the stack-level session hooks (active-ride restore, push registration, unread count,
 * driver status sync, location tracker) stay mounted, so nothing runs again or navigates on a
 * switch. A screen that hosts a nested navigator uses `keepScreenMounted` instead (remounting a
 * navigator resets its state).
 */
function LocaleKeyed({ children }: { children: React.ReactElement }) {
  const locale = useLocale();
  return <React.Fragment key={locale}>{children}</React.Fragment>;
}

export const localeScreenLayout = ({ children }: { children: React.ReactElement }): React.ReactElement => (
  <LocaleKeyed>{children}</LocaleKeyed>
);

/** `layout` of a screen that is itself a navigator (the tabs): never remounted on a switch. */
export const keepScreenMounted = ({ children }: { children: React.ReactElement }): React.ReactElement => children;
