import { apiService, VerifyOtpRequest } from './api';

// OTP Service for handling phone verification operations
export class OtpService {
  /**
   * Send OTP to phone number with enhanced logging
   */
  static async sendOtp(phone: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log('🔐 OTP Service - Initiating OTP send process');
      console.log('📱 Target phone:', phone);
      console.log('⏰ Service timestamp:', new Date().toISOString());
      
      // Validate phone number format
      const validation = this.validatePhoneNumber(phone);
      if (!validation.isValid) {
        console.log('❌ OTP Service - Phone validation failed:', validation.error);
        return { success: false, error: validation.error };
      }
      
      console.log('✅ OTP Service - Phone validation passed');
      
      // Call API service
      const response = await apiService.sendOtp(phone);
      
      if (response.success && response.data) {
        console.log('✅ OTP Service - OTP sent successfully via API');
        console.log('📊 OTP details:', {
          phone: response.data.phone,
          expires_in: response.data.expires_in,
          has_otp_code: !!response.data.otp_code
        });
        
        return { success: true, data: response.data };
      } else {
        console.log('❌ OTP Service - API returned failure:', response.message);
        return { success: false, error: response.message || 'Failed to send OTP' };
      }
    } catch (error: any) {
      console.error('💥 OTP Service - Send OTP error:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to send OTP' 
      };
    }
  }

  /**
   * Verify OTP code with enhanced logging
   */
  static async verifyOtp(otpData: VerifyOtpRequest): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log('🔐 OTP Service - Initiating OTP verification process');
      console.log('📋 OTP data:', {
        phone: otpData.phone,
        otp_code: otpData.otp_code ? '***' + otpData.otp_code.slice(-2) : 'undefined'
      });
      console.log('⏰ Service timestamp:', new Date().toISOString());
      
      // Validate OTP data
      const validation = this.validateOtpData(otpData);
      if (!validation.isValid) {
        console.log('❌ OTP Service - OTP validation failed:', validation.error);
        return { success: false, error: validation.error };
      }
      
      console.log('✅ OTP Service - OTP data validation passed');
      
      // Call API service
      const response = await apiService.verifyOtp(otpData);
      
      if (response.success && response.data) {
        console.log('✅ OTP Service - OTP verification successful via API');
        console.log('👤 User details:', {
          name: response.data.user?.name,
          phone: response.data.user?.phone,
          role: response.data.user?.role,
          status: response.data.user?.status
        });
        console.log('🔑 Auth details:', {
          has_token: !!response.data.token,
          token_type: response.data.token_type
        });
        
        return { success: true, data: response.data };
      } else {
        console.log('❌ OTP Service - API returned verification failure:', response.message);
        return { success: false, error: response.message || 'OTP verification failed' };
      }
    } catch (error: any) {
      console.error('💥 OTP Service - Verify OTP error:', error);
      return { 
        success: false, 
        error: error.message || 'OTP verification failed' 
      };
    }
  }

  /**
   * Validate phone number format
   */
  static validatePhoneNumber(phone: string): { isValid: boolean; error?: string } {
    if (!phone || phone.trim().length === 0) {
      return { isValid: false, error: 'Phone number is required' };
    }

    // Remove all non-digit characters for validation
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Check if phone number has reasonable length (7-15 digits)
    if (cleanPhone.length < 7 || cleanPhone.length > 15) {
      return { isValid: false, error: 'Phone number must be between 7 and 15 digits' };
    }

    // Check if phone starts with valid country code or local number
    if (cleanPhone.length < 10) {
      return { isValid: false, error: 'Phone number too short' };
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

    if (!otpData.otp_code || otpData.otp_code.trim().length === 0) {
      return { isValid: false, error: 'OTP code is required' };
    }

    // Check OTP code format (typically 4-6 digits)
    const otpCode = otpData.otp_code.trim();
    if (!/^\d{4,6}$/.test(otpCode)) {
      return { isValid: false, error: 'OTP code must be 4-6 digits' };
    }

    return { isValid: true };
  }

  /**
   * Format phone number for display
   */
  static formatPhoneNumber(phone: string): string {
    const cleanPhone = phone.replace(/\D/g, '');
    
    if (cleanPhone.length === 10) {
      // Format as (XXX) XXX-XXXX
      return `(${cleanPhone.slice(0, 3)}) ${cleanPhone.slice(3, 6)}-${cleanPhone.slice(6)}`;
    } else if (cleanPhone.length === 11 && cleanPhone.startsWith('1')) {
      // Format as +1 (XXX) XXX-XXXX
      return `+1 (${cleanPhone.slice(1, 4)}) ${cleanPhone.slice(4, 7)}-${cleanPhone.slice(7)}`;
    }
    
    return phone; // Return original if can't format
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
}

export default OtpService;
