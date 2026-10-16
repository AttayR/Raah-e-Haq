import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Chip, Radio, TextField } from '../../../components/ui';
import { t } from '../../../i18n';
import { space } from '../../../theme';
import { formatMoney } from '../../../utils/format';
import { PARCEL_LIMITS } from '../api';
import type { ParcelDraft, ParcelField, ParcelFieldErrors, ParcelOptions } from '../types';

type Props = {
  options: ParcelOptions;
  draft: ParcelDraft;
  errors: ParcelFieldErrors;
  update: <K extends keyof ParcelDraft>(key: K, value: ParcelDraft[K], field: ParcelField) => void;
};

const FieldError = ({ text, testID }: { text?: string; testID: string }) =>
  text ? (
    <AppText variant="bodySmall" color="danger" accessibilityRole="alert" testID={testID}>
      {text}
    </AppText>
  ) : null;

/** The receiver (name, mobile) and the item (category, size, declared value, description). */
export function ParcelDetailsSection({ options, draft, errors, update }: Props) {
  return (
    <>
      <View style={styles.section}>
        <AppText variant="title" accessibilityRole="header">
          {t('parcel.receiverTitle')}
        </AppText>
        <TextField
          label={t('parcel.receiverName')}
          placeholder={t('parcel.receiverNamePlaceholder')}
          value={draft.receiverName}
          onChangeText={(text) => update('receiverName', text, 'receiverName')}
          maxLength={PARCEL_LIMITS.receiverNameMax}
          autoCapitalize="words"
          autoComplete="off"
          textContentType="none"
          error={errors.receiverName}
          testID="parcel-receiver-name"
        />
        <TextField
          variant="phone"
          label={t('parcel.receiverPhone')}
          helper={t('parcel.receiverPhoneHelper')}
          value={draft.receiverPhone}
          onChangeText={(digits) => update('receiverPhone', digits, 'receiverPhone')}
          error={errors.receiverPhone}
          // T-561: the phone pad has no return key; the Done bar closes it (iOS).
          doneBar
          testID="parcel-receiver-phone"
        />
      </View>

      <View style={styles.section}>
        <AppText variant="title" accessibilityRole="header">
          {t('parcel.itemTitle')}
        </AppText>
        <AppText variant="label" color="textSecondary">
          {t('parcel.categoryLabel')}
        </AppText>
        <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t('parcel.categoryLabel')}>
          {options.categories.map((c) => (
            <Chip
              key={c.key}
              label={c.label}
              selected={draft.itemCategory === c.key}
              accessibilityRole="radio"
              onPress={() => update('itemCategory', c.key, 'itemCategory')}
              testID={`parcel-category-${c.key}`}
            />
          ))}
        </View>
        <FieldError text={errors.itemCategory} testID="parcel-category-error" />

        <AppText variant="label" color="textSecondary">
          {t('parcel.sizeLabel')}
        </AppText>
        <View accessibilityRole="radiogroup" accessibilityLabel={t('parcel.sizeLabel')}>
          {options.sizes.map((s) => (
            <Radio
              key={s.key}
              label={s.label}
              description={s.maxWeightKg !== null ? t('parcel.sizeWeight', { kg: s.maxWeightKg }) : undefined}
              selected={draft.sizeClass === s.key}
              onSelect={() => update('sizeClass', s.key, 'sizeClass')}
              testID={`parcel-size-${s.key}`}
            />
          ))}
        </View>
        <FieldError text={errors.sizeClass} testID="parcel-size-error" />

        <TextField
          label={t('parcel.valueLabel')}
          helper={t('parcel.valueHelper', { max: formatMoney(options.maxDeclaredValue, options.currency) })}
          value={draft.declaredValue}
          onChangeText={(text) => update('declaredValue', text.replace(/\D/g, '').slice(0, 9), 'declaredValue')}
          keyboardType="number-pad"
          doneBar
          error={errors.declaredValue}
          testID="parcel-declared-value"
        />
        <TextField
          label={t('parcel.descriptionLabel')}
          placeholder={t('parcel.descriptionPlaceholder')}
          value={draft.itemDescription}
          onChangeText={(text) => update('itemDescription', text, 'itemDescription')}
          maxLength={PARCEL_LIMITS.descriptionMax}
          multiline
          doneBar
          error={errors.itemDescription}
          testID="parcel-description"
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  section: { gap: space[3] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
});
