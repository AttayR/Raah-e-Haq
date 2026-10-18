import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, BottomSheet, Icon, ListItem, type BottomSheetHandle } from '../../ui';
import { SUPPORTED_LOCALES, t, type Locale, type TranslationKey } from '../../../i18n';
import { changeLanguage, useLocale } from '../../../i18n/languagePreference';
import { space } from '../../../theme';

/** Each language is named in itself (same in every language) with a short line under it. */
const LANGUAGE_LABELS: Record<Locale, { name: TranslationKey; hint: TranslationKey }> = {
  en: { name: 'language.english', hint: 'language.englishHint' },
  'ur-Latn': { name: 'language.romanUrdu', hint: 'language.romanUrduHint' },
};

/**
 * Language setting (T-523), Account → App on both roles: a row with the current language that
 * opens a kit sheet listing the languages. The switch is applied after the sheet has closed: it
 * remounts the navigation tree (App.tsx), which would otherwise unmount the sheet mid-animation.
 */
export function LanguageRow() {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<BottomSheetHandle>(null);
  const chosen = useRef<Locale | null>(null);

  const onClose = () => {
    setOpen(false);
    const next = chosen.current;
    chosen.current = null;
    if (next && next !== locale) {
      changeLanguage(next);
    }
  };

  const current = t(LANGUAGE_LABELS[locale].name);

  return (
    <>
      <ListItem
        icon="language"
        title={t('language.rowTitle')}
        value={current}
        onPress={() => setOpen(true)}
        accessibilityLabel={`${t('language.rowTitle')}, ${current}`}
        accessibilityHint={t('language.hint')}
        testID="settings-language"
      />
      <BottomSheet
        ref={sheetRef}
        mode="modal"
        visible={open}
        onClose={onClose}
        accessibilityLabel={t('language.sheetTitle')}
        testID="settings-language-sheet"
        header={
          <AppText variant="h3" accessibilityRole="header" style={styles.sheetTitle}>
            {t('language.sheetTitle')}
          </AppText>
        }
      >
        <View accessibilityRole="radiogroup" accessibilityLabel={t('language.rowTitle')} style={styles.options}>
          {SUPPORTED_LOCALES.map(option => {
            const selected = option === locale;
            const name = t(LANGUAGE_LABELS[option].name);
            return (
              <ListItem
                key={option}
                title={name}
                subtitle={t(LANGUAGE_LABELS[option].hint)}
                chevron={false}
                trailing={selected ? <Icon name="checkMark" size={20} color="primaryText" /> : undefined}
                accessibilityLabel={name}
                selectionRole="radio"
                checked={selected}
                onPress={() => {
                  chosen.current = option;
                  // Animates out, then onClose applies the choice.
                  sheetRef.current?.close();
                }}
                testID={`settings-language-option-${option}`}
              />
            );
          })}
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  sheetTitle: { paddingHorizontal: space[4], paddingBottom: space[2] },
  options: { paddingBottom: space[4] },
});
