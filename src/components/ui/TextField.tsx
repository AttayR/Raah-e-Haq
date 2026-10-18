import React, { forwardRef, useEffect, useId, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { t } from '../../i18n';
import {
  componentTokens,
  MAX_FONT_SIZE_MULTIPLIER,
  radius,
  singleLineInputStyle,
  space,
  textStyles,
} from '../../theme';
import { AppText } from './AppText';
import { FieldLabel } from './FieldLabel';
import { Icon, type IconName } from './Icon';
import { IconButton } from './IconButton';
import { KeyboardDoneBar } from './KeyboardDoneBar';
import { useKeyboardReveal } from './keyboardReveal';
// No maxLength on `phone`: a pasted "+92 300 1234567" must reach the normaliser whole (it caps at 10).
import { formatNationalPhone, toNationalDigits } from './phoneInput';

export type TextFieldVariant = 'default' | 'phone' | 'password' | 'search';

export type TextFieldProps = Omit<
  TextInputProps,
  'style' | 'editable' | 'secureTextEntry' | 'placeholderTextColor' | 'value' | 'onChangeText'
> & {
  value: string;
  /** For `phone` this receives the national digits only (no spaces, no +92, no leading 0). */
  onChangeText: (text: string) => void;
  label?: string;
  /** Required field: a `danger` `*` after the label and "required" in the spoken name (T-564). */
  required?: boolean;
  helper?: string;
  /** Error message: 2pt `danger` border, the message under the field, read with the label. */
  error?: string | null;
  variant?: TextFieldVariant;
  leadingIcon?: IconName;
  /** Trailing clear button while there is text. Default: on for `search`, off otherwise. */
  clearable?: boolean;
  disabled?: boolean;
  /**
   * iOS "Done" bar above the keyboard, for inputs without a return key (number pad, multiline).
   * The field renders its own bar with a unique `nativeID` (T-548): on Fabric an
   * InputAccessoryView attaches to only the first input in the window with its id, so one bar
   * shared by several fields shows on just one of them. Overrides `inputAccessoryViewID`.
   */
  doneBar?: boolean;
  testID?: string;
};

const k = componentTokens.textField;
/** Idle 1pt `borderStrong`; 2pt on focus/error (§5.6 [UI-R2]). Insets are 16 − border, so text never shifts. */
const IDLE_BORDER = 1;
const ACTIVE_BORDER = 2;
const singleLineText = singleLineInputStyle(textStyles.body);

/**
 * Text field (DESIGN_SYSTEM §5.6): label, 52pt `surfaceAlt` field (radius 12), helper or error.
 * Focus: 2pt `focusRing` + `surface` fill. Error: 2pt `danger` + message with an alert glyph.
 * Variants: `phone` (+92 prefix block, digits keypad, `3xx xxxxxxx`), `password` (show/hide),
 * `search` (40pt pill, magnify glyph). Disabled: 0.5 opacity. Multiline: 96 min, 5 lines max.
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  {
    value,
    onChangeText,
    label,
    required = false,
    helper,
    error,
    variant = 'default',
    leadingIcon,
    clearable,
    disabled = false,
    doneBar = false,
    multiline = false,
    testID,
    accessibilityLabel,
    onFocus,
    onBlur,
    ...inputProps
  },
  ref,
) {
  const { theme } = useAppTheme();
  const c = theme.colors;
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  // Inside a keyboard-aware scroll view the whole field (label to error) stays above the keyboard (T-545).
  const reveal = useKeyboardReveal();
  const containerRef = useRef<View>(null);
  const doneBarId = `textFieldDone${useId()}`;

  const isPhone = variant === 'phone';
  const isSearch = variant === 'search';
  const isPassword = variant === 'password';
  const leading: IconName | undefined = isSearch ? 'search' : leadingIcon;
  const showClear = (clearable ?? isSearch) && value.length > 0 && !disabled;
  const hasError = !!error;

  const borderWidth = hasError || focused ? ACTIVE_BORDER : IDLE_BORDER;
  const inset = k.paddingHorizontal - borderWidth;
  const borderColor = hasError ? c.danger : focused ? c.focusRing : c.borderStrong;

  // VoiceOver does not read live regions: announce a new error on iOS (Android uses the live region).
  useEffect(() => {
    if (error && Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(t('kit.errorA11y', { message: error }));
    }
  }, [error]);
  // A new error scrolls its field into view (the first one wins when several appear at once).
  const hadError = useRef(hasError);
  useEffect(() => {
    if (hasError && !hadError.current) reveal?.error(containerRef.current);
    hadError.current = hasError;
  }, [hasError, reveal]);
  const fill = focused && !isSearch ? c.surface : c.surfaceAlt;
  const name = [
    accessibilityLabel ?? label ?? inputProps.placeholder,
    required ? t('kit.requiredA11y') : null,
    hasError ? t('kit.errorA11y', { message: error as string }) : null,
  ]
    .filter(Boolean)
    .join(', ');

  const handleChange = (text: string) => onChangeText(isPhone ? toNationalDigits(text) : text);

  return (
    <View
      ref={containerRef}
      style={[styles.container, disabled && styles.disabled]}
      onLayout={focused ? () => reveal?.layoutChanged(containerRef.current) : undefined}
      testID={testID}
    >
      {label ? (
        <FieldLabel required={required} style={styles.label}>
          {label}
        </FieldLabel>
      ) : null}
      <View
        testID={testID ? `${testID}-field` : undefined}
        style={[
          styles.field,
          isSearch ? styles.search : multiline ? styles.multiline : styles.single,
          { borderColor, borderWidth, backgroundColor: fill },
        ]}
      >
        {isPhone ? (
          <View
            style={[styles.prefix, { width: k.phonePrefixWidth - borderWidth, borderEndColor: c.border }]}
            accessible
            accessibilityLabel={t('kit.phonePrefixA11y')}
          >
            <AppText variant="body">{t('kit.phonePrefix')}</AppText>
          </View>
        ) : null}
        {leading ? (
          <View style={{ paddingStart: inset }}>
            <Icon name={leading} size={k.leadingIconSize} color="textMuted" />
          </View>
        ) : null}
        <TextInput
          ref={ref}
          {...inputProps}
          testID={testID ? `${testID}-input` : undefined}
          inputAccessoryViewID={doneBar ? doneBarId : inputProps.inputAccessoryViewID}
          value={isPhone ? formatNationalPhone(value) : value}
          onChangeText={handleChange}
          editable={!disabled}
          multiline={multiline}
          secureTextEntry={isPassword && !revealed}
          placeholder={inputProps.placeholder ?? (isPhone ? t('kit.phonePlaceholder') : undefined)}
          placeholderTextColor={c.textMuted}
          selectionColor={c.primaryText}
          keyboardType={inputProps.keyboardType ?? (isPhone ? 'phone-pad' : undefined)}
          textContentType={inputProps.textContentType ?? (isPhone ? 'telephoneNumber' : isPassword ? 'password' : undefined)}
          autoComplete={inputProps.autoComplete ?? (isPhone ? 'tel' : isPassword ? 'password' : undefined)}
          autoCapitalize={inputProps.autoCapitalize ?? (isPhone || isPassword ? 'none' : undefined)}
          autoCorrect={inputProps.autoCorrect ?? (isPhone || isPassword ? false : undefined)}
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          accessibilityLabel={name}
          accessibilityHint={!hasError ? helper : undefined}
          accessibilityState={{ disabled }}
          onFocus={e => {
            setFocused(true);
            reveal?.focus(containerRef.current);
            onFocus?.(e);
          }}
          onBlur={e => {
            setFocused(false);
            reveal?.blur(containerRef.current);
            onBlur?.(e);
          }}
          style={[
            multiline ? theme.typography.body : singleLineText,
            styles.input,
            { paddingHorizontal: inset },
            { color: c.textPrimary },
            leading ? styles.inputAfterIcon : null,
            multiline ? [styles.inputMultiline, { paddingVertical: space[3] - borderWidth }] : null,
          ]}
        />
        {showClear ? (
          <IconButton
            icon="clear"
            iconColor="textMuted"
            size={isSearch ? k.searchClearVisual : undefined}
            onPress={() => onChangeText('')}
            accessibilityLabel={t('kit.clearText')}
            testID={testID ? `${testID}-clear` : undefined}
          />
        ) : null}
        {isPassword ? (
          <IconButton
            icon={revealed ? 'eyeOff' : 'eye'}
            iconColor="textSecondary"
            onPress={() => setRevealed(v => !v)}
            accessibilityLabel={revealed ? t('kit.hidePassword') : t('kit.showPassword')}
            disabled={disabled}
            testID={testID ? `${testID}-reveal` : undefined}
          />
        ) : null}
      </View>
      {hasError ? (
        <View style={styles.helper} accessibilityLiveRegion="polite">
          <Icon name="warning" size={k.helperIconSize} color="danger" />
          <AppText variant="caption" color="danger" style={styles.helperText} testID={testID ? `${testID}-error` : undefined}>
            {error}
          </AppText>
        </View>
      ) : helper ? (
        <AppText variant="caption" color="textSecondary" style={styles.helperOnly}>
          {helper}
        </AppText>
      ) : null}
      {/* After the input, so the bar finds it when both mount in the same commit. */}
      {doneBar ? (
        <KeyboardDoneBar nativeID={doneBarId} label={t('kit.keyboardDone')} testID={testID ? `${testID}-done` : undefined} />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { alignSelf: 'stretch' },
  label: { marginBottom: k.labelGap },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  single: { minHeight: k.height },
  search: { height: k.searchHeight, borderRadius: radius.pill },
  multiline: { minHeight: k.multilineMinHeight, alignItems: 'flex-start' },
  prefix: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderEndWidth: 1,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: space[0],
    alignSelf: 'stretch',
  },
  inputAfterIcon: { paddingStart: space[3] },
  inputMultiline: {
    textAlignVertical: 'top',
    maxHeight: k.multilineMaxLines * textStyles.body.lineHeight + space[6],
  },
  helper: { flexDirection: 'row', alignItems: 'center', gap: space[1], marginTop: k.helperGap },
  helperText: { flexShrink: 1 },
  helperOnly: { marginTop: k.helperGap },
  disabled: { opacity: k.disabledOpacity },
});
