import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Icon } from '../../../components/ui';
import { t } from '../../../i18n';
import { componentTokens, radius, space } from '../../../theme';

type Props = { pin: string; testID?: string };

const k = componentTokens.safety;

/**
 * The passenger's ride PIN on the driver-assigned card (T-520, BE-81), like Uber's: four large
 * digits in tiles and "Share this PIN with your driver". The driver types it to start the trip,
 * so the right car picks up the right passenger. Screen readers hear the digits one by one.
 */
export function RidePinCard({ pin, testID = 'ride-pin-card' }: Props) {
  const { theme } = useAppTheme();
  const c = theme.colors;
  const digits = pin.split('');
  return (
    <View
      style={[styles.card, { backgroundColor: c.primarySoft }]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={t('safety.pinA11y', { digits: digits.join(' ') })}
      testID={testID}
    >
      <View style={styles.text}>
        <View style={styles.titleRow}>
          <Icon name="lock" size={16} color="onPrimarySoft" />
          <AppText variant="label" color="onPrimarySoft">
            {t('safety.pinTitle')}
          </AppText>
        </View>
        <AppText variant="caption" color="onPrimarySoft" testID={`${testID}-hint`}>
          {t('safety.pinHint')}
        </AppText>
      </View>
      <View style={styles.digits} importantForAccessibility="no-hide-descendants">
        {digits.map((digit, index) => (
          <View key={index} style={[styles.digit, { backgroundColor: c.surface, borderColor: c.border }]}>
            <AppText variant="numericL" testID={`${testID}-digit-${index}`}>
              {digit}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    padding: space[3],
    borderRadius: radius.md,
  },
  text: { flex: 1, minWidth: 0, gap: space[1] },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  digits: { flexDirection: 'row', gap: space[1] },
  digit: {
    width: k.pinDigitWidth,
    height: k.pinDigitHeight,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
