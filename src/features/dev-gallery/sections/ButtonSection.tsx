import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AppText,
  Button,
  IconButton,
  type ButtonSize,
  type ButtonVariant,
} from '../../../components/ui';
import { t, type TranslationKey } from '../../../i18n';
import { space } from '../../../theme';
import { GallerySection } from './GallerySection';

const noop = () => {};

export const BUTTON_VARIANTS: Array<[ButtonVariant, TranslationKey]> = [
  ['primary', 'kitGallery.buttonPrimary'],
  ['secondary', 'kitGallery.buttonSecondary'],
  ['outline', 'kitGallery.buttonOutline'],
  ['ghost', 'kitGallery.buttonGhost'],
  ['destructive', 'kitGallery.buttonDestructive'],
  ['destructiveSoft', 'kitGallery.buttonDestructiveSoft'],
];

const SIZES: ButtonSize[] = ['lg', 'md', 'sm'];

function Caption({ children }: { children: string }) {
  return (
    <AppText variant="caption" color="textMuted">
      {children}
    </AppText>
  );
}

/**
 * Buttons (DESIGN_SYSTEM §5.4) for UI-R2 design review. Part 1: every variant at `md` (full
 * width) and `sm` (hugging). Part 2: the three sizes with leading/trailing icons (icon gaps 8/8/6),
 * then disabled and loading for every variant, and the IconButton variants (§5.5). Part 3: every
 * variant at `lg` (56) and a full-width loading button that keeps its size.
 */
export function ButtonSection({ part }: { part: 1 | 2 | 3 }) {
  if (part === 3) {
    return <LargeButtons />;
  }
  return (
    <GallerySection title={`${t('kitGallery.sectionButtons')} ${part}/3`}>
      {part === 1 ? (
        <>
          {BUTTON_VARIANTS.map(([variant, key]) => (
            <Button
              key={variant}
              label={t(key)}
              variant={variant}
              onPress={noop}
              testID={`gallery-button-${variant}`}
            />
          ))}
          <Caption>{t('kitGallery.sizeLabel', { size: 'sm' })}</Caption>
          <View style={styles.row}>
            {BUTTON_VARIANTS.map(([variant, key]) => (
              <Button
                key={variant}
                label={t(key)}
                variant={variant}
                size="sm"
                fullWidth={false}
                onPress={noop}
              />
            ))}
          </View>
        </>
      ) : (
        <>
          {SIZES.map(size => (
            <View key={size} style={styles.sizeBlock}>
              <Caption>{t('kitGallery.sizeLabel', { size })}</Caption>
              <Button
                label={t('kitGallery.buttonPrimary')}
                size={size}
                leadingIcon="car"
                trailingIcon="chevronEnd"
                fullWidth={size !== 'sm'}
                onPress={noop}
                testID={`gallery-button-size-${size}`}
              />
            </View>
          ))}
          <Caption>{t('kitGallery.buttonDisabled')}</Caption>
          <View style={styles.row}>
            {BUTTON_VARIANTS.map(([variant, key]) => (
              <Button
                key={variant}
                label={t(key)}
                variant={variant}
                size="sm"
                fullWidth={false}
                disabled
                onPress={noop}
              />
            ))}
          </View>
          <Caption>{t('kitGallery.buttonLoading')}</Caption>
          <View style={styles.row}>
            {BUTTON_VARIANTS.map(([variant, key]) => (
              <Button
                key={variant}
                label={t(key)}
                variant={variant}
                size="sm"
                fullWidth={false}
                loading
                onPress={noop}
              />
            ))}
          </View>
          <View style={styles.row}>
            <IconButton
              icon="more"
              onPress={noop}
              accessibilityLabel={t('kitGallery.buttonPrimary')}
            />
            <IconButton
              icon="close"
              variant="tonal"
              onPress={noop}
              accessibilityLabel={t('common.close')}
            />
            <IconButton
              icon="locate"
              variant="floating"
              onPress={noop}
              accessibilityLabel={t('kitGallery.locateA11y')}
            />
            <IconButton
              icon="close"
              variant="tonal"
              disabled
              onPress={noop}
              accessibilityLabel={t('kitGallery.buttonDisabled')}
            />
          </View>
        </>
      )}
    </GallerySection>
  );
}

function LargeButtons() {
  return (
    <GallerySection title={`${t('kitGallery.sectionButtons')} 3/3`}>
      <Caption>{t('kitGallery.sizeLabel', { size: 'lg' })}</Caption>
      {BUTTON_VARIANTS.map(([variant, key]) => (
        <Button
          key={variant}
          label={t(key)}
          variant={variant}
          size="lg"
          onPress={noop}
          testID={`gallery-button-lg-${variant}`}
        />
      ))}
      <Caption>{t('kitGallery.loadingFullWidth')}</Caption>
      <Button
        label={t('kitGallery.buttonPrimary')}
        size="lg"
        loading
        onPress={noop}
        testID="gallery-button-loading-full"
      />
    </GallerySection>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space[2],
  },
  sizeBlock: { gap: space[1] },
});
