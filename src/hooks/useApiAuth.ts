import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import {
  loginUser,
  registerUser,
  registerUserWithImages,
  sendOtp,
  verifyOtp,
  forgotPassword,
  resetPassword,
  logoutUser,
  logoutAllDevices,
  refreshToken,
  getUserProfile,
  updateUserProfile,
  initializeAuth,
} from '../store/thunks/apiThunks';
import {
  clearError,
  clearOtpData,
  setProfileCompleted,
  clearProfileCompleted,
  resetAuthState,
} from '../store/slices/apiAuthSlice';
import { LoginRequest, RegisterRequest, RegisterWithImagesRequest, VerifyOtpRequest, ResetPasswordRequest } from '../services/api';

export const useApiAuth = () => {
  const dispatch = useAppDispatch();
  const authState = useAppSelector((state) => state.apiAuth);

  // Initialize auth on app start
  const initialize = useCallback(() => {
    dispatch(initializeAuth());
  }, [dispatch]);

  // Login with email and password
  const login = useCallback(async (credentials: LoginRequest) => {
    return dispatch(loginUser(credentials));
  }, [dispatch]);

  // Register new user
  const register = useCallback(async (userData: RegisterRequest) => {
    return dispatch(registerUser(userData));
  }, [dispatch]);

  // Register new user with images
  const registerWithImages = useCallback(async (userData: RegisterWithImagesRequest) => {
    return dispatch(registerUserWithImages(userData));
  }, [dispatch]);

  // Send OTP to phone number
  const sendOtpToPhone = useCallback(async (phone: string) => {
    return dispatch(sendOtp(phone));
  }, [dispatch]);

  // Verify OTP
  const verifyOtpCode = useCallback(async (otpData: VerifyOtpRequest) => {
    return dispatch(verifyOtp(otpData));
  }, [dispatch]);

  // Forgot password
  const forgotPasswordRequest = useCallback(async (email: string) => {
    return dispatch(forgotPassword(email));
  }, [dispatch]);

  // Reset password
  const resetPasswordRequest = useCallback(async (resetData: ResetPasswordRequest) => {
    return dispatch(resetPassword(resetData));
  }, [dispatch]);

  // Logout
  const logout = useCallback(async () => {
    return dispatch(logoutUser());
  }, [dispatch]);

  // Logout from all devices
  const logoutAll = useCallback(async () => {
    return dispatch(logoutAllDevices());
  }, [dispatch]);

  // Refresh token
  const refreshAuthToken = useCallback(async () => {
    return dispatch(refreshToken());
  }, [dispatch]);

  // Get user profile
  const getProfile = useCallback(async () => {
    return dispatch(getUserProfile());
  }, [dispatch]);

  // Update user profile
  const updateProfile = useCallback(async (userData: any) => {
    return dispatch(updateUserProfile(userData));
  }, [dispatch]);

  // Clear error
  const clearAuthError = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  // Clear OTP data
  const clearOtp = useCallback(() => {
    dispatch(clearOtpData());
  }, [dispatch]);

  // Set profile completed
  const markProfileCompleted = useCallback(() => {
    dispatch(setProfileCompleted());
  }, [dispatch]);

  // Clear profile completed
  const clearProfile = useCallback(() => {
    dispatch(clearProfileCompleted());
  }, [dispatch]);

  // Reset auth state
  const resetAuth = useCallback(() => {
    dispatch(resetAuthState());
  }, [dispatch]);

  return {
    // State
    user: authState.user,
    token: authState.token,
    isAuthenticated: authState.isAuthenticated,
    status: authState.status,
    error: authState.error,
    otpData: authState.otpData,
    isOtpSent: authState.isOtpSent,
    isOtpVerified: authState.isOtpVerified,
    profileCompleted: authState.profileCompleted,
    isInitialized: authState.isInitialized,
    isLoading: authState.status === 'loading',

    // Actions
    initialize,
    login,
    register,
    registerWithImages,
    sendOtpToPhone,
    verifyOtpCode,
    forgotPasswordRequest,
    resetPasswordRequest,
    logout,
    logoutAll,
    refreshAuthToken,
    getProfile,
    updateProfile,
    clearAuthError,
    clearOtp,
    markProfileCompleted,
    clearProfile,
    resetAuth,
  };
};
