import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API Configuration
const API_BASE_URL = 'https://raahehaq.com/api';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
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
  cnic?: string;
  address?: string;
  emergency_contact?: string;
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
    
    const response = await apiClient.post('/auth/register', userData);
    
    console.log('📨 API Service - Registration response received');
    console.log('📊 Response status:', response.status);
    console.log('📋 Response data:', response.data);
    
    return response.data;
  }

  async sendOtp(phone: string): Promise<ApiResponse<{ phone: string; otp_code: string; expires_in: number }>> {
    const response = await apiClient.post('/auth/send-otp', { phone });
    return response.data;
  }

  async verifyOtp(otpData: VerifyOtpRequest): Promise<ApiResponse<AuthResponse>> {
    const response = await apiClient.post('/auth/verify-otp', otpData);
    return response.data;
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
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;
