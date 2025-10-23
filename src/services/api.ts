import axios, { AxiosInstance, AxiosResponse, CancelTokenSource } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API Configuration
// Use production API for both development and production
const API_BASE_URL = 'https://raahehaq.com/api';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Track active requests for cleanup
const activeRequests = new Set<CancelTokenSource>();

// Helper function to create a cancellable request
export const createCancellableRequest = () => {
  const source = axios.CancelToken.source();
  activeRequests.add(source);
  return source;
};

// Helper function to cancel all active requests
export const cancelAllRequests = () => {
  activeRequests.forEach(source => {
    try {
      source.cancel('Component unmounted');
    } catch (error) {
      console.log('Error cancelling request:', error);
    }
  });
  activeRequests.clear();
};

// Helper function to remove a request from tracking
export const removeRequest = (source: CancelTokenSource) => {
  activeRequests.delete(source);
};

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.log('Error getting token from storage:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error) => {
    // Handle cancelled requests (don't process them)
    if (axios.isCancel(error)) {
      console.log('Request cancelled:', error.message);
      return Promise.reject(error);
    }

    const originalRequest = error.config;

    // Handle 401 errors (unauthorized)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh token
        const refreshToken = await AsyncStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });

          const { token } = response.data.data;
          await AsyncStorage.setItem('auth_token', token);
          
          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        await AsyncStorage.multiRemove(['auth_token', 'refresh_token', 'user_data']);
        // You can dispatch a logout action here if using Redux
      }
    }

    return Promise.reject(error);
  }
);

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
}

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  cnic?: string;
  address?: string;
  country?: string;
  status: 'pending' | 'active' | 'suspended';
  role: 'driver' | 'passenger' | 'admin';
  roles: string[];
  emergency_contact?: string;
  license_number?: string;
  vehicle_type?: string;
  preferred_payment?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  token_type: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  // Basic Info
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  user_type: 'driver' | 'passenger';
  phone: string;
  cnic: string;
  address: string;
  date_of_birth: string;
  gender: 'male' | 'female';
  emergency_contact_name: string;
  emergency_contact_relation: string;
  languages: string;
  bio: string;
  
  // Passenger specific fields
  passenger_preferred_payment?: string;
  passenger_emergency_contact?: string;
  passenger_emergency_contact_name?: string;
  passenger_emergency_contact_relation?: string;
  
  // Driver specific fields
  license_number?: string;
  license_type?: string;
  license_expiry_date?: string;
  driving_experience?: string;
  bank_account_number?: string;
  bank_name?: string;
  bank_branch?: string;
  vehicle_type?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: string;
  vehicle_color?: string;
  license_plate?: string;
  registration_number?: string;
  preferred_payment?: string;
}

export interface RegisterWithImagesRequest extends RegisterRequest {
  // Image fields for passengers
  passenger_cnic_front_image?: string;
  passenger_cnic_back_image?: string;
  passenger_profile_image?: string;
  
  // Image fields for drivers
  cnic_front_image?: string;
  cnic_back_image?: string;
  license_image?: string;
  profile_image?: string;
  vehicle_front_image?: string;
  vehicle_back_image?: string;
  vehicle_left_image?: string;
  vehicle_right_image?: string;
}

export interface SendOtpRequest {
  phone: string;
}

export interface VerifyOtpRequest {
  phone: string;
  otp_code: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  email: string;
  password: string;
  password_confirmation: string;
}

// API Service Class
class ApiService {
  // Authentication Methods
  async login(credentials: LoginRequest): Promise<ApiResponse<AuthResponse>> {
    console.log('🌐 API Service - Logging in user...');
    console.log('📡 Endpoint: POST /auth/login');
    console.log('📋 Request data:', credentials);
    
    const response = await apiClient.post('/auth/login', credentials);
    
    console.log('📨 API Service - Login response received');
    console.log('📊 Response status:', response.status);
    console.log('📋 Response data:', response.data);
    
    return response.data;
  }

