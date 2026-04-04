// Direct Supabase Storage REST API calls — no SDK dependency.
// Uploads product image blobs to the `product-images` bucket.
//
// Required env vars:
//   VITE_SUPABASE_URL      e.g. https://xyzxyz.supabase.co
//   VITE_SUPABASE_ANON_KEY your project's anon/public key

import type { ProcessedSlot } from "@/features/products/ImageProcessingPanel";

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "";
const BUCKET = "product-images";

/** Converts a product name to a safe URL slug, e.g. "Green Apple" → "green-apple" */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function uploadBlob(blob: Blob, storagePath: string): Promise<string> {
  const endpoint = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "image/webp",
      "x-upsert": "true",
    },
    body: blob,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Supabase upload failed (${res.status}): ${text}`);
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

/**
 * Upload all processed image slots to Supabase Storage.
 *
 * Paths:
 *   200×200 slots → thumbnails/{category}/{slug}-thumbnail-{n}.webp
 *   800×800 slots → details/{category}/{slug}-detail-{n}.webp
 *
 * ORDERING GUARANTEE: thumbnails (200 px) are ALWAYS uploaded first and their
 * URLs appear first in the returned array.  This ensures imageUrls[0] is always
 * the thumbnail, regardless of what order the user added slots in the UI.
 */
export async function uploadProductImages(
  slots: ProcessedSlot[],
  productName: string,
  category: string,
): Promise<string[]> {
  const slug = slugify(productName);

  // Sort: 200-px thumbnails first, 800-px details after.
  const sorted = [...slots].sort((a, b) => a.size - b.size);

  // Track separate counters per size so each gets a unique filename.
  const sizeCounters: Record<number, number> = {};

  const uploadTasks = sorted.map((slot) => {
    const n = sizeCounters[slot.size] ?? 0;
    sizeCounters[slot.size] = n + 1;

    const folder = slot.size === 200 ? "thumbnails" : "details";
    const suffix = slot.size === 200 ? "thumbnail" : "detail";
    // Use index suffix only when there is more than one of the same size.
    const indexSuffix = n > 0 ? `-${n}` : "";
    const path = `${folder}/${category}/${slug}-${suffix}${indexSuffix}.webp`;

    return uploadBlob(slot.blob, path);
  });

  // URLs are returned in sorted order: thumbnails first, then details.
  return Promise.all(uploadTasks);
}

/**
 * Given the original slot list and the uploaded URL list (both already sorted
 * thumbnail-first by uploadProductImages), returns the thumbnail count so
 * callers can split the array correctly when merging with existing image URLs.
 */
export function thumbnailCount(slots: ProcessedSlot[]): number {
  return slots.filter((s) => s.size === 200).length;
}
