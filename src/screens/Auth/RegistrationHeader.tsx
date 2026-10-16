import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { AppText } from '../../components/ui';
import { REGISTRATION_COPY as COPY } from '../../features/auth/copy/registration';
import { componentTokens, radius, space } from '../../theme';

const w = componentTokens.wizard;

interface Props {
  title: string;
  description?: string;
  /** "Step n of m"; null hides the progress (role page, phone step). */
  progress: { current: number; total: number } | null;
}

/**
 * Top of every registration page (spec auth-registration, UI-R7): a segmented progress bar (one
 * 4pt segment per step, done and current `primary`, upcoming `border` so it shows on
 * `background`), "Step n of m", then the page title (`h2`) and description. Replaces the navy
 * brand header with decorative circles.
 */
export default function RegistrationHeader({ title, description, progress }: Props) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.wrap}>
      {progress ? (
        <View
          style={styles.progress}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={COPY.form.progress(progress.current, progress.total)}
          accessibilityValue={{ min: 0, max: progress.total, now: progress.current }}
          testID="registration-progress"
        >
          <View style={styles.segments}>
            {Array.from({ length: progress.total }, (_, index) => (
              <View
                key={index}
                testID={`registration-progress-${index + 1}`}
                style={[
                  styles.segment,
                  { backgroundColor: index < progress.current ? theme.colors.primary : theme.colors.border },
                ]}
              />
            ))}
          </View>
          <AppText variant="caption" color="textMuted">
            {COPY.form.progress(progress.current, progress.total)}
          </AppText>
        </View>
      ) : null}
      <View style={styles.titleBlock}>
        <AppText variant="h2" accessibilityRole="header">
          {title}
        </AppText>
        {description ? (
          <AppText variant="bodySmall" color="textSecondary">
            {description}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[2] },
  progress: { gap: space[3], marginBottom: space[1] },
  segments: { flexDirection: 'row', gap: w.progressGap },
  segment: { flex: 1, height: w.progressHeight, borderRadius: radius.pill },
  titleBlock: { gap: space[1] },
});
