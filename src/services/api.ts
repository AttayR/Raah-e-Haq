import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  CancelTokenSource,
  InternalAxiosRequestConfig,
} from 'axios';
import { env } from '../config/env';
import { authStorage } from './authStorage';
import { currentSessionEpoch, isStaleSession } from '../store/sessionEpoch';
import { logger } from '../core/logging/logger';
import { toApiError, type ApiError } from '../core/api/errors';
import { logApiFailure } from '../core/api/logApiFailure';
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

const HAS_SCHEME = /^[a-z][a-z\d+\-.]*:/i;

/** A URL we cannot parse reliably (backslashes, a scheme without "//"): never gets the token. */
const isUnparseableUrl = (url?: string): boolean =>
  !!url && (url.includes('\\') || (HAS_SCHEME.test(url) && originOf(url) === null));

/**
 * The bearer token is sent only when the request's resolved URL (baseURL applied, so a
 * per-request baseURL override counts, SEC-21) is exactly on env.API_URL's origin. Anything
 * unparseable fails closed.
 */
export const isTokenTarget = (config: InternalAxiosRequestConfig): boolean => {
  if (API_ORIGIN === null || isUnparseableUrl(config.url) || isUnparseableUrl(config.baseURL)) {
    return false;
  }
  const resolved = apiClient.getUri(config);
  if (isUnparseableUrl(resolved)) {
    return false;
  }
  const origin = originOf(resolved);
  return origin !== null && origin === API_ORIGIN;
};

declare module 'axios' {
  interface InternalAxiosRequestConfig {
    /** Session epoch in which the bearer token was attached (T-104); unset when none was sent. */
    authSessionEpoch?: number;
  }
  interface AxiosRequestConfig {
    /**
     * Sends this token instead of the stored one (T-114): only for revoking a token the app
     * received but never kept (a login that finished after a logout). Such a request belongs
     * to no session, so its 401/403 never ends or routes the current one. Checked by
     * presence: when the key is set, the stored token is never sent, and anything but a
     * non-empty string sends no Authorization header at all.
     */
    bearerToken?: string | null;
  }
}

/**
 * A 401 from these means "wrong password/code" or "already signed out", never "this session
 * expired", so it must not trigger the session-expired logout (and logout's own 401 must not
 * loop back into it).
 */
const NO_SESSION_EXPIRY_PATHS = [
  '/auth/login',
  '/auth/verify-otp',
  '/auth/send-otp',
  '/auth/register',
  // BE-35: the registration phone step runs before any session exists (T-111).
  '/auth/phone/verify',
  '/auth/phone/resend',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/logout',
  '/auth/logout-all',
];

