import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText } from '../../../components/ui';
import { REGISTRATION_FIELDS } from '../../../features/auth/copy/registrationFields';
import { radius, space, type SemanticColorName } from '../../../theme';

const COPY = REGISTRATION_FIELDS.personal.strength;

type Level = { label: string; tone: Extract<SemanticColorName, 'danger' | 'warning' | 'success'>; score: number };

/** 25 points per rule the schema checks (length 8, lower, upper, digit); null for an empty password. */
export function passwordStrength(password: string): Level | null {
  if (!password) return null;
  const score = [password.length >= 8, /[a-z]/.test(password), /[A-Z]/.test(password), /\d/.test(password)].filter(
    Boolean,
  ).length * 25;
  if (score < 50) return { label: COPY.weak, tone: 'danger', score };
  if (score < 75) return { label: COPY.medium, tone: 'warning', score };
  return { label: COPY.strong, tone: 'success', score };
}

/** A 4pt meter under the password field with the level as text (never colour alone). */
export default function PasswordStrength({ password }: { password: string }) {
  const { theme } = useAppTheme();
  const level = passwordStrength(password);
  if (!level) return null;
  return (
    <View style={styles.wrap} accessible accessibilityLabel={COPY.a11y(level.label)} testID="registration-password-strength">
      <View style={[styles.track, { backgroundColor: theme.colors.surfaceAlt }]}>
        <View style={[styles.fill, { width: `${level.score}%`, backgroundColor: theme.colors[level.tone] }]} />
      </View>
      <AppText variant="caption" color={level.tone}>
        {level.label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: space[3], marginTop: space[2] },
  track: { flex: 1, height: space[1], borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
});
