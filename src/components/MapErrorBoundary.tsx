import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BrandColors } from '../theme/colors';

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

export class MapErrorBoundary extends Component<Props, State> {
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
    console.error('MapErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Show user-friendly error message for map errors
    this.showMapErrorAlert(error);
  }

  showMapErrorAlert = (error: Error) => {
    let errorMessage = 'There was an issue with the map. Please try again.';
    
    // Provide more specific error messages based on error type
    if (error.message.includes('NullPointerException') || error.message.includes('removeView')) {
      errorMessage = 'Map loading issue. Please restart the app.';
    } else if (error.message.includes('MapView') || error.message.includes('Google Maps')) {
      errorMessage = 'Map service error. Please check your internet connection.';
    } else if (error.message.includes('Location') || error.message.includes('permission')) {
      errorMessage = 'Location service error. Please enable location permissions.';
    }

    Alert.alert(
      'Map Error',
      errorMessage,
      [
        {
          text: 'OK',
          onPress: () => this.resetError(),
        },
        {
          text: 'Restart App',
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
            <Icon name="map" size={64} color={BrandColors.primary} />
            <Text style={styles.errorTitle}>Map Error</Text>
            <Text style={styles.errorMessage}>
              There was an issue loading the map. Please try again.
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={this.resetError}>
              <Text style={styles.retryButtonText}>Try Again</Text>
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

export default MapErrorBoundary;
