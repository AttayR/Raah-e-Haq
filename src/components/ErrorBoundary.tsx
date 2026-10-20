import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { logger } from '../core/logging/logger';
import { t } from '../i18n';
import { BoundaryFallback } from './BoundaryFallback';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

/** The fallback's body for an error (what happened, in the user's words). */
export const errorBoundaryMessage = (error: Error): string => {
  if (error.message.includes('Property') && error.message.includes("doesn't exist")) return t('errorBoundary.appData');
  if (error.message.includes('Network')) return t('errorBoundary.network');
  if (error.message.includes('Authentication')) return t('errorBoundary.auth');
  if (error.message.includes('Location')) return t('errorBoundary.location');
  return t('errorBoundary.generic');
};

/**
 * Catches a render error below it and shows the kit ErrorState with "Try again" (UI-R19: no
 * longer a hand-styled card plus a native Alert on top of it).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  resetError = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return (
      <BoundaryFallback
        title={t('errorBoundary.title')}
        body={errorBoundaryMessage(error)}
        onRetry={this.resetError}
        testID="error-boundary"
      />
    );
  }
}

export default ErrorBoundary;
