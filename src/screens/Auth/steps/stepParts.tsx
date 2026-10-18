import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, FieldLabel, Icon } from '../../../components/ui';
import { useFieldAnchor } from '../../../features/auth/registration/fieldAnchors';
import type { RegistrationFormData, RegistrationStep } from '../../../features/auth/registration/registrationForm';
import { isStepFieldRequired, validateStepField } from '../../../schemas/registrationSchema';
import { space } from '../../../theme';
import { mergeStepErrors } from './stepErrors';

export type StepProps = {
  data: RegistrationFormData;
  onDataChange: (patch: Partial<RegistrationFormData>) => void;
  errors: Partial<Record<string, string>>;
};

type Field = keyof RegistrationFormData;

/**
 * The per-field state a step needs (T-201/T-206): schema errors from the last Continue (the
 * screen's `errors`) merged with blur checks, the latest typed values (a blur can fire before the
 * re-render that carries the last keystroke), and whether the schema requires a field (its `*`).
 */
export function useStepFields(step: RegistrationStep, { data, onDataChange, errors }: StepProps) {
  const [blurErrors, setBlurErrors] = useState<Record<string, string>>({});
  const latest = useRef(data);
  latest.current = data;

  const clear = (field: Field) => setBlurErrors((prev) => (prev[field] ? { ...prev, [field]: '' } : prev));

  return {
    errors: mergeStepErrors(errors, blurErrors),
    /** Typing makes this field's error stale, whatever set it (blur or Continue). */
    set: <K extends Field>(field: K, value: RegistrationFormData[K]) => {
      latest.current = { ...latest.current, [field]: value };
      onDataChange({ [field]: value } as Partial<RegistrationFormData>);
      clear(field);
    },
    blur: (field: Field) => {
      const error = validateStepField(step, field, latest.current);
      setBlurErrors((prev) => ({ ...prev, [field]: error ?? '' }));
    },
    /** An error the step finds itself (a picked photo the server would refuse). */
    setError: (field: Field, message: string) => setBlurErrors((prev) => ({ ...prev, [field]: message })),
    clear,
    /** The schema requires the field for this role (T-206): its label gets the kit's `*` (T-564). */
    required: (field: Field) => isStepFieldRequired(step, field, data.role),
  };
}

/** Marks where a field sits so the screen can scroll to the first field a 422 refused (T-202). */
export function Anchored({ field, children }: React.PropsWithChildren<{ field: Field }>) {
  const anchor = useFieldAnchor();
  return (
    <View ref={anchor(field)} collapsable={false}>
      {children}
    </View>
  );
}

/** Titled group of fields: `title` 17/600, 12 below, fields 16 apart (spec: 32 between groups). */
export function FormGroup({ title, helper, children }: React.PropsWithChildren<{ title?: string; helper?: string }>) {
  return (
    <View style={styles.group}>
      {title ? (
        <View style={styles.groupHead}>
          <AppText variant="title" accessibilityRole="header">
            {title}
          </AppText>
          {helper ? (
            <AppText variant="bodySmall" color="textSecondary">
              {helper}
            </AppText>
          ) : null}
        </View>
      ) : null}
      <View style={styles.fields}>{children}</View>
    </View>
  );
}

/** Error line for a control that is not a TextField (segmented control, chips, cards). */
export function FieldError({ message, testID }: { message?: string; testID?: string }) {
  if (!message) return null;
  return (
    <View style={styles.error} accessibilityLiveRegion="polite" accessibilityRole="alert">
      <Icon name="warning" size={16} color="danger" />
      <AppText variant="caption" color="danger" style={styles.errorText} testID={testID}>
        {message}
      </AppText>
    </View>
  );
}

/** Label above a control that is not a TextField, the kit FieldLabel (same `*` as the fields). */
export function ControlLabel({ children, required = false }: { children: string; required?: boolean }) {
  return <FieldLabel required={required}>{children}</FieldLabel>;
}

export const stepStyles = StyleSheet.create({
  /** A step's groups, 32 apart. */
  step: { gap: space[8] },
  /** A label, its control and its error/helper. */
  control: { gap: space[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
});

const styles = StyleSheet.create({
  group: { gap: space[3] },
  groupHead: { gap: space[1] },
  fields: { gap: space[4] },
  error: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  errorText: { flexShrink: 1 },
});
