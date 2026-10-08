import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, CancelTokenSource } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { env } from '../config/env';
import { logger } from '../core/logging/logger';
import { toApiError } from '../core/api/errors';
import type { ApiResponse } from '../core/api/types';

export type { ApiResponse } from '../core/api/types';
export { ApiError, isApiError, unwrap } from '../core/api/errors';

// API Configuration: base URL comes from the env config (see src/config/env.ts)
const API_BASE_URL = env.API_URL;

// Create axios instance (the only HTTP client for the backend)
export const apiClient: AxiosInstance = axios.create({
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
      logger.debug('Error cancelling request:', error);
    }
  });
  activeRequests.clear();
};

// Helper function to remove a request from tracking
export const removeRequest = (source: CancelTokenSource) => {
  activeRequests.delete(source);
};

// "scheme://host[:port]" of an absolute URL, lower-cased; null for relative URLs.
// (Regex instead of URL: React Native's URL polyfill does not implement `origin`.)
const originOf = (url: string): string | null => {
  const match = /^([a-z][a-z\d+\-.]*:)?\/\/([^/?#]*)/i.exec(url);
  if (!match) return null;
  return `${(match[1] ?? '').toLowerCase()}//${match[2].toLowerCase()}`;
};

const API_ORIGIN = originOf(API_BASE_URL);

/** The bearer token is sent only to our API: relative URLs, or absolute ones on env.API_URL's origin. */
export const isApiUrl = (url?: string): boolean => {
  if (!url) return true;
  const origin = originOf(url);
  return origin === null || (API_ORIGIN !== null && origin === API_ORIGIN);
};

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  async (config) => {
    if (!isApiUrl(config.url)) {
      return config;
    }
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      logger.debug('Error getting token from storage:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: 401 refresh, then every failure is normalised to ApiError
// (src/core/api/errors.ts) so callers never parse axios errors themselves.
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error) => {
    // Handle cancelled requests (don't process them)
    if (axios.isCancel(error)) {
      logger.debug('Request cancelled');
      return Promise.reject(toApiError(error));
    }

    const originalRequest = error?.config;

    // Handle 401 errors (unauthorized)
    if (error?.response?.status === 401 && originalRequest && !originalRequest._retry) {
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

    return Promise.reject(toApiError(error));
  }
);

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

/** POST /auth/register: drivers get no token until approved (token and token_type are null). */
export interface RegisterResponse {
  user: User;
  token: string | null;
  token_type: string | null;
}

/** POST /auth/send-otp (BE-16): otp_code is null outside APP_ENV=local; expires_in is seconds. */
export interface SendOtpResponse {
  phone: string;
  otp_code?: string | null;
  expires_in: number;
}

/** What the app keeps after send-otp: never the code itself (AUTH-02, INF-05). */
export type OtpSentInfo = Pick<SendOtpResponse, 'phone' | 'expires_in'>;

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
  date_of_birth?: string; // YYYY-MM-DD
  gender?: 'male' | 'female' | 'other';
  license_number?: string;
  vehicle_type?: string;
  preferred_payment?: string;
  // Driver-only (required by API for user_type === 'driver')
  license_type?: string;
  license_expiry_date?: string; // YYYY-MM-DD
  license_plate?: string;
  registration_number?: string;
  driving_experience?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: string;
  vehicle_color?: string;
  bank_name?: string;
  bank_branch?: string;
  bank_account_number?: string;
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
    logger.debug('🌐 API Service - Logging in user...');
    logger.debug('📡 Endpoint: POST /auth/login');
    
    const response = await apiClient.post('/auth/login', credentials);
    
    logger.debug('📨 API Service - Login response received');
    logger.debug('📊 Response status:', response.status);
    
    return response.data;
  }

  async register(userData: RegisterRequest): Promise<ApiResponse<RegisterResponse>> {
    logger.debug('🌐 API Service - Registering user...');
    logger.debug('📡 Endpoint: POST /auth/register');
    
    try {
      const response = await apiClient.post('/auth/register', userData);
      
      logger.debug('📨 API Service - Registration response received');
      logger.debug('📊 Response status:', response.status);
      
      return response.data;
    } catch (err: unknown) {
      const error = toApiError(err);
      logger.error('💥 API Service - Registration error:', error.message);
      logger.error('🔍 Error details:', {
        kind: error.kind,
        status: error.status,
        fields: Object.keys(error.fieldErrors),
      });
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
  }): Promise<ApiResponse<RegisterResponse>> {
    logger.debug('🌐 API Service - Registering user with images...');
    logger.debug('📡 Endpoint: POST /auth/register (multipart/form-data)');

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
      if (userData.date_of_birth) formData.append('date_of_birth', userData.date_of_birth);
      if (userData.gender) formData.append('gender', userData.gender);
      if (userData.license_number) formData.append('license_number', userData.license_number);
      if (userData.vehicle_type) formData.append('vehicle_type', userData.vehicle_type);
      if (userData.preferred_payment) formData.append('preferred_payment', userData.preferred_payment);

      if (userData.user_type === 'driver') {
        if (userData.license_type) formData.append('license_type', userData.license_type);
        if (userData.license_expiry_date) formData.append('license_expiry_date', userData.license_expiry_date);
        if (userData.license_plate) formData.append('license_plate', userData.license_plate);
        if (userData.registration_number) formData.append('registration_number', userData.registration_number);
        if (userData.driving_experience) formData.append('driving_experience', userData.driving_experience);
        if (userData.vehicle_make) formData.append('vehicle_make', userData.vehicle_make);
        if (userData.vehicle_model) formData.append('vehicle_model', userData.vehicle_model);
        if (userData.vehicle_year) formData.append('vehicle_year', userData.vehicle_year);
        if (userData.vehicle_color) formData.append('vehicle_color', userData.vehicle_color);
        if (userData.bank_name) formData.append('bank_name', userData.bank_name);
        if (userData.bank_branch) formData.append('bank_branch', userData.bank_branch);
        if (userData.bank_account_number) formData.append('bank_account_number', userData.bank_account_number);
      }

      // Attach passenger CNIC images when applicable
      if (userData.user_type === 'passenger') {
        const front = buildFile(userData.passenger_cnic_front_image, 'cnic_front.jpg');
        const back = buildFile(userData.passenger_cnic_back_image, 'cnic_back.jpg');
        if (front) formData.append('passenger_cnic_front_image', front);
        if (back) formData.append('passenger_cnic_back_image', back);
        const profile = buildFile(userData.passenger_profile_image, 'profile.jpg');
        if (profile) formData.append('passenger_profile_image', profile);
        formData.append('passenger_emergency_contact', userData.passenger_emergency_contact || userData.emergency_contact);
        if (userData.passenger_emergency_contact_name) formData.append('passenger_emergency_contact_name', userData.passenger_emergency_contact_name);
        formData.append('passenger_emergency_contact_relation', userData.passenger_emergency_contact_relation || 'other');
        if (userData.passenger_preferred_payment) formData.append('passenger_preferred_payment', userData.passenger_preferred_payment);
      }

      logger.debug('📤 Sending multipart/form-data registration request...');
      logger.debug('🌐 API Base URL:', API_BASE_URL);
      logger.debug('🔗 Full URL:', `${API_BASE_URL}/auth/register`);

      const response = await apiClient.post('/auth/register', formData, {
        headers: {
          // Let axios set boundary automatically; just indicate multipart
          'Content-Type': 'multipart/form-data',
          'Accept': 'application/json',
        },
      });

      logger.debug('📨 API Service - Registration with images response received');
      logger.debug('📊 Response status:', response.status);
      return response.data;
    } catch (err: unknown) {
      const error = toApiError(err);
      logger.error('💥 API Service - Registration with images error:', error.message);
      logger.error('🔍 Error details:', {
        kind: error.kind,
        status: error.status,
        fields: Object.keys(error.fieldErrors),
      });
      throw error;
    }
  }

  async sendOtp(phone: string): Promise<ApiResponse<SendOtpResponse>> {
    logger.debug('🌐 API Service - Sending OTP to phone number...');
    logger.debug('📡 Endpoint: POST /auth/send-otp');
    logger.debug('⏰ Request timestamp:', new Date().toISOString());
    
    try {
      const response = await apiClient.post('/auth/send-otp', { phone });
      
      logger.debug('📨 API Service - OTP send response received');
      logger.debug('📊 Response status:', response.status);
      
      if (response.data.success) {
        logger.debug('✅ OTP sent successfully');
        logger.debug('⏰ Expires in:', response.data.data?.expires_in, 'seconds');
      } else {
        logger.debug('❌ OTP send failed:', response.data.message);
      }
      
      return response.data;
    } catch (err: unknown) {
      const error = toApiError(err);
      logger.error('💥 API Service - OTP send error:', error.message);
      logger.error('🔍 Error details:', {
        kind: error.kind,
        status: error.status,
        fields: Object.keys(error.fieldErrors),
      });
      throw error;
    }
  }

  async verifyOtp(otpData: VerifyOtpRequest): Promise<ApiResponse<AuthResponse>> {
    logger.debug('🌐 API Service - Verifying OTP...');
    logger.debug('📡 Endpoint: POST /auth/verify-otp');
    logger.debug('⏰ Request timestamp:', new Date().toISOString());
    
    try {
      const response = await apiClient.post('/auth/verify-otp', otpData);
      
      logger.debug('📨 API Service - OTP verification response received');
      logger.debug('📊 Response status:', response.status);
      
      if (response.data.success && response.data.data) {
        logger.debug('✅ OTP verification successful');
        logger.debug('🔑 Token received:', response.data.data.token ? 'Yes' : 'No');
        logger.debug('👤 User role:', response.data.data.user?.role);
        logger.debug('📊 User status:', response.data.data.user?.status);
      } else {
        logger.debug('❌ OTP verification failed:', response.data.message);
        logger.debug('🔍 Error details:', response.data.errors);
      }
      
      return response.data;
    } catch (err: unknown) {
      const error = toApiError(err);
      logger.error('💥 API Service - OTP verification error:', error.message);
      logger.error('🔍 Error details:', {
        kind: error.kind,
        status: error.status,
        fields: Object.keys(error.fieldErrors),
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

  // PUT /profile (there is no PUT /auth/profile). data is the raw user model with a `roles`
  // relation, not the normalised auth user; normalizeUser lands in T-105, the profile screen in T-504.
  async updateProfile(userData: Partial<User>): Promise<ApiResponse<User>> {
    const response = await apiClient.put('/profile', userData);
    return response.data;
  }

  // Test Authentication
  async testAuth(): Promise<ApiResponse<{ user: User }>> {
    const response = await apiClient.get('/user');
    return response.data;
  }

  // Test Network Connectivity
  // Uses a GET to the base API; any HTTP response (including 4xx/5xx) means the server is reachable.
  // Only network failures (timeout, no connection, DNS) are treated as no connectivity.
  async testNetworkConnectivity(): Promise<boolean> {
    try {
      logger.debug('🌐 Testing network connectivity...');
      logger.debug('🔗 Testing URL:', API_BASE_URL);

      const response = await apiClient.get('/', {
        timeout: 10000,
        validateStatus: () => true, // Accept any status so we only fail on network error
      });

      logger.debug('✅ Network connectivity test successful');
      logger.debug('📊 Response status:', response.status);
      return true;
    } catch (err: unknown) {
      const error = toApiError(err);
      // Server responded with an error (e.g. 404) = we have connectivity
      if (error.status != null) {
        logger.debug('✅ Server reachable (response status:', error.status, ')');
        return true;
      }
      logger.error('❌ Network connectivity test failed');
      logger.error('🔍 Error details:', { kind: error.kind, message: error.message });
      return false;
    }
  }

  // Utility Methods
  async setAuthToken(token: string | null | undefined): Promise<void> {
    if (token != null && token !== '') {
      await AsyncStorage.setItem('auth_token', token);
    } else {
      await AsyncStorage.removeItem('auth_token');
    }
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

  // Generic HTTP methods: return the response body (the API envelope). Use unwrap() for `data`.
  async get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    logger.debug('🌐 API Service - GET request:', url);
    const response = await apiClient.get<ApiResponse<T>>(url, config);
    return response.data;
  }

  async post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    logger.debug('🌐 API Service - POST request:', url);
    const response = await apiClient.post<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  async put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    logger.debug('🌐 API Service - PUT request:', url);
    const response = await apiClient.put<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  async delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    logger.debug('🌐 API Service - DELETE request:', url);
    const response = await apiClient.delete<ApiResponse<T>>(url, config);
    return response.data;
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;
