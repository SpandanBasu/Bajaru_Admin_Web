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

/**
 * "ok"           – refresh succeeded, new tokens stored.
 * "auth-error"   – server rejected the token (4xx) or token missing → clear tokens.
 * "network-error"– CORS block, timeout, server unreachable → tokens still valid,
 *                  keep them so the next page-load can retry.
 */
type RefreshResult = "ok" | "auth-error" | "network-error";

let _refreshPromise: Promise<RefreshResult> | null = null;
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
    const result = await refreshOnce();
    if (result === "ok" && _tokens) {
      scheduleTokenRefresh(_tokens.expiresAt); // reschedule for the new token
    }
    // On failure the reactive 401 interceptor handles the next request
  }, msUntilRefresh);
}

async function doRefresh(): Promise<RefreshResult> {
  if (!_tokens?.refreshToken) return "auth-error";
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
    if (!accessToken || !refreshToken) return "auth-error";
    setTokens({
      accessToken,
      refreshToken,
      expiresAt: Date.now() + expiresIn * 1000,
    });
    return "ok";
  } catch (err) {
    // Server responded with an explicit error (401/403/400/500) → token is invalid.
    if (axios.isAxiosError(err) && err.response) return "auth-error";
    // No response at all: CORS preflight blocked, network down, timeout.
    // The refresh token is still potentially valid — preserve it.
    return "network-error";
  }
}

/** Deduplicated refresh — only one HTTP call runs at a time. */
function refreshOnce(): Promise<RefreshResult> {
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
      const result = await refreshOnce();
      if (result === "ok" && _tokens?.accessToken) {
        originalRequest.headers["Authorization"] = `Bearer ${_tokens.accessToken}`;
        return adminApi(originalRequest);
      }
      if (result === "auth-error") {
        // Server explicitly rejected the refresh token — session is unrecoverable
        clearTokens();
        onLogout?.();
      }
      // "network-error": keep tokens, just fail this request (user sees a toast/error)
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
  const result = await doRefresh(); // setTokens inside doRefresh schedules the next timer
  if (result === "auth-error") {
    // Server explicitly rejected the token (revoked / expired) — clear it
    clearTokens();
  }
  // "network-error": keep tokens in localStorage so the next page-load can retry
  return result === "ok";
}

// ── Admin endpoints ───────────────────────────────────────────────────────────

// Dashboard

export interface DashboardRecentDelivery {
  orderId: string;
  customerName: string;
  address: string;
  amount: number;
  completedAt: string;
}

export interface DashboardOverview {
  totalOrders: number;
  totalRevenue: number;
  pendingItems: number;
  availableRiders: number;
  completedDeliveries: number;
  currentPhase: string;
  recentDeliveries: DashboardRecentDelivery[];
}

