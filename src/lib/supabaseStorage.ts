// Product image uploads — proxied through the backend.
// The backend holds Supabase credentials; the frontend never needs them.
//
// POST /api/v1/admin/upload/product-images
//   multipart/form-data, field name "file", filename = desired Supabase object path

import type { ProcessedSlot } from "@/features/products/ImageProcessingPanel";
import adminApi from "@/lib/api/adminApi";
import type { ApiResponse } from "@/lib/api/apiClient";

/** Converts a product name to a safe URL slug, e.g. "Green Apple" → "green-apple" */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Upload all processed image slots via the backend.
 *
 * Paths:
 *   200×200 slots → thumbnails/{category}/{slug}-thumbnail-{n}.webp
 *   800×800 slots → details/{category}/{slug}-detail-{n}.webp
 *
 * ORDERING GUARANTEE: thumbnails (200 px) are ALWAYS first in the returned array.
 */
export async function uploadProductImages(
  slots: ProcessedSlot[],
  productName: string,
  category: string,
): Promise<string[]> {
  const slug = slugify(productName);

  // Sort: 200-px thumbnails first, 800-px details after.
  const sorted = [...slots].sort((a, b) => a.size - b.size);

  const sizeCounters: Record<number, number> = {};
  const form = new FormData();

  for (const slot of sorted) {
    const n = sizeCounters[slot.size] ?? 0;
    sizeCounters[slot.size] = n + 1;

    const folder = slot.size === 200 ? "thumbnails" : "details";
    const suffix = slot.size === 200 ? "thumbnail" : "detail";
    const indexSuffix = n > 0 ? `-${n}` : "";
    const objectPath = `${folder}/${category}/${slug}-${suffix}${indexSuffix}.webp`;

    // Use the object path as the filename so the backend knows where to store it.
    form.append("file", slot.blob, objectPath);
  }

  const res = await adminApi.post<ApiResponse<string[]>>(
    "/admin/upload/product-images",
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );

  return res.data.data;
}

/**
 * Given the original slot list, returns the thumbnail count so callers can
 * split the returned URL array into thumbnails vs. detail images.
 */
export function thumbnailCount(slots: ProcessedSlot[]): number {
  return slots.filter((s) => s.size === 200).length;
}
