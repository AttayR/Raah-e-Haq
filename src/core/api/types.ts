/**
 * Shapes of the Laravel API envelope (see docs/api/CONTRACT_NOTES.md).
 *
 * Success:   { success: true, message?, data, pagination? }
 * Failure A: { success: false, message, errors?, retry_after? }   (auth, role middleware, nearby-drivers, OTP 429)
 * Failure B: { success: false, error: { code, message, details } } (rides, websocket, notifications)
 * Laravel:   { message, errors? }                                  (framework validation, 401, 404, 429 throttle)
 */

export type FieldErrors = Record<string, string[]>;

export interface Pagination {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface ApiErrorDetail {
  code?: string;
  message?: string;
  details?: FieldErrors | string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  pagination?: Pagination;
  errors?: FieldErrors;
  error?: ApiErrorDetail;
  retry_after?: number;
}
