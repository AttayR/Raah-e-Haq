import { Alert } from 'react-native';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
  status?: number;
}

export class AuthErrorHandler {
  static handleRegistrationError(error: any): void {
    console.error('Registration error:', error);
    
    if (error.response?.data?.errors) {
      // Handle validation errors
      const validationErrors = error.response.data.errors;
      const errorMessages = Object.entries(validationErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('\n');
      
      Alert.alert(
        'Registration Failed',
        `Please fix the following errors:\n\n${errorMessages}`,
        [{ text: 'OK' }]
      );
    } else if (error.response?.data?.message) {
      // Handle API error messages
      Alert.alert('Registration Failed', error.response.data.message);
    } else if (error.message) {
      // Handle generic errors
      Alert.alert('Registration Failed', error.message);
    } else {
      Alert.alert('Registration Failed', 'An unexpected error occurred. Please try again.');
    }
  }

  static handleLoginError(error: any): void {
    console.error('Login error:', error);
    
    if (error.response?.status === 401) {
      Alert.alert('Login Failed', 'Invalid email or password. Please try again.');
    } else if (error.response?.data?.message) {
      Alert.alert('Login Failed', error.response.data.message);
    } else if (error.message) {
      Alert.alert('Login Failed', error.message);
    } else {
      Alert.alert('Login Failed', 'An unexpected error occurred. Please try again.');
    }
  }

  static handleOtpError(error: any): void {
    console.error('OTP error:', error);
    
    if (error.response?.data?.message) {
      Alert.alert('OTP Failed', error.response.data.message);
    } else if (error.message) {
      Alert.alert('OTP Failed', error.message);
    } else {
      Alert.alert('OTP Failed', 'Failed to process OTP. Please try again.');
    }
  }

  static handleNetworkError(error: any): void {
    console.error('Network error:', error);
    
    if (error.code === 'NETWORK_ERROR' || error.message?.includes('Network Error')) {
      Alert.alert(
        'Network Error',
        'Please check your internet connection and try again.',
        [{ text: 'OK' }]
      );
    } else if (error.code === 'TIMEOUT') {
      Alert.alert(
        'Request Timeout',
        'The request took too long to complete. Please try again.',
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert(
        'Connection Error',
        'Unable to connect to the server. Please try again later.',
        [{ text: 'OK' }]
      );
    }
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validatePhone(phone: string): boolean {
    const phoneRegex = /^\+92-\d{3}-\d{7}$/;
    return phoneRegex.test(phone);
  }

  static validateCnic(cnic: string): boolean {
    const cnicRegex = /^\d{5}-\d{7}-\d{1}$/;
    return cnicRegex.test(cnic);
  }

  static validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // Format as +92-XXX-XXXXXXX
    if (digits.length === 12 && digits.startsWith('92')) {
      return `+${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    } else if (digits.length === 11 && digits.startsWith('0')) {
      return `+92-${digits.slice(1, 4)}-${digits.slice(4)}`;
    } else if (digits.length === 10) {
      return `+92-${digits.slice(0, 3)}-${digits.slice(3)}`;
    }
    
    return phone; // Return original if can't format
  }

  static formatCnic(cnic: string): string {
    // Remove all non-digit characters
    const digits = cnic.replace(/\D/g, '');
    
    // Format as XXXXX-XXXXXXX-X
    if (digits.length === 13) {
      return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
    }
    
    return cnic; // Return original if can't format
  }

  static getFieldErrorMessage(field: string, errors: Record<string, string[]>): string {
    if (errors[field] && errors[field].length > 0) {
      return errors[field][0]; // Return first error message
    }
    return '';
  }

  static extractValidationErrors(error: any): Record<string, string> {
    const validationErrors: Record<string, string> = {};
    
    if (error.response?.data?.errors) {
      Object.entries(error.response.data.errors).forEach(([field, messages]) => {
        if (Array.isArray(messages) && messages.length > 0) {
          validationErrors[field] = messages[0];
        }
      });
    }
    
    return validationErrors;
  }

  static showSuccessMessage(title: string, message: string, onPress?: () => void): void {
    Alert.alert(title, message, [{ text: 'OK', onPress }]);
  }

  static showErrorMessage(title: string, message: string): void {
    Alert.alert(title, message, [{ text: 'OK' }]);
  }

  static showConfirmationDialog(
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void
  ): void {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', onPress: onCancel, style: 'cancel' },
        { text: 'Confirm', onPress: onConfirm, style: 'default' }
      ]
    );
  }
}

export default AuthErrorHandler;