export async function getDashboardStats(): Promise<DashboardOverview> {
  const res = await adminApi.get<ApiResponse<DashboardOverview>>("/admin/dashboard/stats");
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

export async function toggleInventoryAvailability(
  productId: string,
  warehouseId: string,
): Promise<boolean> {
  const res = await adminApi.patch<ApiResponse<{ active: boolean }>>(
    `/inventory/admin/${productId}/${warehouseId}/toggle`,
  );
  return res.data.data.active ?? false;
}

/**
 * Fetch a single product from the admin catalog endpoint.
 * Unlike getProductById (public market endpoint), this returns the product
 * regardless of its active status — safe to use for inactive products.
 */
export async function getAdminProductById(id: string): Promise<AdminProduct> {
  const res = await adminApi.get<ApiResponse<AdminProduct>>(
    `/market/admin/products/${id}`,
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

/**
 * Normalizes a raw by-warehouse API response item to guaranteed TypeScript types.
 *
 * Why this exists: the backend occasionally returns booleans as integers (0/1) and
 * numbers as strings depending on the ORM version and DB driver configuration in
 * each environment. Normalizing here — at the HTTP boundary — means everything
 * upstream in the application can trust the types and never needs defensive casts.
 */
function parseInventoryItem(item: WarehouseInventoryItem): WarehouseInventoryItem {
  return {
    ...item,
    active: Boolean(item.active),
    quantityAvailable: Number(item.quantityAvailable) || 0,
    mrp: Number(item.mrp) || 0,
    sellingPrice: Number(item.sellingPrice) || 0,
    imageUrls: Array.isArray(item.imageUrls) ? item.imageUrls : [],
  };
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
    all.push(...page.content.map(parseInventoryItem));
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

export interface ProcurementLine {
  id: string;
  productId: string;
  name: string;
  unit: string;
  unitWeight: string;
  orderCount: number;
  neededToday: number;
  warehouseId: string;
  status: string;
}

export interface ProcurementSummary {
  totalInStock: number;
  totalNeeded: number;
  totalToProcure: number;
  itemCount: number;
  orderCount: number;
  items: ProcurementLine[];
}

export async function getProcurementItems(): Promise<ProcurementSummary> {
  const res = await adminApi.get<ApiResponse<ProcurementSummary>>(
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

// Orders — Deliveries

export interface AdminDeliveryListItem {
  id: string;
  customerName: string;
  phone: string;
  area: string;
  pincode: string;
  itemCount: number;
  amount: number;
  deliveryFee: number;
  bagCharge: number;
  finalTotal: number;
  isCOD: boolean;
  status: string;
  riderId: string | null;
  riderName: string | null;
  placedAt: string;
}

export interface AdminDeliveryItem {
  id: string;
  name: string;
  unitWeight: string;
  quantity: number;
  price: number;
}

export interface AdminDeliveryDetail {
  id: string;
  customerId: string;
  customerName: string;
  phone: string;
  fullAddress: string;
  area: string;
  pincode: string;
  addressLatitude: number | null;
  addressLongitude: number | null;
  items: AdminDeliveryItem[];
  subTotal: number;
  deliveryFee: number;
  bagCharge: number;
  couponDiscount: number;
  couponCode: string | null;
  finalTotal: number;
  isCOD: boolean;
  paymentType: string;
  status: string;
  placedAt: string;
  deliveredAt: string | null;
  riderId: string | null;
  riderName: string | null;
  riderPhone: string | null;
  departedAt: string | null;
  deliveryMinutes: number | null;
  distanceKm: number | null;
  proofImageUrl: string | null;
  rejectionReason: string | null;
  rejectedAt: string | null;
  deliveryDate: string | null;
  refundStatus: string | null;
  refundAmount: number | null;
  refundInitiatedAt: string | null;
  refundCompletedAt: string | null;
}

export interface AdminRatingItem {
  orderId: string;
  customerName: string;
  phone: string | null;
  rating: number | null;
  feedback: string | null;
  deliveredAt: string | null;
}

export interface AdminRatingsPage {
  content: AdminRatingItem[];
  page: number;
  hasMore: boolean;
  total: number;
}

interface AdminDeliveryPageResponse {
  content: AdminDeliveryListItem[];
  page: number;
  hasMore: boolean;
}

export async function getDeliveries(params: {
  warehouseId: string;
  status?: string;
  deliveryDate?: string;
  page?: number;
  size?: number;
}): Promise<AdminDeliveryPageResponse> {
  const res = await adminApi.get<ApiResponse<AdminDeliveryPageResponse>>("/admin/deliveries", {
    params: {
      warehouseId: params.warehouseId,
      ...(params.status ? { status: params.status } : {}),
      ...(params.deliveryDate ? { deliveryDate: params.deliveryDate } : {}),
      page: params.page ?? 0,
      size: params.size ?? 200,
    },
  });
  return res.data.data;
}

export async function getDeliveryDetail(orderId: string): Promise<AdminDeliveryDetail> {
  const res = await adminApi.get<ApiResponse<AdminDeliveryDetail>>(`/admin/deliveries/${orderId}`);
  return res.data.data;
}

// ── Customer Support ──────────────────────────────────────────────────────────

export interface CustomerSummary {
  id: string;
  name: string;
  phone: string;
  email: string;
  totalOrders: number;
  isSubscriber: boolean;
}

export interface AdminOrderLine {
  name: string;
  quantity: number;
  price: number;
  unitWeight: string;
}

export interface AdminCustomerOrder {
  orderId: string;
  status: string;
  total: number;
  paymentMethod: string;
  placedAt: string;
  deliverySlot: string;
  items: AdminOrderLine[];
  refundStatus: string | null;
}

export interface AdminSavedAddress {
  label: string;
  address: string;
  isDefault: boolean;
}

export interface AdminWalletTxn {
  date: string;
  txnId: string;
  type: string;
  source: string;
  amount: number;
  status: string;
}

export interface CustomerDetail {
  id: string;
  name: string;
  phone: string;
  email: string;
  memberSince: string;
  isSubscriber: boolean;
  totalOrders: number;
  walletBalance: number;
  savedAddresses: AdminSavedAddress[];
  orderHistory: AdminCustomerOrder[];
  hasMoreOrders: boolean;
  transactions: AdminWalletTxn[];
}

export interface CustomerOrderPage {
  content: AdminCustomerOrder[];
  page: number;
  hasMore: boolean;
}

export async function searchCustomers(q: string): Promise<CustomerSummary[]> {
  const res = await adminApi.get<ApiResponse<CustomerSummary[]>>("/admin/customers/search", {
    params: { q },
  });
  return res.data.data;
}

export async function getCustomerDetail(userId: string): Promise<CustomerDetail> {
  const res = await adminApi.get<ApiResponse<CustomerDetail>>(`/admin/customers/${userId}`);
  return res.data.data;
}

export async function getCustomerOrders(
  userId: string,
  page = 0,
  size = 10,
): Promise<CustomerOrderPage> {
  const res = await adminApi.get<ApiResponse<CustomerOrderPage>>(
    `/admin/customers/${userId}/orders`,
    { params: { page, size } },
  );
  return res.data.data;
}

export async function postCustomerRefund(
  userId: string,
  orderId: string,
  amount: number,
  destination: "WALLET" | "ORIGINAL",
): Promise<void> {
  await adminApi.post(`/admin/customers/${userId}/refund`, { orderId, amount, destination });
}

export async function postWalletCredit(
  userId: string,
  amount: number,
  reason: string,
): Promise<void> {
  await adminApi.post(`/admin/customers/${userId}/wallet-credit`, { amount, reason });
}

export interface AdminRatingsFilter {
  maxRating?: number;      // show only ratings ≤ this value (e.g. 2 → 1★ and 2★)
  hasFeedback?: boolean;   // true = only ratings with written feedback
  sort?: "recent" | "oldest" | "lowest" | "highest";
}

export async function getAdminRatings(page = 0, size = 20, filter: AdminRatingsFilter = {}): Promise<AdminRatingsPage> {
  const res = await adminApi.get<ApiResponse<AdminRatingsPage>>("/admin/ratings", {
    params: {
      page,
      size,
      ...(filter.maxRating !== undefined ? { maxRating: filter.maxRating } : {}),
      ...(filter.hasFeedback ? { hasFeedback: "true" } : {}),
      ...(filter.sort && filter.sort !== "recent" ? { sort: filter.sort } : {}),
    },
  });
  return res.data.data;
}

// ── Access Control ────────────────────────────────────────────────────────────

export interface AllowedAdminEntry {
  id: string;
  phoneNumber: string;
  name: string;
  isSuperAdmin: boolean;
  createdAt: string;
}

export interface AllowedRiderEntry {
  id: string;
  phoneNumber: string;
  name: string;
  warehouseId: string | null;
  createdAt: string;
}

export async function checkSuperAdmin(): Promise<boolean> {
  const res = await adminApi.get<ApiResponse<{ isSuperAdmin: boolean }>>(
    "/admin/access/check-super-admin",
  );
  return res.data.data.isSuperAdmin;
}

export async function listAllowedAdmins(): Promise<AllowedAdminEntry[]> {
  const res = await adminApi.get<ApiResponse<AllowedAdminEntry[]>>("/admin/access/admins");
  return res.data.data;
}

export async function addAllowedAdmin(
  phoneNumber: string,
  name: string,
  isSuperAdmin: boolean,
): Promise<AllowedAdminEntry> {
  const res = await adminApi.post<ApiResponse<AllowedAdminEntry>>("/admin/access/admins", {
    phoneNumber,
    name,
    isSuperAdmin,
  });
  return res.data.data;
}

export async function removeAllowedAdmin(phoneNumber: string): Promise<void> {
  await adminApi.delete(`/admin/access/admins/${encodeURIComponent(phoneNumber)}`);
}

export async function listAllowedRiders(): Promise<AllowedRiderEntry[]> {
  const res = await adminApi.get<ApiResponse<AllowedRiderEntry[]>>("/admin/access/riders");
  return res.data.data;
}

export async function addAllowedRider(
  phoneNumber: string,
  name: string,
  warehouseId: string,
): Promise<AllowedRiderEntry> {
  const res = await adminApi.post<ApiResponse<AllowedRiderEntry>>("/admin/access/riders", {
    phoneNumber,
    name,
    warehouseId,
  });
  return res.data.data;
}

export async function removeAllowedRider(phoneNumber: string): Promise<void> {
  await adminApi.delete(`/admin/access/riders/${encodeURIComponent(phoneNumber)}`);
}

export interface MagicLinkResult {
  magicLink: string;  // full deep-link URL: https://riders.bajaru.com/login?token=...
  expiresIn: number;  // seconds (86400 = 24 h)
}

/**
 * Generates a one-time magic-link login URL for a rider.
 * The token is stored in Redis for 24 hours. Each call produces a new token;
 * the previous one is not invalidated, but will naturally expire.
 */
export async function generateRiderMagicLink(phoneNumber: string): Promise<MagicLinkResult> {
  const res = await adminApi.post<ApiResponse<MagicLinkResult>>(
    `/admin/access/riders/${encodeURIComponent(phoneNumber)}/magic-link`,
  );
  return res.data.data;
}

// ── Riders ────────────────────────────────────────────────────────────────────

export interface AdminRider {
  id: string;
  userId: string;
  name: string;
  phoneNumber: string;
  isOnline: boolean;
  isActive: boolean;
  deliveredToday: number;
  totalAssigned: number;
  shiftStartedAt: string | null;
}

export interface AdminRiderShiftDetail {
  shiftStartedAt: string | null;
  shiftEndedAt: string | null;
  assigned: number;
  delivered: number;
  rejected: number;
  cancelled: number;
  codTotal: number;
  codOrderCount: number;
  codCollectedCash: number;
  codCollectedCashCount: number;
  codCollectedUpi: number;
  codCollectedUpiCount: number;
  earningsDelivery: number;
  earningsWait: number;
  earningsTotal: number;
  earningsDeliveryCount: number;
}

export interface RouteBatchView {
  id: string;
  name: string;
  status: string;
  assignedRiderId: string | null;
  assignedRiderName: string | null;
  estimatedHours: number | null;
  orderCount: number;
  completedDeliveries: number;
  createdAt: string;
  orderIds: string[];
}

export async function listRiders(warehouseId: string, date?: string): Promise<AdminRider[]> {
  const res = await adminApi.get<ApiResponse<AdminRider[]>>("/admin/riders", {
    params: { warehouseId, ...(date ? { date } : {}) },
  });
  return res.data.data;
}

export async function getRiderDetail(riderId: string): Promise<AdminRiderShiftDetail> {
  const res = await adminApi.get<ApiResponse<AdminRiderShiftDetail>>(
    `/admin/riders/${riderId}/details`,
  );
  return res.data.data;
}

export async function patchRiderOnlineStatus(
  riderId: string,
  online: boolean,
): Promise<AdminRider> {
  const res = await adminApi.patch<ApiResponse<AdminRider>>(
    `/admin/riders/${riderId}/online-status`,
    { online },
  );
  return res.data.data;
}

export async function listRouteBatches(): Promise<RouteBatchView[]> {
  const res = await adminApi.get<ApiResponse<RouteBatchView[]>>("/admin/riders/route-batches");
  return res.data.data;
}

export async function createRouteBatch(
  name: string,
  estimatedHours?: number,
  orderIds?: string[],
): Promise<RouteBatchView> {
  const res = await adminApi.post<ApiResponse<RouteBatchView>>("/admin/riders/route-batches", {
    name,
    ...(estimatedHours !== undefined ? { estimatedHours } : {}),
    ...(orderIds?.length ? { orderIds } : {}),
  });
  return res.data.data;
}

export async function assignRouteBatch(batchId: string, riderId: string): Promise<RouteBatchView> {
  const res = await adminApi.patch<ApiResponse<RouteBatchView>>(
    `/admin/riders/route-batches/${batchId}/assign`,
    { riderId },
  );
  return res.data.data;
}

export default adminApi;
