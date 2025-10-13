import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { showToast } from './ToastProvider';

export interface AppError {
  code: string;
  message: string;
  details?: string;
  timestamp: Date;
}

export const useErrorHandler = () => {
  const [errors, setErrors] = useState<AppError[]>([]);

  const handleError = useCallback((
    error: Error | string,
    context?: string,
    showAlert: boolean = true,
    showToast: boolean = true
  ) => {
    const errorObj: AppError = {
      code: 'APP_ERROR',
      message: typeof error === 'string' ? error : error.message,
      details: typeof error === 'object' ? error.stack : undefined,
      timestamp: new Date(),
    };

    // Add context if provided
    if (context) {
      errorObj.code = context;
    }

    // Log error for debugging
    console.error(`[${context || 'APP_ERROR'}]`, error);

    // Add to errors list
    setErrors(prev => [...prev.slice(-9), errorObj]); // Keep only last 10 errors

    // Show user-friendly message
    const userMessage = getUserFriendlyMessage(errorObj);
    
    if (showAlert) {
      Alert.alert(
        'Error',
        userMessage,
        [
          {
            text: 'OK',
            style: 'default',
          },
        ],
        { cancelable: true }
      );
    }

    if (showToast) {
      showToast('error', userMessage);
    }

    return errorObj;
  }, []);

  const getUserFriendlyMessage = (error: AppError): string => {
    // Provide specific error messages based on error type
    if (error.message.includes('Property') && error.message.includes("doesn't exist")) {
      return 'There was an issue with the app data. Please restart the app.';
    }
    
    if (error.message.includes('Network') || error.message.includes('fetch')) {
      return 'Network connection issue. Please check your internet connection.';
    }
    
    if (error.message.includes('Authentication') || error.message.includes('token')) {
      return 'Authentication error. Please log in again.';
    }
    
    if (error.message.includes('Location') || error.message.includes('permission')) {
      return 'Location service error. Please enable location permissions.';
    }
    
    if (error.message.includes('Ride') || error.message.includes('ride')) {
      return 'Ride service error. Please try again.';
    }
    
    if (error.message.includes('Database') || error.message.includes('SQL')) {
      return 'Server error. Please try again in a moment.';
    }

    // Default message
    return 'Something went wrong. Please try again.';
  };

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const getLastError = useCallback((): AppError | null => {
    return errors.length > 0 ? errors[errors.length - 1] : null;
  }, [errors]);

  return {
    errors,
    handleError,
    clearErrors,
    getLastError,
  };
};

export default useErrorHandler;
