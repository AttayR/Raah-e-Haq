import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, IconButton } from '../../../components/ui';
import { haptics } from '../../../core/haptics';
import { t } from '../../../i18n';
import { radius, space } from '../../../theme';
import { formatMoney } from '../../../utils/format';
import { canStepOffer, type OfferDirection } from '../offer';
import type { FareOffer } from '../hooks';

/**
 * "Offer your fare" (BE-83): − / + move the offer by the band's step inside min..max, the
 * recommended (server) fare under it with a reset. No band (offers off): nothing renders.
 */
export function OfferStepper({ offer, testID = 'offer-stepper' }: { offer: FareOffer; testID?: string }) {
  const { theme } = useAppTheme();
  const { band, value } = offer;
  if (!band || value === null) return null;
  const amount = formatMoney(value);
  const stepText = formatMoney(band.step);
  const changed = value !== band.serverFare;
  const press = (direction: OfferDirection) => {
    haptics.selection();
    offer.step(direction);
  };
  return (
    <View style={[styles.card, { borderColor: theme.colors.border }]} testID={testID}>
      <AppText variant="label" color="textSecondary">
        {t('fare.offerTitle')}
      </AppText>
      <View style={styles.row}>
        <IconButton
          icon="minus"
          variant="tonal"
          onPress={() => press(-1)}
          disabled={!canStepOffer(band, value, -1)}
          accessibilityLabel={t('fare.offerDownA11y', { amount: stepText })}
          testID={`${testID}-down`}
        />
        <AppText
          variant="numericL"
          align="center"
          style={styles.value}
          accessibilityLabel={t('fare.offerValueA11y', { amount })}
          accessibilityLiveRegion="polite"
          testID={`${testID}-value`}
        >
          {amount}
        </AppText>
        <IconButton
          icon="add"
          variant="tonal"
          onPress={() => press(1)}
          disabled={!canStepOffer(band, value, 1)}
          accessibilityLabel={t('fare.offerUpA11y', { amount: stepText })}
          testID={`${testID}-up`}
        />
      </View>
      <View style={styles.meta}>
        <AppText variant="caption" color="textSecondary" style={styles.flex} testID={`${testID}-hint`}>
          {t('fare.offerHint', { min: formatMoney(band.min), max: formatMoney(band.max) })}
        </AppText>
        {changed ? (
          <Pressable
            onPress={offer.reset}
            accessibilityRole="button"
            hitSlop={10}
            testID={`${testID}-reset`}
          >
            <AppText variant="buttonSmall" color="primaryText">
              {t('fare.offerReset')}
            </AppText>
          </Pressable>
        ) : (
          <AppText variant="caption" color="textMuted" testID={`${testID}-recommended`}>
            {t('fare.offerRecommended', { amount: formatMoney(band.serverFare) })}
          </AppText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: space[3], gap: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  value: { flex: 1 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  flex: { flex: 1, minWidth: 0 },
});
