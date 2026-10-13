import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { t } from '../../i18n';
import { StateLayout } from './EmptyState';

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
  style,
  testID,
}: ErrorStateProps) {
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
