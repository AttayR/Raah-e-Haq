import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../app/providers/ThemeProvider';
import { t } from '../i18n';
import { ErrorState } from './ui/ErrorState';

export type BoundaryFallbackProps = {
  title: string;
  /** What happened, chosen from the error (network, location, map service, …). */
  body: string;
  onRetry: () => void;
  testID?: string;
};

/**
 * [UI-R19] What an error boundary shows instead of the screen that crashed: the kit ErrorState
 * (DESIGN_SYSTEM §5.20) centred on the theme background, with "Try again" re-mounting the
 * children. Replaces the hand-styled card and the extra native alert the boundaries showed.
 */
export function BoundaryFallback({ title, body, onRetry, testID }: BoundaryFallbackProps) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.fill, { backgroundColor: theme.colors.background }]} testID={testID}>
      <ErrorState
        title={title}
        body={body}
        onRetry={onRetry}
        retryLabel={t('errorBoundary.retry')}
        placement="center"
        testID={testID ? `${testID}-state` : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'center' },
});
