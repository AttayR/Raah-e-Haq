import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { t } from '../../i18n';
import { componentTokens, space } from '../../theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { StateLayout } from './EmptyState';
import { Icon } from './Icon';

export type ErrorStateProps = {
  /** "Couldn't load {thing}". */
  title: string;
  /** One sentence: what happened or what to do (often the API's safe message). */
  body?: string;
  /** `network` (cloud-off glyph) or `server` (alert circle). */
  kind?: 'network' | 'server';
  onRetry: () => void;
  /** Shows the button's loading state while a retry is in flight. */
  retrying?: boolean;
  retryLabel?: string;
  placement?: 'top' | 'center';
  /**
   * `compact` (UI-R9, a section inside a sheet): 48 `dangerSoft` circle with a 24 glyph → 12 →
   * the title in `title` ([UI-R10], the twin of the compact EmptyState; 2 lines at most; `body` is not shown) → 12 → `sm` secondary
   * "Try again", centred, ≤156 high. `regular` (default): the EmptyState-sized layout.
   */
  size?: 'regular' | 'compact';
  style?: StyleProp<ViewStyle>;
  /** The retry button gets `${testID}-retry`. */
  testID?: string;
};

/**
 * ErrorState (DESIGN_SYSTEM §5.20): the EmptyState layout with a `dangerSoft` circle and a
 * `danger` glyph, title "Couldn't load {thing}", one sentence of body and a primary `md`
 * "Try again" button (loading while retrying). Announced as an alert. When cached data exists,
 * keep the data and show a Banner or Toast instead of this.
 */
export function ErrorState({
  title,
  body,
  kind = 'server',
  onRetry,
  retrying = false,
  retryLabel,
  placement,
  size = 'regular',
  style,
  testID,
}: ErrorStateProps) {
  if (size === 'compact') {
    return (
      <CompactErrorState
        title={title}
        kind={kind}
        onRetry={onRetry}
        retrying={retrying}
        retryLabel={retryLabel}
        style={style}
        testID={testID}
      />
    );
  }
  return (
    <StateLayout
      icon={kind === 'network' ? 'networkError' : 'warning'}
      circle="dangerSoft"
      glyph="danger"
      title={title}
      // An API message that only repeats the title is not shown twice.
      body={body && body !== title ? body : undefined}
      role="alert"
      actionVariant="primary"
      placement={placement}
      style={style}
      testID={testID}
      action={{
        label: retryLabel ?? t('common.tryAgain'),
        onPress: onRetry,
        loading: retrying,
        testID: testID ? `${testID}-retry` : undefined,
      }}
    />
  );
}

const k = componentTokens.emptyState;

function CompactErrorState({
  title,
  kind,
  onRetry,
  retrying,
  retryLabel,
  style,
  testID,
}: Pick<ErrorStateProps, 'title' | 'kind' | 'onRetry' | 'retrying' | 'retryLabel' | 'style' | 'testID'>) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.compact, style]} testID={testID} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <View
        style={[styles.compactCircle, { backgroundColor: theme.colors.dangerSoft }]}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <Icon name={kind === 'network' ? 'networkError' : 'warning'} size={k.compactGlyph} color="danger" />
      </View>
      <AppText variant="title" align="center" numberOfLines={2}>
        {title}
      </AppText>
      <View style={styles.compactAction}>
        <Button
          label={retryLabel ?? t('common.tryAgain')}
          onPress={onRetry}
          variant="secondary"
          size="sm"
          fullWidth={false}
          loading={retrying}
          testID={testID ? `${testID}-retry` : undefined}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  compact: { alignItems: 'center', gap: space[3] },
  compactCircle: {
    width: k.compactCircle,
    height: k.compactCircle,
    borderRadius: k.compactCircle / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // §5.4 ruling (UI-R8): a hugging button in a centred column centres itself.
  compactAction: { alignSelf: 'center' },
});
