import React, { useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { t } from '../../i18n';
import { componentTokens, radius, space } from '../../theme';
import { AppText } from './AppText';
import { BottomSheet, type BottomSheetHandle } from './BottomSheet';
import { Icon } from './Icon';
import { ListItem } from './ListItem';

export type SelectOption = { value: string; label: string };

export type SelectFieldProps = {
  label: string;
  value: string;
  options: ReadonlyArray<SelectOption>;
  onChange: (value: string) => void;
  /** Shown while nothing is chosen; defaults to "Select". */
  placeholder?: string;
  /** Title of the picker sheet; defaults to the label. */
  sheetTitle?: string;
  helper?: string;
  error?: string | null;
  disabled?: boolean;
  testID?: string;
};

const k = componentTokens.textField;

/**
 * Select field (UI-R7): looks like a TextField (label, 52pt `surfaceAlt` field, helper or error)
 * with the chosen option and a chevron; tapping opens a modal BottomSheet listing the options,
 * the chosen one with a check. Replaces the absolutely positioned dropdown lists of the legacy
 * registration form (they overlapped fields and nested a scroll view in the form).
 */
export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder,
  sheetTitle,
  helper,
  error,
  disabled = false,
  testID,
}: SelectFieldProps) {
  const { theme } = useAppTheme();
  const c = theme.colors;
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<BottomSheetHandle>(null);
  // A field above may still have the keyboard up: close it first, so the sheet opens alone.
  const openSheet = () => {
    Keyboard.dismiss();
    setOpen(true);
  };
  const chosen = options.find(option => option.value === value);
  const hasError = !!error;
  const name = [
    label,
    chosen?.label,
    hasError ? t('kit.errorA11y', { message: error as string }) : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <View style={styles.container} testID={testID}>
      <AppText variant="label" color="textSecondary" style={styles.label}>
        {label}
      </AppText>
      <Pressable
        testID={testID ? `${testID}-field` : undefined}
        onPress={openSheet}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={name}
        accessibilityHint={t('kit.selectHint')}
        accessibilityState={{ disabled, expanded: open }}
        style={({ pressed }) => [
          styles.field,
          {
            borderColor: hasError ? c.danger : c.borderStrong,
            borderWidth: hasError
              ? theme.borderWidth.focus
              : theme.borderWidth.thin,
            backgroundColor:
              pressed && !disabled ? c.surfaceAltPressed : c.surfaceAlt,
          },
          disabled && styles.disabled,
        ]}
      >
        <AppText
          variant="body"
          color={chosen ? 'textPrimary' : 'textMuted'}
          numberOfLines={1}
          style={styles.value}
        >
          {chosen?.label ?? placeholder ?? t('kit.selectPlaceholder')}
        </AppText>
        <Icon name="chevronDown" size={20} color="textSecondary" />
      </Pressable>
      {hasError ? (
        <View style={styles.helper} accessibilityLiveRegion="polite">
          <Icon name="warning" size={k.helperIconSize} color="danger" />
          <AppText
            variant="caption"
            color="danger"
            style={styles.helperText}
            testID={testID ? `${testID}-error` : undefined}
          >
            {error}
          </AppText>
        </View>
      ) : helper ? (
        <AppText
          variant="caption"
          color="textSecondary"
          style={styles.helperOnly}
        >
          {helper}
        </AppText>
      ) : null}
      {/* The kit sheet owns its Modal: it renders nothing while closed (no scroll view inside the
          form) and unmounts only after its close animation. */}
      <BottomSheet
        ref={sheetRef}
        mode="modal"
        visible={open}
        onClose={() => setOpen(false)}
        accessibilityLabel={sheetTitle ?? label}
        testID={testID ? `${testID}-sheet` : undefined}
        header={
          <AppText
            variant="h3"
            accessibilityRole="header"
            style={styles.sheetTitle}
          >
            {sheetTitle ?? label}
          </AppText>
        }
      >
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={label}
          style={styles.options}
        >
          {options.map(option => {
            const selected = option.value === value;
            return (
              <ListItem
                key={option.value}
                title={option.label}
                onPress={() => {
                  onChange(option.value);
                  // Animates out, then onClose: the Modal never unmounts in the press's own tick.
                  sheetRef.current?.close();
                }}
                chevron={false}
                trailing={
                  selected ? (
                    <Icon name="checkMark" size={20} color="primaryText" />
                  ) : undefined
                }
                accessibilityLabel={
                  selected
                    ? `${option.label}, ${t('kit.selectedA11y')}`
                    : option.label
                }
                testID={testID ? `${testID}-option-${option.value}` : undefined}
              />
            );
          })}
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: 'stretch' },
  label: { marginBottom: k.labelGap },
  field: {
    minHeight: k.height,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    borderRadius: radius.md,
    paddingHorizontal: k.paddingHorizontal - 1,
  },
  value: { flex: 1, minWidth: 0 },
  helper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    marginTop: k.helperGap,
  },
  helperText: { flexShrink: 1 },
  helperOnly: { marginTop: k.helperGap },
  disabled: { opacity: k.disabledOpacity },
  sheetTitle: { paddingHorizontal: space[4], paddingBottom: space[2] },
  options: { paddingBottom: space[4] },
});
