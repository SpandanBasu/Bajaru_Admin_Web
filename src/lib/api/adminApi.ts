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
  scheduleTokenRefresh(state.expiresAt); // keep session alive automatically
}

export function clearTokens() {
  if (_refreshTimer) { clearTimeout(_refreshTimer); _refreshTimer = null; }
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
let _refreshTimer: ReturnType<typeof setTimeout> | null = null;

/** Called by sign-out / forced logout (clears local state, no API call needed if tokens gone). */
export let onLogout: (() => void) | null = null;
export function setLogoutHandler(fn: () => void) {
  onLogout = fn;
}

/**
 * Schedule a background token refresh 3 minutes before the access token expires.
 * This runs even when the user is completely idle — no API call needed to trigger it.
 * Reschedules itself automatically after each successful refresh.
 */
export function scheduleTokenRefresh(expiresAt: number) {
  if (_refreshTimer) clearTimeout(_refreshTimer);
  const msUntilRefresh = Math.max(0, expiresAt - Date.now() - 3 * 60 * 1000);
  _refreshTimer = setTimeout(async () => {
    _refreshTimer = null;
    const ok = await refreshOnce();
    if (ok && _tokens) {
      scheduleTokenRefresh(_tokens.expiresAt); // reschedule for the new token
    }
    // If refresh fails, the reactive 401 interceptor handles the next request
  }, msUntilRefresh);
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
  if (!isNearExpiry()) {
    // Token is still valid — start the background refresh timer
    scheduleTokenRefresh(_tokens.expiresAt);
    return true;
  }
  // Expired or near expiry — refresh immediately
  const ok = await doRefresh(); // setTokens inside doRefresh will schedule the next timer
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

// Warehouses

export interface Warehouse {
  warehouseId: string;
  displayName: string;
  city: string;
  servicePincodes: string[];
  active: boolean;
}

export async function getWarehouses(): Promise<Warehouse[]> {
  const res = await adminApi.get<ApiResponse<Warehouse[]>>("/admin/warehouses");
  return res.data.data;
}

// Products — Catalog (MongoDB metadata via /market/admin/products)

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
  imageUrls: string[];
  imageColorValue: number;
  tags: string[];
  searchTags: string[];
  rating: number;
  ratingCount: number;
  attributes: Record<string, unknown>;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductPayload {
  /** Optional human-readable ID (e.g. "veg_coriander_leaves"). Auto-generated if omitted. */
  id?: string;
  name: string;
  localName?: string;
  description?: string;
  type?: string;
  category?: string;
  isVeg?: boolean;
  unitWeight?: string;
  basePrice?: number;
  imageUrls?: string[];
  imageColorValue?: number;
  tags?: string[];
  searchTags?: string[];
  attributes?: Record<string, unknown>;
  rating?: number;
  ratingCount?: number;
}

/** Full catalog + live pricing detail for a single product (customer-facing DTO). */
export interface ProductDetail {
  id: string;
  name: string;
  localName: string;
  description: string;
  type: string;
  category: string;
  isVeg: boolean;
  unitWeight: string;
  basePrice: number;
  oldPrice: number;       // MRP from inventory
  newPrice: number;       // selling price from inventory
  imageUrls: string[];
  imageColorValue: number;
  tags: string[];
  rating: number;
  ratingCount: number;
  inStock: boolean;
  stockQuantity: number;
  attributes: Record<string, unknown>;
  createdAt: string | null;
}

/**
 * Fetch full catalog data for a single product.
 * Uses the public market endpoint (pincode required for inventory join).
 * Pincode should be any pincode served by the admin's selected warehouse.
 */
export async function getProductById(id: string, pincode: string): Promise<ProductDetail> {
  const res = await adminApi.get<ApiResponse<ProductDetail>>(
    `/market/products/${id}`,
    { params: { pincode } },
  );
  return res.data.data;
}

/**
 * Returns true if a product with the given ID already exists in the catalog.
 * Uses the public product endpoint — a 404 means the ID is free; anything else means taken.
 */
export async function checkProductIdExists(id: string, pincode: string): Promise<boolean> {
  try {
    await getProductById(id, pincode);
    return true; // product found → ID is taken
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "response" in err &&
      (err as { response?: { status?: number } }).response?.status === 404
    ) {
      return false; // 404 → ID is free
    }
    throw err; // network error or unexpected status — bubble up
  }
}

export async function createProduct(payload: CreateProductPayload): Promise<AdminProduct> {
  const res = await adminApi.post<ApiResponse<AdminProduct>>(
    "/market/admin/products",
    payload,
  );
  return res.data.data;
}

export async function updateProduct(
  id: string,
  payload: Partial<CreateProductPayload>,
): Promise<AdminProduct> {
  const res = await adminApi.put<ApiResponse<AdminProduct>>(
    `/market/admin/products/${id}`,
    payload,
  );
  return res.data.data;
}

export async function toggleProductActive(id: string): Promise<AdminProduct> {
  const res = await adminApi.patch<ApiResponse<AdminProduct>>(
    `/market/admin/products/${id}/toggle`,
  );
  return res.data.data;
}

// Products — Inventory (PostgreSQL stock + pricing per warehouse via /inventory/admin)

export interface WarehouseInventoryItem {
  productId: string;
  name: string;
  localName?: string;
  category: string;
  unitWeight: string;
  imageUrls: string[];
  active: boolean;
  quantityAvailable: number;
  mrp: number;
  sellingPrice: number;
  warehouseId: string;
}

interface AdminWarehousePage {
  content: WarehouseInventoryItem[];
  hasMore: boolean;
  nextCursor: string | null;
}

/** Fetches all inventory entries for a warehouse, following cursor pagination internally. */
export async function getInventoryByWarehouse(warehouseId: string): Promise<WarehouseInventoryItem[]> {
  const all: WarehouseInventoryItem[] = [];
  let cursor: string | null = null;

  do {
    const params: Record<string, string | number> = { warehouseId, size: 200 };
    if (cursor) params.cursor = cursor;

    const res = await adminApi.get<ApiResponse<AdminWarehousePage>>(
      "/inventory/admin/by-warehouse",
      { params },
    );
    const page = res.data.data;
    all.push(...page.content);
    cursor = page.hasMore ? page.nextCursor : null;
  } while (cursor);

  return all;
}

export interface UpsertInventoryPayload {
  productId: string;
  warehouseId: string;
  quantity: number;
  mrp: number;
  sellingPrice: number;
}

export async function upsertInventory(payload: UpsertInventoryPayload): Promise<void> {
  await adminApi.post("/inventory/admin/upsert", payload);
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