const isNoSessionExpiryPath = (url?: string): boolean => {
  const path = (url ?? '').split(/[?#]/)[0].replace(/\/+$/, '');
  return NO_SESSION_EXPIRY_PATHS.some(p => path.endsWith(p));
};

/** Returns true when it actually started ending the session (a logout). */
type UnauthorizedHandler = () => boolean;

let unauthorizedHandler: UnauthorizedHandler | null = null;
/**
 * Epoch whose expiry already started a logout: parallel 401s of one session trigger one
 * logout. Set only when the handler started one, and every session start/end bumps the
 * epoch, so a stale value can never swallow a later session's 401.
 */
let reportedExpiredEpoch: number | null = null;

/**
 * Registered by the store: what to do when the server rejects the current session's token
 * (it dispatches the unified logout). Injected so this module never imports the store.
 */
export const setUnauthorizedHandler = (handler: UnauthorizedHandler | null): void => {
  unauthorizedHandler = handler;
};

/** What to do when a request of the current session gets 403 ACCOUNT_* (T-106). */
type AccountRefusedHandler = (error: ApiError) => void;

let accountRefusedHandler: AccountRefusedHandler | null = null;

/**
 * Registered by the store: a 403 ACCOUNT_* (BE-25/BE-32) on any route of the current session
 * means the account is blocked (or still pending); the handler merges that status into the
 * signed-in user so AuthFlow routes to the account-status screen. Injected like the 401
 * handler, so this module never imports the store.
 */
export const setAccountRefusedHandler = (handler: AccountRefusedHandler | null): void => {
  accountRefusedHandler = handler;
};

/** Test-only: forget the handlers and the single-flight latch between test cases. */
export const __resetUnauthorizedStateForTests = (): void => {
  unauthorizedHandler = null;
  accountRefusedHandler = null;
  reportedExpiredEpoch = null;
};

/**
 * BE-25 contract: Sanctum tokens have no refresh token and an expired or revoked token gets
 * 401. So a 401 on a request that carried the current session's token ends the session
 * (single flight); there is no refresh-and-retry after a 401.
 */
const reportUnauthorized = (config?: InternalAxiosRequestConfig): void => {
  const epoch = config?.authSessionEpoch;
  if (epoch === undefined || isStaleSession(epoch) || isNoSessionExpiryPath(config?.url)) {
    return;
  }
  if (reportedExpiredEpoch === epoch) {
    return;
  }
  if (unauthorizedHandler?.() === true) {
    reportedExpiredEpoch = epoch;
  }
};

const isAccountRefusal = (error: ApiError): boolean =>
  error.status === 403 && typeof error.code === 'string' && error.code.startsWith('ACCOUNT_');

/**
 * Only a refusal of a request that carried the current session's token counts. Sign-in and
 * logout paths are skipped: login/verify-otp refusals are shown by their screens, and
 * /auth/logout also answers 403 for a blocked account (the logout thunk clears the local
 * session whatever it answers).
 */
const reportAccountRefused = (error: ApiError, config?: InternalAxiosRequestConfig): void => {
  const epoch = config?.authSessionEpoch;
  if (!isAccountRefusal(error) || epoch === undefined || isStaleSession(epoch) || isNoSessionExpiryPath(config?.url)) {
    return;
  }
  try {
    accountRefusedHandler?.(error);
  } catch (handlerError) {
    logger.warn('Account refusal handler failed', { name: handlerError instanceof Error ? handlerError.name : typeof handlerError });
  }
};

// Request interceptor: adds the bearer token (from the in-memory copy of the Keychain entry)
// only to requests whose resolved URL is on our API origin (isTokenTarget, SEC-21).
apiClient.interceptors.request.use(
  async (config) => {
    if ('bearerToken' in config) {
      // An explicit token (T-114): that one or none, never a fallback to the stored session.
      const bearer = config.bearerToken;
      if (typeof bearer === 'string' && bearer !== '' && isTokenTarget(config)) {
        config.headers.Authorization = `Bearer ${bearer}`;
      } else {
        config.headers.delete('Authorization');
      }
      return config;
    }
    if (!isTokenTarget(config)) {
      return config;
    }
    const epoch = currentSessionEpoch();
    try {
      const token = await authStorage.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        config.authSessionEpoch = epoch;
      }
    } catch (error) {
      logger.warn('Could not read the session token', { name: error instanceof Error ? error.name : typeof error });
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: every failure is normalised to ApiError (src/core/api/errors.ts) so
// callers never parse axios errors themselves; a 401 of the current session ends it, and a
// 403 ACCOUNT_* of the current session routes to account status (T-106).
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error) => {
    if (axios.isCancel(error)) {
      return Promise.reject(toApiError(error));
    }
    const apiError = toApiError(error);
    if (apiError.status === 401 && axios.isAxiosError(error)) {
      reportUnauthorized(error.config);
    }
    if (apiError.status === 403 && axios.isAxiosError(error)) {
      reportAccountRefused(apiError, error.config);
    }
    return Promise.reject(apiError);
  }
);

/** BE-32 account statuses. Only `active` may use the app; see core/auth/normalizeUser. */
export type AccountStatus = 'active' | 'inactive' | 'pending' | 'suspended' | 'rejected';

/** The roles the app knows. Anything else the server sends normalises to `role: null`. */
export type UserRole = 'driver' | 'passenger' | 'admin';

/**
 * A user as the server sends it (login, verify-otp, register, GET /auth/profile, GET /user,
 * GET|PUT /profile). The shapes differ per endpoint (register has `user_type`, the profile
 * has `roles[]`, older builds cached users without `role`), so never store or route on this:
 * pass it through normalizeUser() (core/auth/normalizeUser) to get a User.
 */
export interface ApiUser {
  id: number | string;
  role?: string | null;
  user_type?: string | null;
  roles?: Array<string | { name?: string }> | null;
  status?: string | null;
  [key: string]: unknown;
}

/** The normalised signed-in user (normalizeUser). Routing reads only `role` and `status`. */
export interface User {
  id: number;
  name: string;
  email: string;
  /** BE-35: null until a number is verified; the number waiting for its code is pending_phone. */
  phone: string | null;
  pending_phone?: string | null;
  phone_verified_at?: string | null;
  status: AccountStatus;
  /** BE-32: why the account was rejected or suspended, when the server sends it. */
  rejection_reason?: string | null;
  /** `role ?? user_type ?? roles[0]`, restricted to the roles the app knows. */
  role: UserRole | null;
  roles: string[];
  languages?: string[];
  cnic?: string;
  address?: string;
  country?: string;
  bio?: string;
  gender?: string;
  date_of_birth?: string;
  profile_image_url?: string;
  emergency_contact?: string;
  emergency_contact_name?: string;
  emergency_contact_relation?: string;
  license_number?: string;
  license_type?: string;
  license_expiry_date?: string;
  vehicle_type?: string;
  preferred_payment?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AuthResponse {
  user: ApiUser;
  token: string;
  token_type: string;
  /** BE-25: ISO 8601 idle expiry of the token (slides forward on use); null if none. */
  expires_at?: string | null;
}

/**
 * POST /auth/register 201. BE-35/BE-38: `user` has no id and there is no token; the account
 * proves its phone with `phone_verification.verification_token` (POST /auth/phone/verify),
 * which returns the token. A backend from before BE-35 instead sends a user with an id and
 * `token` (null for a driver pending approval) and no phone_verification.
 */
export interface RegisterResponse {
  user: Record<string, unknown>;
  phone_verification?: RegistrationPhoneVerification;
  token?: string | null;
  token_type?: string | null;
  expires_at?: string | null;
}

/**
 * register's `phone_verification` (BE-35). `code_sent: false` means no code went out yet and
 * carries the BE-28 refusal `code`, `message` and `retry_after`. The verification_token is a
 * bearer secret for the phone step: memory only, never stored or logged.
 */
export interface RegistrationPhoneVerification {
  phone: string;
  code_sent: boolean;
  expires_in: number;
  verification_token: string;
  verification_token_expires_in?: number;
  code?: string;
  message?: string;
  retry_after?: number;
  otp_code?: string | null;
}

/** POST /auth/send-otp (BE-16): otp_code is null outside APP_ENV=local; expires_in is seconds. */
export interface SendOtpResponse {
  phone: string;
  otp_code?: string | null;
  expires_in: number;
}

/** What the app keeps after send-otp: never the code itself (AUTH-02, INF-05). */
export type OtpSentInfo = Pick<SendOtpResponse, 'phone' | 'expires_in'> & {
  /** The server's send message (BE-27: the same for known and unknown numbers). */
  message?: string;
};

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

/** POST /auth/register as multipart (registerWithImages): images are local file URIs. */
export type RegisterWithImagesRequest = RegisterRequest & {
  passenger_cnic_front_image?: string;
  passenger_cnic_back_image?: string;
  passenger_profile_image?: string;
  passenger_preferred_payment?: 'cash' | 'card' | 'mobile_wallet';
  passenger_emergency_contact?: string;
  passenger_emergency_contact_name?: string;
  passenger_emergency_contact_relation?: string;
};

export interface SendOtpRequest {
  phone: string;
}

export interface VerifyOtpRequest {
  phone: string;
  otp_code: string;
}

/** POST /auth/phone/verify (BE-35/BE-38): the registration's verification_token and the code. */
export interface VerifyPhoneRequest {
  verification_token: string;
  otp_code: string;
}

/** POST /auth/phone/resend (BE-35). */
export interface ResendPhoneCodeRequest {
  verification_token: string;
}

/**
 * POST /auth/phone/verify 200 (BE-38). `user` is `{id, name, email, role, roles, phone,
 * phone_verified_at, status}`. `token` (and token_type, expires_at) is null when the account
 * may not sign in yet (a driver pending approval).
 */
export interface VerifyPhoneResponse {
  user: ApiUser;
  token: string | null;
  token_type: string | null;
  expires_at?: string | null;
}

/**
 * POST /auth/phone/resend 200 and registration's `phone_verification` (BE-35). A refused
 * send comes as 429/503 from resend; on registration it is `code_sent: false` with the BE-28
 * `code`, `message` and `retry_after`. `otp_code` is echoed only by APP_ENV=local + debug.
 */
export interface PhoneCodeSentResponse {
  phone: string;
  code_sent: boolean;
  expires_in: number;
  otp_code?: string | null;
  code?: string;
  message?: string;
  retry_after?: number;
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
      logApiFailure('ApiService#register failed', error);
      throw error;
    }
  }

  // Alternative registration method using /users endpoint with multipart/form-data
  async registerWithImages(userData: RegisterWithImagesRequest): Promise<ApiResponse<RegisterResponse>> {
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
      logApiFailure('ApiService#registerWithImages failed', error);
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
      logApiFailure('ApiService#sendOtp failed', error);
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
      logApiFailure('ApiService#verifyOtp failed', error);
      throw error;
    }
  }

  /**
   * BE-35/BE-38: proves a new account's phone with the registration verification_token.
   * The token is a credential for this step: it is never logged or stored (memory only).
   */
  async verifyPhone(request: VerifyPhoneRequest): Promise<ApiResponse<VerifyPhoneResponse>> {
    try {
      const response = await apiClient.post('/auth/phone/verify', request);
      return response.data;
    } catch (err: unknown) {
      const error = toApiError(err);
      logApiFailure('ApiService#verifyPhone failed', error);
      throw error;
    }
  }

  /** BE-35: texts a new code for the registration's pending phone. */
  async resendPhoneCode(request: ResendPhoneCodeRequest): Promise<ApiResponse<PhoneCodeSentResponse>> {
    try {
      const response = await apiClient.post('/auth/phone/resend', request);
      return response.data;
    } catch (err: unknown) {
      const error = toApiError(err);
      logApiFailure('ApiService#resendPhoneCode failed', error);
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

  async logout(config?: AxiosRequestConfig): Promise<ApiResponse> {
    const response = await apiClient.post('/auth/logout', undefined, config);
    return response.data;
  }

  /** Revokes `token` (POST /auth/logout with exactly that token), not the stored session's. */
  async revokeToken(token: string, config?: AxiosRequestConfig): Promise<ApiResponse> {
    return this.logout({ ...config, bearerToken: token });
  }

  async logoutAll(config?: AxiosRequestConfig): Promise<ApiResponse> {
    const response = await apiClient.post('/auth/logout-all', undefined, config);
    return response.data;
  }

  // User Profile Methods
  async getProfile(): Promise<ApiResponse<{ user: ApiUser }>> {
    const response = await apiClient.get('/auth/profile');
    return response.data;
  }

  // PUT /profile (there is no PUT /auth/profile). BE-29: data is the owner's profile (the same
  // shape as GET /auth/profile, with `role`, `roles[]` and `languages[]`), not wrapped in
  // `{ user }`; callers pass it through normalizeUser. A new phone waits in pending_phone (BE-35).
  async updateProfile(userData: Partial<User>): Promise<ApiResponse<ApiUser>> {
    const response = await apiClient.put('/profile', userData);
    return response.data;
  }

  // Test Authentication
  async testAuth(): Promise<ApiResponse<{ user: ApiUser }>> {
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

  // Session storage (src/services/authStorage.ts): the token is in the Keychain/Keystore,
  // the cached user in AsyncStorage without sensitive fields (T-104).
  async getAuthToken(): Promise<string | null> {
    return authStorage.getToken();
  }

  async clearAuthData(): Promise<void> {
    await authStorage.clear();
  }

  async getUserData(): Promise<User | null> {
    return authStorage.getUser();
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
