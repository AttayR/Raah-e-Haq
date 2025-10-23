export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => string | null;
}

export interface ValidationRules {
  [key: string]: ValidationRule;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export class ValidationUtils {
  static validateField(value: any, rules: ValidationRule): string | null {
    // Required validation
    if (rules.required && (!value || (typeof value === 'string' && !value.trim()))) {
      return 'This field is required';
    }

    // Skip other validations if value is empty and not required
    if (!value || (typeof value === 'string' && !value.trim())) {
      return null;
    }

    const stringValue = String(value);

    // Min length validation
    if (rules.minLength && stringValue.length < rules.minLength) {
      return `Minimum length is ${rules.minLength} characters`;
    }

    // Max length validation
    if (rules.maxLength && stringValue.length > rules.maxLength) {
      return `Maximum length is ${rules.maxLength} characters`;
    }

    // Pattern validation
    if (rules.pattern && !rules.pattern.test(stringValue)) {
      return 'Invalid format';
    }

    // Custom validation
    if (rules.custom) {
      return rules.custom(value);
    }

    return null;
  }

  static validateForm(data: Record<string, any>, rules: ValidationRules): ValidationResult {
    const errors: Record<string, string> = {};

    Object.keys(rules).forEach(field => {
      const fieldRules = rules[field];
      const fieldValue = data[field];
      const error = this.validateField(fieldValue, fieldRules);
      
      if (error) {
        errors[field] = error;
      }
    });

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  // Common validation rules
  static readonly commonRules = {
    email: {
      required: true,
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      custom: (value: string) => {
        if (!value) return 'Email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return 'Please enter a valid email address';
        }
        return null;
      }
    },
    
    password: {
      required: true,
      minLength: 8,
      custom: (value: string) => {
        if (!value) return 'Password is required';
        if (value.length < 8) return 'Password must be at least 8 characters';
        if (!/[A-Z]/.test(value)) return 'Password must contain uppercase letter';
        if (!/[a-z]/.test(value)) return 'Password must contain lowercase letter';
        if (!/\d/.test(value)) return 'Password must contain a number';
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(value)) {
          return 'Password must contain special character';
        }
        return null;
      }
    },
    
    phone: {
      required: true,
      pattern: /^\+92-\d{3}-\d{7}$/,
      custom: (value: string) => {
        if (!value) return 'Phone number is required';
        if (!/^\+92-\d{3}-\d{7}$/.test(value)) {
          return 'Phone must be in format +92-XXX-XXXXXXX';
        }
        return null;
      }
    },
    
    cnic: {
      required: true,
      pattern: /^\d{5}-\d{7}-\d{1}$/,
      custom: (value: string) => {
        if (!value) return 'CNIC is required';
        if (!/^\d{5}-\d{7}-\d{1}$/.test(value)) {
          return 'CNIC must be in format XXXXX-XXXXXXX-X';
        }
        return null;
      }
    },
    
    name: {
      required: true,
      minLength: 2,
      maxLength: 50,
      custom: (value: string) => {
        if (!value) return 'Name is required';
        if (value.length < 2) return 'Name must be at least 2 characters';
        if (value.length > 50) return 'Name must be less than 50 characters';
        if (!/^[a-zA-Z\s]+$/.test(value)) {
          return 'Name can only contain letters and spaces';
        }
        return null;
      }
    },
    
    address: {
      required: true,
      minLength: 10,
      maxLength: 200,
      custom: (value: string) => {
        if (!value) return 'Address is required';
        if (value.length < 10) return 'Address must be at least 10 characters';
        if (value.length > 200) return 'Address must be less than 200 characters';
        return null;
      }
    },
    
    dateOfBirth: {
      required: true,
      custom: (value: string) => {
        if (!value) return 'Date of birth is required';
        const date = new Date(value);
        const today = new Date();
        const age = today.getFullYear() - date.getFullYear();
        
        if (isNaN(date.getTime())) return 'Please enter a valid date';
        if (age < 18) return 'You must be at least 18 years old';
        if (age > 100) return 'Please enter a valid birth year';
        
        return null;
      }
    },
    
    otp: {
      required: true,
      pattern: /^\d{6}$/,
      custom: (value: string) => {
        if (!value) return 'OTP code is required';
        if (!/^\d{6}$/.test(value)) return 'OTP must be 6 digits';
        return null;
      }
    },
    
    licenseNumber: {
      required: true,
      minLength: 5,
      maxLength: 20,
      custom: (value: string) => {
        if (!value) return 'License number is required';
        if (value.length < 5) return 'License number must be at least 5 characters';
        if (value.length > 20) return 'License number must be less than 20 characters';
        return null;
      }
    },
    
    vehicleMake: {
      required: true,
      minLength: 2,
      maxLength: 20,
      custom: (value: string) => {
        if (!value) return 'Vehicle make is required';
        if (value.length < 2) return 'Vehicle make must be at least 2 characters';
        if (value.length > 20) return 'Vehicle make must be less than 20 characters';
        return null;
      }
    },
    
    vehicleModel: {
      required: true,
      minLength: 2,
      maxLength: 20,
      custom: (value: string) => {
        if (!value) return 'Vehicle model is required';
        if (value.length < 2) return 'Vehicle model must be at least 2 characters';
        if (value.length > 20) return 'Vehicle model must be less than 20 characters';
        return null;
      }
    },
    
    vehicleYear: {
      required: true,
      custom: (value: string) => {
        if (!value) return 'Vehicle year is required';
        const year = parseInt(value);
        const currentYear = new Date().getFullYear();
        
        if (isNaN(year)) return 'Please enter a valid year';
        if (year < 1990) return 'Vehicle year must be after 1990';
        if (year > currentYear + 1) return 'Vehicle year cannot be in the future';
        
        return null;
      }
    },
    
    licensePlate: {
      required: true,
      pattern: /^[A-Z]{3}-\d{4}-\d{4}$/,
      custom: (value: string) => {
        if (!value) return 'License plate is required';
        if (!/^[A-Z]{3}-\d{4}-\d{4}$/.test(value)) {
          return 'License plate must be in format ABC-1234-5678';
        }
        return null;
      }
    },
    
    bankAccount: {
      required: true,
      pattern: /^\d{16}$/,
      custom: (value: string) => {
        if (!value) return 'Bank account number is required';
        if (!/^\d{16}$/.test(value)) {
          return 'Bank account must be 16 digits';
        }
        return null;
      }
    }
  };

