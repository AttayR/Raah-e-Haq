import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { t } from '../../i18n';
import { componentTokens, radius } from '../../theme';
import { AppText } from './AppText';
import { Icon } from './Icon';

const b = componentTokens.brand;

/** `fixed`: the server's quote. `offer`: the passenger moved the offer stepper off the quote. */
export type FareTagKind = 'fixed' | 'offer';

export type FareTagProps = {
  kind?: FareTagKind;
  testID?: string;
};

/**
 * Fixed-fare tag (DESIGN_SYSTEM §1.7 M4, UI-R21) on the passenger's selected fare: a 24-high
 * `accentSoft` pill with a 16 `accentStrong` glyph and a `label` in `textPrimary` (the words are
 * never saffron). "Fixed fare" with a lock; "Your offer" with a hand-coin once the passenger has
 * moved the offer off the quote. Start-aligned; it grows with the text at 1.3×.
 */
export function FareTag({ kind = 'fixed', testID = 'fare-tag' }: FareTagProps) {
  const { theme } = useAppTheme();
  const offer = kind === 'offer';
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={offer ? t('kit.fareTagOffer') : t('kit.fareTagFixed')}
      style={[styles.tag, { backgroundColor: theme.colors.accentSoft }]}
    >
      <Icon name={offer ? 'fareOffer' : 'lock'} size={b.fareTagIcon} color="accentStrong" testID={`${testID}-icon`} />
      <AppText variant="label" color="textPrimary" style={styles.text}>
        {offer ? t('kit.fareTagOffer') : t('kit.fareTagFixed')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: b.fareTagMinHeight,
    paddingHorizontal: b.fareTagPaddingHorizontal,
    gap: b.fareTagGap,
    borderRadius: radius.pill,
  },
  text: { flexShrink: 1 },
});
