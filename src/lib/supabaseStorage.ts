// Product image uploads — proxied through the backend.
// The backend holds Supabase credentials; the frontend never needs them.
//
// POST  /api/v1/admin/upload/product-images  — multipart/form-data, field "file"
// DELETE /api/v1/admin/upload/product-images — { paths: string[] }

import type { ProcessedSlot, ImageCategory } from "@/features/products/ImageProcessingPanel";
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
 *   400×400 slots → thumbnails/{category}/{slug}-thumbnail[-n].webp
 *   800×800 slots → details/{category}/{slug}-detail[-n].webp
 *
 * ORDERING GUARANTEE: thumbnails (400 px) are ALWAYS first in the returned array.
 */
export async function uploadProductImages(
  slots: ProcessedSlot[],
  productName: string,
  category: string,
): Promise<string[]> {
  const slug = slugify(productName);

  const sorted = [...slots].sort((a, b) => a.size - b.size);

  const sizeCounters: Record<number, number> = {};
  const form = new FormData();

  for (const slot of sorted) {
    const n = sizeCounters[slot.size] ?? 0;
    sizeCounters[slot.size] = n + 1;

    const folder = slot.size === 400 ? "thumbnails" : "details";
    const suffix = slot.size === 400 ? "thumbnail" : "detail";
    const indexSuffix = n > 0 ? `-${n}` : "";
    const objectPath = `${folder}/${category}/${slug}-${suffix}${indexSuffix}.webp`;

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
 * Parse the image category from a Supabase storage URL.
 * URL pattern: .../thumbnails/{category}/{filename}.webp
 *              .../details/{category}/{filename}.webp
 * Returns null if the URL doesn't match the expected pattern.
 */
export function parseCategoryFromImageUrl(url: string): ImageCategory | null {
  const match = url.match(/\/(?:thumbnails|details)\/([^/]+)\//);
  if (!match) return null;
  return match[1] as ImageCategory;
}

/**
 * Fetch existing product images from their public URLs and re-upload them
 * under a new category folder. Used when the image category is changed on
 * an existing product.
 *
 * ORDERING GUARANTEE: thumbnails (URLs containing /thumbnails/) come first.
 */
export async function relocateProductImages(
  imageUrls: string[],
  productName: string,
  toCategory: ImageCategory,
): Promise<string[]> {
  if (imageUrls.length === 0) return [];

  const slots: ProcessedSlot[] = await Promise.all(
    imageUrls.map(async (url) => {
      const res = await fetch(url);
      const blob = await res.blob();
      const size: ProcessedSlot["size"] = url.includes("/thumbnails/") ? 400 : 800;
      return { blob, preview: url, size };
    }),
  );

  return uploadProductImages(slots, productName, toCategory);
}

/**
 * Request the backend to delete the given image files from Supabase storage.
 *
 * Backend endpoint required: DELETE /admin/upload/product-images
 * Body: { paths: string[] }  — storage object paths (e.g. "thumbnails/fruits/slug-thumbnail.webp")
 *
 * This is best-effort — callers should catch errors and not fail the main flow.
 */
export async function deleteProductImages(imageUrls: string[]): Promise<void> {
  if (imageUrls.length === 0) return;

  const paths = imageUrls.map((url) => {
    // Extract the object path after the bucket name from the full public URL.
    // Supabase URLs: .../storage/v1/object/public/product-images/{path}
    // Backend-proxied URLs may differ — we look for the first segment after /product-images/
    const idx = url.indexOf("/product-images/");
    return idx >= 0 ? url.slice(idx + "/product-images/".length) : null;
  }).filter((p): p is string => p !== null);

  if (paths.length === 0) return;
  await adminApi.delete("/admin/upload/product-images", { data: { paths } });
}

/**
 * Returns the number of thumbnail slots (400 px) so callers can split the
 * returned URL array into thumbnails vs. detail images.
 */
export function thumbnailCount(slots: ProcessedSlot[]): number {
  return slots.filter((s) => s.size === 400).length;
}
