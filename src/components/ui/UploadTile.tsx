import React from 'react';
import { Image, Pressable, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { t } from '../../i18n';
import { componentTokens, radius, space } from '../../theme';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { IconButton } from './IconButton';

const k = componentTokens.uploadTile;

export type UploadTileProps = {
  /** What the photo is ("CNIC front"); shown above the tile and read by screen readers. */
  label: string;
  /** Local file URI of the picked photo; empty or undefined while there is none. */
  uri?: string | null;
  /** Opens the picker (empty tile, or the replace button of a filled one). */
  onPress: () => void;
  /** Filled tiles: a remove button instead of replace (a set of sides, where order matters). */
  onRemove?: () => void;
  /** Adds a separate `*` after the label (only fields the schema requires, T-206). */
  required?: boolean;
  /** The field's error: `danger` border and the message under the tile. */
  error?: string | null;
  /** Caption under the add glyph; defaults to the accepted formats. */
  hint?: string;
  /** `wide`: full width, 120 high (104 on small phones). `square`: one 4:3 tile of a grid of sides, label below. */
  shape?: 'wide' | 'square';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Testing hooks of the remove/replace action; default `${testID}-remove` / `-replace`. */
  removeTestID?: string;
};

/**
 * Photo upload tile (spec auth-registration, UI-R7). Empty: dashed 1.5pt `borderStrong` on
 * `surfaceAlt` with a camera glyph, "Add photo" and the accepted formats. Filled: the photo
 * (cover, radius `lg`) with a floating 32pt replace (or remove) button 8 in from the top end.
 * Error: 1.5pt `danger` border and the message below. The whole tile is a ≥44pt target.
 */
export function UploadTile({
  label,
  uri,
  onPress,
  onRemove,
  required = false,
  error,
  hint,
  shape = 'wide',
  disabled = false,
  style,
  testID,
  removeTestID,
}: UploadTileProps) {
  const { theme } = useAppTheme();
  const c = theme.colors;
  const { height: windowHeight } = useWindowDimensions();
  const compact = windowHeight < componentTokens.wizard.compactWindowHeight;
  const filled = !!uri;
  const square = shape === 'square';
  const hasError = !!error;
  const borderColor = hasError ? c.danger : filled ? c.border : c.borderStrong;
  const tileSize = square ? styles.square : { height: compact ? k.compactHeight : k.height };
  const a11yName = [
    t(filled ? 'kit.uploadFilledA11y' : 'kit.uploadEmptyA11y', { label }),
    required ? t('kit.requiredA11y') : null,
    hasError ? t('kit.errorA11y', { message: error as string }) : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <View style={[styles.wrap, square && styles.squareWrap, style]}>
      {square ? null : (
        <View style={styles.labelRow}>
          <AppText variant="label" color="textSecondary">
            {label}
          </AppText>
          {required ? (
            <AppText variant="label" color="danger">
              *
            </AppText>
          ) : null}
        </View>
      )}
      <View>
        <Pressable
          testID={testID}
          onPress={onPress}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={a11yName}
          accessibilityState={{ disabled }}
          style={({ pressed }) => [
            styles.tile,
            tileSize,
            {
              borderColor,
              borderStyle: filled || hasError ? 'solid' : 'dashed',
              backgroundColor: pressed && !disabled ? c.surfaceAltPressed : c.surfaceAlt,
            },
            disabled && styles.disabled,
          ]}
        >
          {filled ? (
            <Image source={{ uri: uri as string }} style={styles.photo} resizeMode="cover" accessibilityIgnoresInvertColors />
          ) : (
            <View style={styles.empty}>
              <Icon name="camera" size={square ? k.squareGlyph : k.glyph} color="primaryText" />
              {square ? null : (
                <>
                  <AppText variant="label" color="primaryText">
                    {t('kit.uploadAdd')}
                  </AppText>
                  <AppText variant="caption" color="textMuted" align="center">
                    {hint ?? t('kit.uploadHint')}
                  </AppText>
                </>
              )}
            </View>
          )}
        </Pressable>
        {filled ? (
          <View style={styles.action}>
            <IconButton
              icon={onRemove ? 'close' : 'edit'}
              variant="floating"
              size={k.action}
              onPress={onRemove ?? onPress}
              disabled={disabled}
              accessibilityLabel={t(onRemove ? 'kit.uploadRemoveA11y' : 'kit.uploadReplaceA11y', { label })}
              testID={removeTestID ?? (testID ? `${testID}-${onRemove ? 'remove' : 'replace'}` : undefined)}
            />
          </View>
        ) : null}
      </View>
      {square ? (
        <View style={styles.squareLabel}>
          <AppText variant="caption" color="textSecondary" align="center" numberOfLines={2}>
            {label}
          </AppText>
        </View>
      ) : null}
      {hasError ? (
        <View style={styles.error} accessibilityLiveRegion="polite">
          <Icon name="warning" size={16} color="danger" />
          <AppText variant="caption" color="danger" style={styles.errorText} testID={testID ? `${testID}-error` : undefined}>
            {error}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch' },
  squareWrap: { flex: 1, minWidth: k.squareMin },
  labelRow: { flexDirection: 'row', gap: space[1], marginBottom: componentTokens.textField.labelGap },
  tile: {
    borderRadius: radius.lg,
    borderWidth: k.border,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 4:3 like a phone photo of a car side.
  square: { aspectRatio: 4 / 3, borderRadius: radius.md },
  photo: { ...StyleSheet.absoluteFillObject },
  empty: { alignItems: 'center', gap: space[1], paddingHorizontal: space[4] },
  action: { position: 'absolute', top: k.actionInset, end: k.actionInset },
  squareLabel: { marginTop: space[1] },
  error: { flexDirection: 'row', alignItems: 'center', gap: space[1], marginTop: space[1] },
  errorText: { flexShrink: 1 },
  disabled: { opacity: componentTokens.state.disabledOpacity },
});
