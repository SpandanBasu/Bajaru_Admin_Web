/**
 * Public API client for unauthenticated endpoints (/auth/*).
 * No Bearer token — no interceptors beyond base URL and JSON headers.
 */
import axios from "axios";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL as string,
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  timeout: 15_000,
});

// ── Response types ────────────────────────────────────────────────────────────

/** Wrapped success envelope used by most admin endpoints. */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp?: string;
}

/** Paged collection embedded inside ApiResponse.data. */
export interface PagedResult<T> {
  content: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

/** Raw (non-wrapped) auth response returned by /auth/sms/verify and /auth/truecaller. */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: AuthUserProfile;
  isNewUser: boolean;
}

export interface AuthUserProfile {
  userId: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePictureUrl: string;
  role: string;
}

/** Data nested inside the OTP-send success envelope. */
export interface OtpSendData {
  message: string;
  nextResendAfterSeconds: number;
  otpSendCount: number;
}

// ── Auth API calls ─────────────────────────────────────────────────────────────

/** POST /auth/sms/otp — returns `data.nextResendAfterSeconds` to drive the timer. */
export async function sendOtp(phoneNumber: string): Promise<OtpSendData> {
  const res = await apiClient.post<ApiResponse<OtpSendData>>("/auth/sms/otp", {
    phoneNumber,
    role: "ADMIN",
  });
  return res.data.data;
}

/** POST /auth/sms/verify — returns the raw AuthResponse (no envelope). */
export async function verifyOtp(
  phoneNumber: string,
  otp: string,
): Promise<AuthResponse> {
  const res = await apiClient.post<AuthResponse>("/auth/sms/verify", {
    phoneNumber,
    otp,
    role: "ADMIN",
  });
  return res.data;
}

export default apiClient;
