import React from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import { t } from '../../i18n';
import { AppText } from './AppText';

export type FieldLabelProps = {
  /** The field's name, without any required marker. */
  children: string;
  /** Adds the required `*` in `danger` after the label (T-564: one colour on every form). */
  required?: boolean;
  style?: StyleProp<TextStyle>;
  testID?: string;
};

/**
 * The label above a form control (TextField, SelectField, UploadTile, a chip group): `label`
 * style in `textSecondary`, and for a required field a ` *` in `danger` nested in the same text,
 * so it wraps with the label at large font sizes. Screen readers hear "Name, required", not "star".
 */
export function FieldLabel({ children, required = false, style, testID }: FieldLabelProps) {
  return (
    <AppText
      variant="label"
      color="textSecondary"
      style={style}
      testID={testID}
      accessibilityLabel={required ? `${children}, ${t('kit.requiredA11y')}` : undefined}
    >
      {children}
      {required ? (
        <AppText variant="label" color="danger" testID={testID ? `${testID}-required` : undefined}>
          {' *'}
        </AppText>
      ) : null}
    </AppText>
  );
}