  // Registration form validation rules
  static getRegistrationRules(userType: 'passenger' | 'driver'): ValidationRules {
    const baseRules: ValidationRules = {
      name: this.commonRules.name,
      email: this.commonRules.email,
      password: this.commonRules.password,
      password_confirmation: {
        required: true,
        custom: (value: string, formData?: any) => {
          if (!value) return 'Password confirmation is required';
          if (formData?.password && value !== formData.password) {
            return 'Passwords do not match';
          }
          return null;
        }
      },
      phone: this.commonRules.phone,
      cnic: this.commonRules.cnic,
      address: this.commonRules.address,
      date_of_birth: this.commonRules.dateOfBirth,
      emergency_contact_name: {
        required: true,
        minLength: 2,
        maxLength: 50,
        custom: (value: string) => {
          if (!value) return 'Emergency contact name is required';
          if (value.length < 2) return 'Emergency contact name must be at least 2 characters';
          return null;
        }
      },
      emergency_contact_relation: {
        required: true,
        custom: (value: string) => {
          if (!value) return 'Emergency contact relation is required';
          const trimmedValue = value.trim().toLowerCase();
          const validRelations = ['father', 'mother', 'brother', 'sister', 'spouse', 'friend', 'other'];
          if (!validRelations.includes(trimmedValue)) {
            return 'Please select a valid relation (father, mother, brother, sister, spouse, friend, other)';
          }
          return null;
        }
      },
      languages: {
        required: true,
        minLength: 3,
        custom: (value: string) => {
          if (!value) return 'Languages are required';
          if (value.length < 3) return 'Please specify at least one language';
          return null;
        }
      },
      bio: {
        required: true,
        minLength: 10,
        maxLength: 200,
        custom: (value: string) => {
          if (!value) return 'Bio is required';
          if (value.length < 10) return 'Bio must be at least 10 characters';
          if (value.length > 200) return 'Bio must be less than 200 characters';
          return null;
        }
      }
    };

    if (userType === 'passenger') {
      return {
        ...baseRules,
        passenger_preferred_payment: {
          required: true,
          custom: (value: string) => {
            if (!value) return 'Preferred payment method is required';
            const validMethods = ['mobile_wallet', 'card', 'cash'];
            if (!validMethods.includes(value)) {
              return 'Please select a valid payment method';
            }
            return null;
          }
        },
        passenger_emergency_contact: this.commonRules.phone
      };
    } else {
      return {
        ...baseRules,
        license_number: this.commonRules.licenseNumber,
        license_type: {
          required: true,
          custom: (value: string) => {
            if (!value) return 'License type is required';
            const validTypes = ['LTV', 'MC', 'HTV'];
            if (!validTypes.includes(value)) {
              return 'Please select a valid license type';
            }
            return null;
          }
        },
        license_expiry_date: {
          required: true,
          custom: (value: string) => {
            if (!value) return 'License expiry date is required';
            const date = new Date(value);
            const today = new Date();
            
            if (isNaN(date.getTime())) return 'Please enter a valid date';
            if (date <= today) return 'License must not be expired';
            
            return null;
          }
        },
        driving_experience: {
          required: true,
          custom: (value: string) => {
            if (!value) return 'Driving experience is required';
            if (!/^\d+\s*(years?|months?)$/i.test(value)) {
              return 'Please enter experience in format like "5 years" or "6 months"';
            }
            return null;
          }
        },
        bank_account_number: this.commonRules.bankAccount,
        bank_name: {
          required: true,
          minLength: 3,
          maxLength: 50,
          custom: (value: string) => {
            if (!value) return 'Bank name is required';
            if (value.length < 3) return 'Bank name must be at least 3 characters';
            return null;
          }
        },
        bank_branch: {
          required: true,
          minLength: 3,
          maxLength: 50,
          custom: (value: string) => {
            if (!value) return 'Bank branch is required';
            if (value.length < 3) return 'Bank branch must be at least 3 characters';
            return null;
          }
        },
        vehicle_type: {
          required: true,
          custom: (value: string) => {
            if (!value) return 'Vehicle type is required';
            const validTypes = ['car', 'bike'];
            if (!validTypes.includes(value)) {
              return 'Please select a valid vehicle type';
            }
            return null;
          }
        },
        vehicle_make: this.commonRules.vehicleMake,
        vehicle_model: this.commonRules.vehicleModel,
        vehicle_year: this.commonRules.vehicleYear,
        vehicle_color: {
          required: true,
          minLength: 2,
          maxLength: 20,
          custom: (value: string) => {
            if (!value) return 'Vehicle color is required';
            if (value.length < 2) return 'Vehicle color must be at least 2 characters';
            return null;
          }
        },
        license_plate: this.commonRules.licensePlate,
        registration_number: {
          required: true,
          minLength: 5,
          maxLength: 20,
          custom: (value: string) => {
            if (!value) return 'Registration number is required';
            if (value.length < 5) return 'Registration number must be at least 5 characters';
            return null;
          }
        },
        preferred_payment: {
          required: true,
          custom: (value: string) => {
            if (!value) return 'Preferred payment method is required';
            const validMethods = ['mobile_wallet', 'cash'];
            if (!validMethods.includes(value)) {
              return 'Please select a valid payment method';
            }
            return null;
          }
        }
      };
    }
  }

  // Login form validation rules
  static getLoginRules(loginMethod: 'email' | 'otp'): ValidationRules {
    if (loginMethod === 'email') {
      return {
        email: this.commonRules.email,
        password: this.commonRules.password
      };
    } else {
      return {
        phone: this.commonRules.phone,
        otp_code: this.commonRules.otp
      };
    }
  }
}

export default ValidationUtils;
