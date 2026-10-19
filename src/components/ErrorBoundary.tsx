import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Icon } from './ui/Icon';
import { BrandColors } from '../theme/colors';
import { logger } from '../core/logging/logger';
import { t } from '../i18n';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    logger.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Show user-friendly error message
    this.showErrorAlert(error);
  }

  showErrorAlert = (error: Error) => {
    let errorMessage = t('errorBoundary.generic');
    
    // Provide more specific error messages based on error type
    if (error.message.includes('Property') && error.message.includes("doesn't exist")) {
      errorMessage = t('errorBoundary.appData');
    } else if (error.message.includes('Network')) {
      errorMessage = t('errorBoundary.network');
    } else if (error.message.includes('Authentication')) {
      errorMessage = t('errorBoundary.auth');
    } else if (error.message.includes('Location')) {
      errorMessage = t('errorBoundary.location');
    }

    Alert.alert(
      t('errorBoundary.alertTitle'),
      errorMessage,
      [
        {
          text: t('errorBoundary.ok'),
          onPress: () => this.resetError(),
        },
        {
          text: t('errorBoundary.restart'),
          onPress: () => this.resetError(),
        },
      ],
      { cancelable: false }
    );
  };

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.errorContainer}>
          <View style={styles.errorContent}>
            <Icon name="warning" size={48} tint={BrandColors.primary} />
            <Text style={styles.errorTitle}>{t('errorBoundary.title')}</Text>
            <Text style={styles.errorMessage}>{t('errorBoundary.body')}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={this.resetError}>
              <Text style={styles.retryButtonText}>{t('errorBoundary.retry')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 20,
  },
  errorContent: {
    alignItems: 'center',
    maxWidth: 300,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: BrandColors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ErrorBoundary;
