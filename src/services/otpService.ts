import type { VerifyOtpRequest } from './api';

/** The backend issues and accepts exactly 6-digit codes (verify-otp: otp_code size:6). */
export const OTP_LENGTH = 6;

/**
 * Keeps only the digits of typed, pasted or SMS-autofilled text ("123 456", "123-456",
 * "Your code is 123456") and caps it at OTP_LENGTH.
 */
export const sanitizeOtpInput = (text: string): string =>
  (text || '').replace(/\D/g, '').slice(0, OTP_LENGTH);

/** Whole seconds left until `deadlineMs` (never negative). */
export const secondsUntil = (deadlineMs: number | null, nowMs: number): number =>
  deadlineMs == null ? 0 : Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));

/** 59 -> "59s", 125 -> "2:05", 3700 -> "1:01:40". */
export const formatCountdown = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`;
};

/**
 * Phone and code validation for the OTP screens. Sending and verifying codes go through the
 * apiThunks sendOtp/verifyOtp (which never keep the code); the old sendOtp/verifyOtp here
 * returned the server's raw response, including a local otp_code echo (T-107).
 */
export class OtpService {
  /**
   * Validate phone number format
   */
  static validatePhoneNumber(phone: string): { isValid: boolean; error?: string } {
    if (!phone || phone.trim().length === 0) {
      return { isValid: false, error: 'Phone number is required' };
    }

    // Enforce Pakistani E.164: +92XXXXXXXXXX (10 digits after +92)
    const pkRegex = /^\+92\d{10}$/;
    if (!pkRegex.test(phone)) {
      return { isValid: false, error: 'Phone must be in +92XXXXXXXXXX format' };
    }
    return { isValid: true };
  }

  /**
   * Validate OTP data
   */
  static validateOtpData(otpData: VerifyOtpRequest): { isValid: boolean; error?: string } {
    if (!otpData.phone || otpData.phone.trim().length === 0) {
      return { isValid: false, error: 'Phone number is required' };
    }

    const phoneCheck = this.validatePhoneNumber(otpData.phone.trim());
    if (!phoneCheck.isValid) {
      return { isValid: false, error: phoneCheck.error };
    }

    const otpCode = sanitizeOtpInput(otpData.otp_code);
    if (otpCode.length === 0) {
      return { isValid: false, error: 'OTP code is required' };
    }

    if (otpCode.length !== OTP_LENGTH) {
      return { isValid: false, error: `OTP code must be ${OTP_LENGTH} digits` };
    }

    return { isValid: true };
  }

  /**
   * Format phone number for display
   */
  static formatPhoneNumber(phone: string): string {
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Prefer returning +92XXXXXXXXXX when possible
    if (cleanPhone.startsWith('92') && cleanPhone.length === 12) {
      return `+${cleanPhone}`;
    }
    if (cleanPhone.length === 11 && cleanPhone.startsWith('03')) {
      // 03XXXXXXXXX -> +92XXXXXXXXXX
      return `+92${cleanPhone.slice(1)}`;
    }
    return phone;
  }

  /**
   * Generate OTP input mask for better UX
   */
  static getOtpInputMask(length: number = 6): string {
    return '0'.repeat(length);
  }

  /**
   * Check if OTP is expired based on timestamp
   */
  static isOtpExpired(expiresIn: number, sentAt: Date): boolean {
    const now = new Date();
    const expirationTime = new Date(sentAt.getTime() + (expiresIn * 1000));
    return now > expirationTime;
  }

  /**
   * Get remaining time for OTP expiration
   */
  static getRemainingTime(expiresIn: number, sentAt: Date): number {
    const now = new Date();
    const expirationTime = new Date(sentAt.getTime() + (expiresIn * 1000));
    const remaining = Math.max(0, Math.floor((expirationTime.getTime() - now.getTime()) / 1000));
    return remaining;
  }

  /**
   * Normalize various Pakistani inputs to +92XXXXXXXXXX
   */
  static normalizePakistanPhone(phone: string): { success: boolean; phone?: string; error?: string } {
    if (!phone) return { success: false, error: 'Phone number is required' };
    const trimmed = phone.trim();
    // Already correct
    if (/^\+92\d{10}$/.test(trimmed)) return { success: true, phone: trimmed };
    // 03XXXXXXXXX -> +92XXXXXXXXXX
    const onlyDigits = trimmed.replace(/\D/g, '');
    if (/^03\d{9}$/.test(onlyDigits)) {
      return { success: true, phone: `+92${onlyDigits.slice(1)}` };
    }
    // 92XXXXXXXXXX -> +92XXXXXXXXXX
    if (/^92\d{10}$/.test(onlyDigits)) {
      return { success: true, phone: `+${onlyDigits}` };
    }
    // Fallback: reject
    return { success: false, error: 'Please enter phone as +92XXXXXXXXXX' };
  }
}

export default OtpService;
