import axios, { AxiosInstance, AxiosResponse } from 'axios';
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
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  user_type: 'driver' | 'passenger';
  phone: string;
  cnic: string;
  address: string;
  emergency_contact: string;
  license_number?: string;
  vehicle_type?: string;
  preferred_payment?: string;
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

  // Alternative registration method using /users endpoint with multipart/form-data
  async registerWithImages(userData: RegisterRequest & { 
    passenger_cnic_front_image?: string; 
    passenger_cnic_back_image?: string; 
    passenger_profile_image?: string;
    passenger_preferred_payment?: 'cash' | 'card' | 'mobile_wallet';
    passenger_emergency_contact?: string;
    passenger_emergency_contact_name?: string;
    passenger_emergency_contact_relation?: string;
  }): Promise<ApiResponse<{ user: User }>> {
    console.log('🌐 API Service - Registering user with images...');
    console.log('📡 Endpoint: POST /auth/register (multipart/form-data)');
    console.log('📋 Request data (redacted passwords):', {
      ...userData,
      password: userData.password ? '***' : undefined,
      password_confirmation: userData.password_confirmation ? '***' : undefined,
    });

    // Helper to build a RN-compatible file object from a URI
    const buildFile = (uri?: string, fallbackName?: string) => {
      if (!uri) return undefined;
      // React Native requires the raw URI, including file:// on Android
      const normalizedUri = uri;
      const filenameFromUri = () => {
        try {
          const lastSlash = normalizedUri.lastIndexOf('/');
          const name = lastSlash >= 0 ? normalizedUri.substring(lastSlash + 1) : fallbackName || 'upload.jpg';
          return name || 'upload.jpg';
        } catch {
          return fallbackName || 'upload.jpg';
        }
      };
      const inferredName = filenameFromUri();
      // Best-effort type inference
      const lower = inferredName.toLowerCase();
      const type = lower.endsWith('.png') ? 'image/png' : lower.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
      return { uri: normalizedUri, name: inferredName, type } as any;
    };

    try {
      const formData = new FormData();
      formData.append('name', userData.name);
      formData.append('email', userData.email);
      formData.append('password', userData.password);
      formData.append('password_confirmation', userData.password_confirmation);
      formData.append('user_type', userData.user_type);
      formData.append('phone', userData.phone);
      formData.append('cnic', userData.cnic);
      formData.append('address', userData.address);
      formData.append('emergency_contact', userData.emergency_contact);
      if (userData.license_number) formData.append('license_number', userData.license_number);
      if (userData.vehicle_type) formData.append('vehicle_type', userData.vehicle_type);
      if (userData.preferred_payment) formData.append('preferred_payment', userData.preferred_payment);

      // Log form data for debugging
      console.log('📋 FormData entries:');
      // Note: FormData.entries() is not available in React Native
      // We'll log the known fields instead
      console.log('  name:', userData.name);
      console.log('  email:', userData.email);
      console.log('  password: ***');
      console.log('  password_confirmation: ***');
      console.log('  user_type:', userData.user_type);
      console.log('  phone:', userData.phone);
      console.log('  cnic:', userData.cnic);
      console.log('  address:', userData.address);
      console.log('  emergency_contact:', userData.emergency_contact);

      // Attach passenger CNIC images when applicable
      if (userData.user_type === 'passenger') {
        const front = buildFile(userData.passenger_cnic_front_image, 'cnic_front.jpg');
        const back = buildFile(userData.passenger_cnic_back_image, 'cnic_back.jpg');
        if (front) formData.append('passenger_cnic_front_image', front);
        if (back) formData.append('passenger_cnic_back_image', back);
        const profile = buildFile(userData.passenger_profile_image, 'profile.jpg');
        if (profile) formData.append('passenger_profile_image', profile);
        if (userData.passenger_emergency_contact) formData.append('passenger_emergency_contact', userData.passenger_emergency_contact);
        if (userData.passenger_emergency_contact_name) formData.append('passenger_emergency_contact_name', userData.passenger_emergency_contact_name);
        if (userData.passenger_emergency_contact_relation) formData.append('passenger_emergency_contact_relation', userData.passenger_emergency_contact_relation);
        if (userData.passenger_preferred_payment) formData.append('passenger_preferred_payment', userData.passenger_preferred_payment);
      }

      console.log('📤 Sending multipart/form-data registration request...');
      console.log('🌐 API Base URL:', API_BASE_URL);
      console.log('🔗 Full URL:', `${API_BASE_URL}/auth/register`);

      const response = await apiClient.post('/auth/register', formData, {
        headers: {
          // Let axios set boundary automatically; just indicate multipart
          'Content-Type': 'multipart/form-data',
          'Accept': 'application/json',
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
        userData: { ...userData, password: userData.password ? '***' : undefined, password_confirmation: userData.password_confirmation ? '***' : undefined },
      });
      if (error.response?.data?.errors) {
        console.error('📋 Validation errors:', error.response.data.errors);
        Object.entries(error.response.data.errors).forEach(([field, messages]) => {
          console.error(`❌ ${field}:`, messages);
        });
      }
      throw error;
    }
  }

  async sendOtp(phone: string): Promise<ApiResponse<{ phone: string; otp_code: string; expires_in: number }>> {
    console.log('🌐 API Service - Sending OTP to phone number...');
    console.log('📡 Endpoint: POST /auth/send-otp');
    console.log('📱 Phone number:', phone);
    console.log('⏰ Request timestamp:', new Date().toISOString());
    
    try {
      const response = await apiClient.post('/auth/send-otp', { phone });
      
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
      const response = await apiClient.post('/auth/verify-otp', otpData);
      
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
      console.log('🔗 Testing URL:', `${API_BASE_URL}/auth/login`);
      
      const response = await apiClient.get('/auth/login', {
        timeout: 10000, // 10 second timeout
      });
      
      console.log('✅ Network connectivity test successful');
      console.log('📊 Response status:', response.status);
      return true;
    } catch (error: any) {
      console.error('❌ Network connectivity test failed');
      console.error('🔍 Error details:', {
        message: error.message,
        code: error.code,
        response: error.response?.status,
        url: `${API_BASE_URL}/auth/login`
      });
      return false;
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
