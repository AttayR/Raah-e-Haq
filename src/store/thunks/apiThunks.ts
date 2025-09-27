import { createAsyncThunk } from '@reduxjs/toolkit';
import { apiService, LoginRequest, RegisterRequest, SendOtpRequest, VerifyOtpRequest, ForgotPasswordRequest, ResetPasswordRequest, User } from '../../services/api';

// Auth Thunks
export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async (credentials: LoginRequest, { rejectWithValue }) => {
    try {
      console.log('🔄 Redux Thunk - Starting user login...');
      console.log('📋 Credentials received:', credentials);
      
      const response = await apiService.login(credentials);
      
      console.log('📨 Redux Thunk - API response received:', response);
      
      if (response.success && response.data) {
        console.log('✅ Redux Thunk - Login successful');
        console.log('👤 User data:', response.data.user);
        console.log('🔑 Token:', response.data.token);
        
        // Store auth data
        await apiService.setAuthToken(response.data.token);
        await apiService.setUserData(response.data.user);
        
        console.log('💾 Auth data stored successfully');
        
        return {
          user: response.data.user,
          token: response.data.token,
          tokenType: response.data.token_type,
        };
      } else {
        console.log('❌ Redux Thunk - Login failed:', response.message);
        return rejectWithValue(response.message || 'Login failed');
      }
    } catch (error: any) {
      console.error('💥 Redux Thunk - Login error:', error);
      console.error('🔍 Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      return rejectWithValue(
        error.response?.data?.message || 
        error.message || 
        'Login failed'
      );
    }
  }
);

export const registerUser = createAsyncThunk(
  'auth/registerUser',
  async (userData: RegisterRequest, { rejectWithValue }) => {
    try {
      console.log('🔄 Redux Thunk - Starting user registration...');
      console.log('📋 User data received:', userData);
      
      const response = await apiService.register(userData);
      
      console.log('📨 Redux Thunk - API response received:', response);
      
      if (response.success && response.data) {
        console.log('✅ Redux Thunk - Registration successful');
        console.log('👤 User created:', response.data.user);
        return response.data.user;
      } else {
        console.log('❌ Redux Thunk - Registration failed:', response.message);
        return rejectWithValue(response.message || 'Registration failed');
      }
    } catch (error: any) {
      console.error('💥 Redux Thunk - Registration error:', error);
      console.error('🔍 Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      return rejectWithValue(
        error.response?.data?.message || 
        error.message || 
        'Registration failed'
      );
    }
  }
);

export const sendOtp = createAsyncThunk(
  'auth/sendOtp',
  async (phone: string, { rejectWithValue }) => {
    try {
      const response = await apiService.sendOtp(phone);
      
      if (response.success && response.data) {
        return response.data;
      } else {
        return rejectWithValue(response.message || 'Failed to send OTP');
      }
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || 
        error.message || 
        'Failed to send OTP'
      );
    }
  }
);

export const verifyOtp = createAsyncThunk(
  'auth/verifyOtp',
  async (otpData: VerifyOtpRequest, { rejectWithValue }) => {
    try {
      const response = await apiService.verifyOtp(otpData);
      
      if (response.success && response.data) {
        // Store auth data
        await apiService.setAuthToken(response.data.token);
        await apiService.setUserData(response.data.user);
        
        return {
          user: response.data.user,
          token: response.data.token,
          tokenType: response.data.token_type,
        };
      } else {
        return rejectWithValue(response.message || 'OTP verification failed');
      }
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || 
        error.message || 
        'OTP verification failed'
      );
    }
  }
);

export const forgotPassword = createAsyncThunk(
  'auth/forgotPassword',
  async (email: string, { rejectWithValue }) => {
    try {
      const response = await apiService.forgotPassword(email);
      
      if (response.success) {
        return response.message;
      } else {
        return rejectWithValue(response.message || 'Failed to send reset email');
      }
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || 
        error.message || 
        'Failed to send reset email'
      );
    }
  }
);

export const resetPassword = createAsyncThunk(
  'auth/resetPassword',
  async (resetData: ResetPasswordRequest, { rejectWithValue }) => {
    try {
      const response = await apiService.resetPassword(resetData);
      
      if (response.success) {
        return response.message;
      } else {
        return rejectWithValue(response.message || 'Password reset failed');
      }
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || 
        error.message || 
        'Password reset failed'
      );
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiService.logout();
      
      // Clear local storage regardless of API response
      await apiService.clearAuthData();
      
      if (response.success) {
        return response.message;
      } else {
        return rejectWithValue(response.message || 'Logout failed');
      }
    } catch (error: any) {
      // Clear local storage even if API call fails
      await apiService.clearAuthData();
      return rejectWithValue(
        error.response?.data?.message || 
        error.message || 
        'Logout failed'
      );
    }
  }
);

export const logoutAllDevices = createAsyncThunk(
  'auth/logoutAllDevices',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiService.logoutAll();
      
      // Clear local storage regardless of API response
      await apiService.clearAuthData();
      
      if (response.success) {
        return response.message;
      } else {
        return rejectWithValue(response.message || 'Logout from all devices failed');
      }
    } catch (error: any) {
      // Clear local storage even if API call fails
      await apiService.clearAuthData();
      return rejectWithValue(
        error.response?.data?.message || 
        error.message || 
        'Logout from all devices failed'
      );
    }
  }
);

export const refreshToken = createAsyncThunk(
  'auth/refreshToken',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiService.refreshToken();
      
      if (response.success && response.data) {
        await apiService.setAuthToken(response.data.token);
        return response.data.token;
      } else {
        return rejectWithValue(response.message || 'Token refresh failed');
      }
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || 
        error.message || 
        'Token refresh failed'
      );
    }
  }
);

// User Profile Thunks
export const getUserProfile = createAsyncThunk(
  'auth/getUserProfile',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiService.getProfile();
      
      if (response.success && response.data) {
        await apiService.setUserData(response.data.user);
        return response.data.user;
      } else {
        return rejectWithValue(response.message || 'Failed to get profile');
      }
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || 
        error.message || 
        'Failed to get profile'
      );
    }
  }
);

export const updateUserProfile = createAsyncThunk(
  'auth/updateUserProfile',
  async (userData: Partial<User>, { rejectWithValue }) => {
    try {
      const response = await apiService.updateProfile(userData);
      
      if (response.success && response.data) {
        await apiService.setUserData(response.data.user);
        return response.data.user;
      } else {
        return rejectWithValue(response.message || 'Profile update failed');
      }
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || 
        error.message || 
        'Profile update failed'
      );
    }
  }
);

// Initialize Auth State
export const initializeAuth = createAsyncThunk(
  'auth/initializeAuth',
  async (_, { rejectWithValue }) => {
    try {
      const token = await apiService.getAuthToken();
      const userData = await apiService.getUserData();
      
      if (token && userData) {
        // Verify token is still valid by making a test request
        try {
          await apiService.testAuth();
          return { user: userData, token };
        } catch (error) {
          // Token is invalid, clear auth data
          await apiService.clearAuthData();
          return null;
        }
      }
      
      return null;
    } catch (error: any) {
      return rejectWithValue(
        error.message || 'Failed to initialize auth'
      );
    }
  }
);
