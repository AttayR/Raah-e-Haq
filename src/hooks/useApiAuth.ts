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
  getUserProfile,
  updateUserProfile,
  initializeAuth,
} from '../store/thunks/apiThunks';
import { logout as logoutThunk } from '../store/thunks/sessionThunks';
import {
  clearError,
  clearOtpData,
  setProfileCompleted,
  clearProfileCompleted,
  resetAuthState,
} from '../store/slices/apiAuthSlice';
import { LoginRequest, RegisterRequest, VerifyOtpRequest, ResetPasswordRequest } from '../services/api';

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
  const registerWithImages = useCallback(async (userData: RegisterRequest & { 
    passenger_cnic_front_image?: string; 
    passenger_cnic_back_image?: string; 
  }) => {
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

  // Logout: the one session-ending thunk (T-102). Screens should use useLogout() (confirm dialog).
  const logout = useCallback(async () => {
    return dispatch(logoutThunk());
  }, [dispatch]);

  // Logout from all devices (same cleanup, revokes every token)
  const logoutAll = useCallback(async () => {
    return dispatch(logoutThunk({ allDevices: true }));
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
    getProfile,
    updateProfile,
    clearAuthError,
    clearOtp,
    markProfileCompleted,
    clearProfile,
    resetAuth,
  };
};
