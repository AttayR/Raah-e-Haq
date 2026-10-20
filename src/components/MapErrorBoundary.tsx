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

/** The fallback's body for a map error. */
export const mapErrorMessage = (error: Error): string => {
  if (error.message.includes('NullPointerException') || error.message.includes('removeView')) return t('errorBoundary.mapRestart');
  if (error.message.includes('MapView') || error.message.includes('Google Maps')) return t('errorBoundary.mapService');
  if (error.message.includes('Location') || error.message.includes('permission')) return t('errorBoundary.location');
  return t('errorBoundary.mapGeneric');
};

/**
 * Catches a crash inside a map and shows the kit ErrorState with "Try again", which re-mounts
 * the map (UI-R19: no longer a hand-styled card plus a native Alert on top of it).
 */
export class MapErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('MapErrorBoundary caught an error:', error, errorInfo);
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
        title={t('errorBoundary.mapTitle')}
        body={mapErrorMessage(error)}
        onRetry={this.resetError}
        testID="map-error-boundary"
      />
    );
  }
}

export default MapErrorBoundary;
