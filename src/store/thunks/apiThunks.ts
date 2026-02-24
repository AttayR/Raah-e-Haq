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

export const registerUserWithImages = createAsyncThunk(
  'auth/registerUserWithImages',
  async (userData: RegisterRequest & { 
    passenger_cnic_front_image?: string; 
    passenger_cnic_back_image?: string; 
  }, { rejectWithValue }) => {
    try {
      console.log('🔄 Redux Thunk - Starting user registration with images...');
      console.log('📋 User data received:', userData);
      
      const response = await apiService.registerWithImages(userData);
      
      console.log('📨 Redux Thunk - Registration with images API response received');
      console.log('📊 Response success:', response.success);
      console.log('📋 Response data:', response.data);
      
      if (response.success && response.data) {
        console.log('✅ Redux Thunk - Registration with images successful');
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
        console.log('❌ Redux Thunk - Registration with images failed:', response.message);
        return rejectWithValue(response.message || 'Registration with images failed');
      }
    } catch (error: any) {
      console.error('💥 Redux Thunk - Registration with images error:', error);
      console.error('🔍 Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });

      const status = error.response?.status;
      const data = error.response?.data;
      if (status === 422 && data?.errors && typeof data.errors === 'object') {
        const firstMessages = Object.entries(data.errors).map(([field, messages]) => {
          const msg = Array.isArray(messages) ? messages[0] : String(messages);
          return `${field}: ${msg}`;
        });
        return rejectWithValue({
          message: data.message || 'Validation failed. Please check the fields below.',
          errors: data.errors as Record<string, string[]>,
          summary: firstMessages.join(' '),
        });
      }

      return rejectWithValue(
        data?.message ||
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
      console.log('🔄 Redux Thunk - Starting OTP send process...');
      console.log('📱 Phone number:', phone);
      console.log('⏰ Thunk timestamp:', new Date().toISOString());
      
      const response = await apiService.sendOtp(phone);
      
      console.log('📨 Redux Thunk - OTP send API response received');
      console.log('📊 Response success:', response.success);
      console.log('📋 Response data:', response.data);
      
      if (response.success && response.data) {
        console.log('✅ Redux Thunk - OTP sent successfully');
        console.log('📱 Phone verified:', response.data.phone);
        console.log('⏰ OTP expires in:', response.data.expires_in, 'seconds');
        console.log('🔢 OTP code (for testing):', response.data.otp_code);
        
        return response.data;
      } else {
        console.log('❌ Redux Thunk - OTP send failed:', response.message);
        console.log('🔍 Error details:', response.errors);
        return rejectWithValue(response.message || 'Failed to send OTP');
      }
    } catch (error: any) {
      console.error('💥 Redux Thunk - OTP send error:', error);
      console.error('🔍 Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        phone: phone
      });
      
      const errorMessage = error.response?.data?.message || 
        error.message || 
        'Failed to send OTP';
      
      console.log('📤 Redux Thunk - Rejecting with error:', errorMessage);
      return rejectWithValue(errorMessage);
    }
  }
);

export const verifyOtp = createAsyncThunk(
  'auth/verifyOtp',
  async (otpData: VerifyOtpRequest, { rejectWithValue }) => {
    try {
      console.log('🔄 Redux Thunk - Starting OTP verification process...');
      console.log('📋 OTP data:', {
        phone: otpData.phone,
        otp_code: otpData.otp_code ? '***' + otpData.otp_code.slice(-2) : 'undefined'
      });
      console.log('⏰ Thunk timestamp:', new Date().toISOString());
      
      const response = await apiService.verifyOtp(otpData);
      
      console.log('📨 Redux Thunk - OTP verification API response received');
      console.log('📊 Response success:', response.success);
      console.log('📋 Response data:', response.data);
      
      if (response.success && response.data) {
        console.log('✅ Redux Thunk - OTP verification successful');
        console.log('👤 User authenticated:', response.data.user?.name || 'Unknown');
        console.log('🔑 Token received:', response.data.token ? 'Yes' : 'No');
        console.log('📱 Phone verified:', response.data.user?.phone);
        console.log('👤 User role:', response.data.user?.role);
        console.log('📊 User status:', response.data.user?.status);
        
        // Store auth data
        console.log('💾 Storing authentication data...');
        await apiService.setAuthToken(response.data.token);
        await apiService.setUserData(response.data.user);
        console.log('✅ Authentication data stored successfully');
        
        return {
          user: response.data.user,
          token: response.data.token,
          tokenType: response.data.token_type,
        };
      } else {
        console.log('❌ Redux Thunk - OTP verification failed:', response.message);
        console.log('🔍 Error details:', response.errors);
        return rejectWithValue(response.message || 'OTP verification failed');
      }
    } catch (error: any) {
      console.error('💥 Redux Thunk - OTP verification error:', error);
      console.error('🔍 Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        phone: otpData.phone,
        otp_length: otpData.otp_code?.length
      });
      
      const errorMessage = error.response?.data?.message || 
        error.message || 
        'OTP verification failed';
      
      console.log('📤 Redux Thunk - Rejecting with error:', errorMessage);
      return rejectWithValue(errorMessage);
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