  async register(userData: RegisterRequest): Promise<ApiResponse<{ user: User }>> {
    console.log('🌐 API Service - Registering user...');
    console.log('📡 Endpoint: POST /auth/register');
    console.log('📋 Request data:', userData);
    
    try {
      const response = await apiClient.post('/auth/register', userData);
      
      console.log('📨 API Service - Registration response received');
      console.log('📊 Response status:', response.status);
      console.log('📋 Response data:', response.data);
      
      return response.data;
    } catch (error: any) {
      console.error('💥 API Service - Registration error:', error);
      console.error('🔍 Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        userData: userData
      });
      
      // Log validation errors if available
      if (error.response?.data?.errors) {
        console.error('📋 Validation errors:', error.response.data.errors);
        // Log each validation error in detail
        Object.entries(error.response.data.errors).forEach(([field, messages]) => {
          console.error(`❌ ${field}:`, messages);
        });
      }
      
      throw error;
    }
  }

  // Register with images using FormData
  async registerWithImages(userData: RegisterWithImagesRequest): Promise<ApiResponse<{ user: User }>> {
    console.log('🌐 API Service - Registering user with images...');
    console.log('📡 Endpoint: POST /auth/register');
    console.log('📋 Request data:', userData);
    
    try {
      // Sanitize the data before sending
      const sanitizedData = this.sanitizeRegistrationData(userData);
      
      // Create FormData for multipart/form-data request
      const formData = new FormData();
      
      // Add all text fields
      Object.entries(sanitizedData).forEach(([key, value]) => {
        if (value !== undefined && value !== null && typeof value === 'string') {
          formData.append(key, value);
        }
      });
      
      // Add image fields if they exist
      const imageFields = [
        'passenger_cnic_front_image',
        'passenger_cnic_back_image', 
        'passenger_profile_image',
        'cnic_front_image',
        'cnic_back_image',
        'license_image',
        'profile_image',
        'vehicle_front_image',
        'vehicle_back_image',
        'vehicle_left_image',
        'vehicle_right_image'
      ];
      
      imageFields.forEach(field => {
        if (userData[field as keyof RegisterWithImagesRequest]) {
          const imageUri = userData[field as keyof RegisterWithImagesRequest] as string;
          if (imageUri) {
            formData.append(field, {
              uri: imageUri,
              type: 'image/jpeg',
              name: `${field}.jpg`,
            } as any);
          }
        }
      });
      
      console.log('📤 FormData created with images');
      
      const response = await apiClient.post('/auth/register', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      console.log('📨 API Service - Registration with images response received');
      console.log('📊 Response status:', response.status);
      console.log('📋 Response data:', response.data);
      
      return response.data;
    } catch (error: any) {
      console.error('💥 API Service - Registration with images error:', error);
      console.error('🔍 Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        userData: userData
      });
      
      // Log validation errors if available
      if (error.response?.data?.errors) {
        console.error('📋 Validation errors:', error.response.data.errors);
        Object.entries(error.response.data.errors).forEach(([field, messages]) => {
          console.error(`❌ ${field}:`, messages);
        });
      }
      
      throw error;
    }
  }

  // Format phone number for API calls (with dashes)
  private formatPhoneForApi(phone: string): string {
    // Remove all non-digit characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');
    
    // Ensure it starts with +92
    if (!cleaned.startsWith('+92')) {
      if (cleaned.startsWith('92')) {
        cleaned = '+' + cleaned;
      } else if (cleaned.startsWith('0')) {
        cleaned = '+92' + cleaned.substring(1);
      } else {
        cleaned = '+92' + cleaned;
      }
    }
    
    // Format as +92-XXX-XXXXXXX
    if (cleaned.length >= 13) {
      const countryCode = cleaned.substring(0, 3); // +92
      const areaCode = cleaned.substring(3, 6);    // XXX
      const number = cleaned.substring(6, 13);      // XXXXXXX
      
      return `${countryCode}-${areaCode}-${number}`;
    }
    
    return phone; // Return original if not long enough
  }

  // Sanitize registration data to fix common issues
  private sanitizeRegistrationData(data: RegisterWithImagesRequest): RegisterWithImagesRequest {
    const sanitized = { ...data };
    
    // Trim whitespace from string fields
    const stringFields = [
      'name', 'email', 'phone', 'cnic', 'address', 'emergency_contact_name',
      'emergency_contact_relation', 'languages', 'bio', 'passenger_emergency_contact',
      'passenger_emergency_contact_name', 'passenger_emergency_contact_relation',
      'license_number', 'license_type', 'driving_experience', 'bank_account_number',
      'bank_name', 'bank_branch', 'vehicle_make', 'vehicle_model', 'vehicle_color',
      'license_plate', 'registration_number'
    ];
    
    stringFields.forEach(field => {
      if (sanitized[field as keyof RegisterWithImagesRequest] && 
          typeof sanitized[field as keyof RegisterWithImagesRequest] === 'string') {
        (sanitized as any)[field] = ((sanitized as any)[field] as string).trim();
      }
    });
    
    // Fix specific relation values
    if (sanitized.emergency_contact_relation) {
      const relation = sanitized.emergency_contact_relation.toLowerCase().trim();
      
      // Map common variations to valid values
      const relationMap: Record<string, string> = {
        'brother ': 'brother',
        'sister ': 'sister',
        'father ': 'father',
        'mother ': 'mother',
        'spouse ': 'spouse',
        'friend ': 'friend',
        'other ': 'other'
      };
      
      sanitized.emergency_contact_relation = relationMap[relation] || relation;
    }
    
    if (sanitized.passenger_emergency_contact_relation) {
      const relation = sanitized.passenger_emergency_contact_relation.toLowerCase().trim();
      
      // Map common variations to valid values
      const relationMap: Record<string, string> = {
        'brother ': 'brother',
        'sister ': 'sister',
        'father ': 'father',
        'mother ': 'mother',
        'spouse ': 'spouse',
        'friend ': 'friend',
        'other ': 'other'
      };
      
      sanitized.passenger_emergency_contact_relation = relationMap[relation] || relation;
    }
    
    // Ensure email is lowercase
    if (sanitized.email) {
      sanitized.email = sanitized.email.toLowerCase();
    }
    
    console.log('🧹 Sanitized registration data:', sanitized);
    
    return sanitized;
  }


  async sendOtp(phone: string): Promise<ApiResponse<{ phone: string; otp_code: string; expires_in: number }>> {
    console.log('🌐 API Service - Sending OTP to phone number...');
    console.log('📡 Endpoint: POST /auth/send-otp');
    console.log('📱 Phone number:', phone);
    console.log('⏰ Request timestamp:', new Date().toISOString());
    
    try {
      // Format phone number with dashes for API
      const formattedPhone = this.formatPhoneForApi(phone);
      console.log('📱 Formatted phone for API:', formattedPhone);
      
      const response = await apiClient.post('/auth/send-otp', { phone: formattedPhone });
      
      console.log('📨 API Service - OTP send response received');
      console.log('📊 Response status:', response.status);
      console.log('📋 Response data:', response.data);
      
      if (response.data.success) {
        console.log('✅ OTP sent successfully');
        console.log('📱 Phone:', response.data.data?.phone);
        console.log('⏰ Expires in:', response.data.data?.expires_in, 'seconds');
        console.log('🔢 OTP Code (for testing):', response.data.data?.otp_code);
      } else {
        console.log('❌ OTP send failed:', response.data.message);
      }
      
      return response.data;
    } catch (error: any) {
      console.error('💥 API Service - OTP send error:', error);
      console.error('🔍 Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        phone: phone
      });
      throw error;
    }
  }

  async verifyOtp(otpData: VerifyOtpRequest): Promise<ApiResponse<AuthResponse>> {
    console.log('🌐 API Service - Verifying OTP...');
    console.log('📡 Endpoint: POST /auth/verify-otp');
    console.log('📋 OTP data:', {
      phone: otpData.phone,
      otp_code: otpData.otp_code ? '***' + otpData.otp_code.slice(-2) : 'undefined'
    });
    console.log('⏰ Request timestamp:', new Date().toISOString());
    
    try {
      // Format phone number with dashes for API
      const formattedOtpData = {
        ...otpData,
        phone: this.formatPhoneForApi(otpData.phone)
      };
      console.log('📱 Formatted OTP data for API:', {
        phone: formattedOtpData.phone,
        otp_code: formattedOtpData.otp_code ? '***' + formattedOtpData.otp_code.slice(-2) : 'undefined'
      });
      
      const response = await apiClient.post('/auth/verify-otp', formattedOtpData);
      
      console.log('📨 API Service - OTP verification response received');
      console.log('📊 Response status:', response.status);
      console.log('📋 Response data:', response.data);
      
      if (response.data.success && response.data.data) {
        console.log('✅ OTP verification successful');
        console.log('👤 User authenticated:', response.data.data.user?.name || 'Unknown');
        console.log('🔑 Token received:', response.data.data.token ? 'Yes' : 'No');
        console.log('📱 Phone verified:', response.data.data.user?.phone);
        console.log('👤 User role:', response.data.data.user?.role);
        console.log('📊 User status:', response.data.data.user?.status);
      } else {
        console.log('❌ OTP verification failed:', response.data.message);
        console.log('🔍 Error details:', response.data.errors);
      }
      
      return response.data;
    } catch (error: any) {
      console.error('💥 API Service - OTP verification error:', error);
      console.error('🔍 Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        phone: otpData.phone,
        otp_length: otpData.otp_code?.length
      });
      throw error;
    }
  }

  async forgotPassword(email: string): Promise<ApiResponse> {
    const response = await apiClient.post('/auth/forgot-password', { email });
    return response.data;
  }

  async resetPassword(resetData: ResetPasswordRequest): Promise<ApiResponse> {
    const response = await apiClient.post('/auth/reset-password', resetData);
    return response.data;
  }

  async logout(): Promise<ApiResponse> {
    const response = await apiClient.post('/auth/logout');
    return response.data;
  }

  async logoutAll(): Promise<ApiResponse> {
    const response = await apiClient.post('/auth/logout-all');
    return response.data;
  }

  async refreshToken(): Promise<ApiResponse<{ token: string; token_type: string }>> {
    const response = await apiClient.post('/auth/refresh');
    return response.data;
  }

  // User Profile Methods
  async getProfile(): Promise<ApiResponse<{ user: User }>> {
    const response = await apiClient.get('/auth/profile');
    return response.data;
  }

  async updateProfile(userData: Partial<User>): Promise<ApiResponse<{ user: User }>> {
    const response = await apiClient.put('/auth/profile', userData);
    return response.data;
  }

  // Test Authentication
  async testAuth(): Promise<ApiResponse<{ user: User }>> {
    const response = await apiClient.get('/user');
    return response.data;
  }

  // Test Network Connectivity
  async testNetworkConnectivity(): Promise<boolean> {
    try {
      console.log('🌐 Testing network connectivity...');
      console.log('🔗 Testing URL:', `${API_BASE_URL}/health`);
      
      // Try a simple health check endpoint first
      const response = await apiClient.get('/health', {
        timeout: 10000, // 10 second timeout
      });
      
      console.log('✅ Network connectivity test successful');
      console.log('📊 Response status:', response.status);
      return true;
    } catch (error: any) {
      console.log('⚠️ Health endpoint not available, trying alternative...');
      
      try {
        // If health endpoint doesn't exist, try a simple GET to root
        const response = await apiClient.get('/', {
          timeout: 10000,
        });
        
        console.log('✅ Network connectivity test successful (alternative)');
        console.log('📊 Response status:', response.status);
        return true;
      } catch (secondError: any) {
        console.error('❌ Network connectivity test failed');
        console.error('🔍 Error details:', {
          message: secondError.message,
          code: secondError.code,
          response: secondError.response?.status,
          url: `${API_BASE_URL}`
        });
        return false;
      }
    }
  }

  // Utility Methods
  async setAuthToken(token: string): Promise<void> {
    await AsyncStorage.setItem('auth_token', token);
  }

  async getAuthToken(): Promise<string | null> {
    return await AsyncStorage.getItem('auth_token');
  }

  async clearAuthData(): Promise<void> {
    await AsyncStorage.multiRemove(['auth_token', 'refresh_token', 'user_data']);
  }

  async setUserData(user: User): Promise<void> {
    await AsyncStorage.setItem('user_data', JSON.stringify(user));
  }

  async getUserData(): Promise<User | null> {
    try {
      const userData = await AsyncStorage.getItem('user_data');
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      return null;
    }
  }

  // Generic HTTP methods for external services
  async get(url: string, config?: any): Promise<any> {
    console.log('🌐 API Service - GET request:', url);
    const response = await apiClient.get(url, config);
    return response.data;
  }

  async post(url: string, data?: any, config?: any): Promise<any> {
    console.log('🌐 API Service - POST request:', url);
    const response = await apiClient.post(url, data, config);
    return response.data;
  }

  async put(url: string, data?: any, config?: any): Promise<any> {
    console.log('🌐 API Service - PUT request:', url);
    const response = await apiClient.put(url, data, config);
    return response.data;
  }

  async delete(url: string, config?: any): Promise<any> {
    console.log('🌐 API Service - DELETE request:', url);
    const response = await apiClient.delete(url, config);
    return response.data;
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;
