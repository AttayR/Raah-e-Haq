import React from 'react';
import { useAppTheme, type AppearancePreference } from '../../../app/providers/ThemeProvider';
import { SUPPORTED_LOCALES, t, type Locale, type TranslationKey } from '../../../i18n';
import { changeLanguage, useLocale } from '../../../i18n/languagePreference';
import { ChoiceSheetRow, type Choice } from './ChoiceSheetRow';

const APPEARANCE_CHOICES: ReadonlyArray<{ value: AppearancePreference; label: TranslationKey; hint?: TranslationKey }> = [
  { value: 'system', label: 'account.appearanceSystem', hint: 'account.appearanceSystemHint' },
  { value: 'light', label: 'account.appearanceLight' },
  { value: 'dark', label: 'account.appearanceDark' },
];

/**
 * Appearance (T-601; shared-settings §5): System / Light / Dark as a value row with the radio
 * sheet. ThemeProvider persists the choice; it is applied once the sheet has closed.
 */
export function AppearanceRow() {
  const { scheme, setScheme } = useAppTheme();
  const choices: Choice<AppearancePreference>[] = APPEARANCE_CHOICES.map((c) => ({
    value: c.value,
    label: t(c.label),
    hint: c.hint ? t(c.hint) : undefined,
  }));
  return (
    <ChoiceSheetRow
      icon="theme"
      title={t('account.appearance')}
      value={scheme}
      choices={choices}
      onChoose={setScheme}
      testID="settings-appearance"
    />
  );
}

/** Each language is named in itself (same in every language) with a short line under it. */
const LANGUAGE_LABELS: Record<Locale, { name: TranslationKey; hint: TranslationKey }> = {
  en: { name: 'language.english', hint: 'language.englishHint' },
  'ur-Latn': { name: 'language.romanUrdu', hint: 'language.romanUrduHint' },
};

/**
 * Language (T-523; shared-settings §5): the same value row and sheet. The switch remounts the
 * navigation tree (App.tsx), so it is applied after the sheet has closed.
 */
export function LanguageRow() {
  const locale = useLocale();
  const choices: Choice<Locale>[] = SUPPORTED_LOCALES.map((option) => ({
    value: option,
    label: t(LANGUAGE_LABELS[option].name),
    hint: t(LANGUAGE_LABELS[option].hint),
  }));
  return (
    <ChoiceSheetRow
      icon="language"
      title={t('language.rowTitle')}
      value={locale}
      choices={choices}
      onChoose={changeLanguage}
      testID="settings-language"
    />
  );
}
