import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Button, Icon, type IconName } from '../../../components/ui';
import { space } from '../../../theme';

export type StateViewProps =
  | { kind: 'loading'; testID?: string }
  | { kind: 'error'; message: string; retryLabel: string; onRetry: () => void; testID?: string }
  | { kind: 'empty'; icon: IconName; title: string; body?: string; testID?: string };

/** Loading, error and empty states of a list or a screen body, centred in the space given. */
export function StateView(props: StateViewProps) {
  const { theme } = useAppTheme();
  if (props.kind === 'loading') {
    return (
      <View style={styles.centered} testID={props.testID} accessibilityRole="progressbar">
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }
  if (props.kind === 'error') {
    return (
      <View style={styles.centered} testID={props.testID} accessibilityRole="alert">
        <Icon name="warning" size={32} color="danger" />
        <AppText variant="body" align="center">
          {props.message}
        </AppText>
        <Button
          label={props.retryLabel}
          variant="outline"
          fullWidth={false}
          leadingIcon="retry"
          onPress={props.onRetry}
          testID={props.testID ? `${props.testID}-retry` : undefined}
        />
      </View>
    );
  }
  return (
    <View style={styles.centered} testID={props.testID}>
      <Icon name={props.icon} size={48} color="textMuted" />
      <AppText variant="title" align="center">
        {props.title}
      </AppText>
      {props.body ? (
        <AppText variant="bodySmall" color="textSecondary" align="center">
          {props.body}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[3],
    paddingHorizontal: space[6],
    paddingVertical: space[8],
  },
});
