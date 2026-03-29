/**
 * Protected API client for all /admin/* endpoints.
 *
 * Features:
 * - Attaches Bearer token from tokenStore on every request
 * - Proactive refresh when token expires within 2 minutes
 * - Reactive 401/403 retry: queues concurrent requests, refreshes once, replays
 * - In-flight dedup so only one refresh HTTP call runs at a time
 * - POST /auth/logout on sign-out (X-Refresh-Token header)
 */
import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
  type AxiosResponse,
} from "axios";
import type { AuthResponse, ApiResponse, PagedResult } from "./apiClient";

// ── Token store (persisted to localStorage) ───────────────────────────────────

interface TokenState {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // ms epoch
}

const TOKEN_KEY = "bajaru_tokens";

let _tokens: TokenState | null = (() => {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as TokenState) : null;
  } catch {
    return null;
  }
})();

export function setTokens(state: TokenState) {
  _tokens = state;
  localStorage.setItem(TOKEN_KEY, JSON.stringify(state));
}

export function clearTokens() {
  _tokens = null;
  localStorage.removeItem(TOKEN_KEY);
}

export function getTokens(): TokenState | null {
  return _tokens;
}

function isNearExpiry(): boolean {
  if (!_tokens) return false;
  return Date.now() >= _tokens.expiresAt - 2 * 60 * 1000; // 2-min window
}

// ── Axios instance ────────────────────────────────────────────────────────────

const adminApi: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL as string,
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  timeout: 15_000,
});

// ── Refresh state ─────────────────────────────────────────────────────────────

let _refreshPromise: Promise<boolean> | null = null;

/** Called by sign-out / forced logout (clears local state, no API call needed if tokens gone). */
export let onLogout: (() => void) | null = null;
export function setLogoutHandler(fn: () => void) {
  onLogout = fn;
}

async function doRefresh(): Promise<boolean> {
  if (!_tokens?.refreshToken) return false;
  try {
    const res = await axios.post<AuthResponse>(
      `${import.meta.env.VITE_API_BASE_URL}/auth/refresh`,
      {},
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Refresh-Token": _tokens.refreshToken,
        },
        timeout: 15_000,
      },
    );
    const { accessToken, refreshToken, expiresIn } = res.data;
    if (!accessToken || !refreshToken) return false;
    setTokens({
      accessToken,
      refreshToken,
      expiresAt: Date.now() + expiresIn * 1000,
    });
    return true;
  } catch {
    return false;
  }
}

/** Deduplicated refresh — only one HTTP call runs at a time. */
function refreshOnce(): Promise<boolean> {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = doRefresh().finally(() => {
    _refreshPromise = null;
  });
  return _refreshPromise;
}

// ── Request interceptor — attach Bearer, proactive refresh ────────────────────

adminApi.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  if (!_tokens) return config;

  if (isNearExpiry()) {
    await refreshOnce();
  }

  if (_tokens?.accessToken) {
    config.headers["Authorization"] = `Bearer ${_tokens.accessToken}`;
  }
  return config;
});

// ── Response interceptor — reactive refresh on 401/403 ───────────────────────

adminApi.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const status = error.response?.status;
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retried?: boolean };

    if ((status === 401 || status === 403) && !originalRequest._retried && _tokens) {
      originalRequest._retried = true;
      const ok = await refreshOnce();
      if (ok && _tokens?.accessToken) {
        originalRequest.headers["Authorization"] = `Bearer ${_tokens.accessToken}`;
        return adminApi(originalRequest);
      }
      // Refresh failed — force logout
      clearTokens();
      onLogout?.();
    }
    return Promise.reject(error);
  },
);

// ── Sign out ──────────────────────────────────────────────────────────────────

export async function logout(refreshToken: string): Promise<void> {
  try {
    await axios.post(
      `${import.meta.env.VITE_API_BASE_URL}/auth/logout`,
      {},
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: _tokens?.accessToken ? `Bearer ${_tokens.accessToken}` : "",
          "X-Refresh-Token": refreshToken,
        },
        timeout: 10_000,
      },
    );
  } catch {
    // Best-effort — always clear locally regardless
  } finally {
    clearTokens();
  }
}

// ── Session restore (called on app startup) ───────────────────────────────────

/**
 * Returns true if a valid session exists (or was successfully refreshed).
 * Returns false if tokens are absent or the refresh call failed.
 */
export async function tryRestoreSession(): Promise<boolean> {
  if (!_tokens?.refreshToken) return false;
  // Token still has more than 2 minutes left — no refresh needed
  if (!isNearExpiry()) return true;
  // Expired or near expiry — try refresh
  const ok = await doRefresh();
  if (!ok) clearTokens();
  return ok;
}

// ── Admin endpoints ───────────────────────────────────────────────────────────

// Dashboard

export interface DashboardStats {
  ordersToday: number;
  activeRiders: number;
  activeDeliveries: number;
  revenueToday: number;
  pendingPacking: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await adminApi.get<ApiResponse<DashboardStats>>("/admin/dashboard/stats");
  return res.data.data;
}

// Products

export interface AdminProduct {
  id: string;
  name: string;
  localName: string;
  description: string;
  type: string;
  category: string;
  isVeg: boolean;
  unitWeight: string;
  basePrice: number;
  price: number;
  imageUrls: string[];
  imageUrl: string;
  imageColorValue: number;
  tags: string[];
  searchTags: string[];
  rating: number;
  ratingCount: number;
  attributes: Record<string, string>;
  active: boolean;
  stock: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductFilter {
  q?: string;
  category?: string;
  active?: boolean;
  page?: number;
  size?: number;
}

export async function getProducts(filter: ProductFilter = {}): Promise<PagedResult<AdminProduct>> {
  const res = await adminApi.get<ApiResponse<PagedResult<AdminProduct>>>(
    "/admin/inventory/products",
    { params: { page: 0, size: 50, ...filter } },
  );
  return res.data.data;
}

export interface CreateProductPayload {
  name: string;
  localName?: string;
  description?: string;
  type: string;
  category: string;
  isVeg: boolean;
  unitWeight: string;
  basePrice: number;
  price: number;
  imageUrls?: string[];
  imageColorValue?: number;
  tags?: string[];
  searchTags?: string[];
  attributes?: Record<string, string>;
}

export async function createProduct(payload: CreateProductPayload): Promise<AdminProduct> {
  const res = await adminApi.post<ApiResponse<AdminProduct>>(
    "/admin/inventory/products",
    payload,
  );
  return res.data.data;
}

export async function updateProduct(
  id: string,
  payload: Partial<CreateProductPayload>,
): Promise<AdminProduct> {
  const res = await adminApi.put<ApiResponse<AdminProduct>>(
    `/admin/inventory/products/${id}`,
    payload,
  );
  return res.data.data;
}

export async function toggleProductActive(id: string, active: boolean): Promise<void> {
  await adminApi.patch(`/admin/inventory/products/${id}/active`, { active });
}

// Procurement

export interface ProcurementOrderItem {
  id: string;
  productId: string;
  warehouseId: string;
  name: string;
  quantity: number;
  unit: string;
  imageUrl: string;
  date: string;
  status: "Pending" | "Received";
}

export async function getProcurementItems(): Promise<ProcurementOrderItem[]> {
  const res = await adminApi.get<ApiResponse<ProcurementOrderItem[]>>(
    "/admin/procurement/items",
  );
  return res.data.data;
}

export async function markProcurementReceived(
  productId: string,
  warehouseId: string,
): Promise<void> {
  await adminApi.patch(
    `/admin/procurement/items/${productId}/${warehouseId}/status`,
    { status: "Received" },
  );
}

export default adminApi;
