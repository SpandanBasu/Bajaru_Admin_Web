// Direct Supabase Storage REST API calls — no SDK dependency.
// Uploads product image blobs to the `product-images` bucket.
//
// Required env vars:
//   VITE_SUPABASE_URL      e.g. https://xyzxyz.supabase.co
//   VITE_SUPABASE_ANON_KEY your project's anon/public key

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "";
const BUCKET = "product-images";

export interface UploadedImageUrls {
  detailUrl: string;
  thumbnailUrl: string;
}

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
      "x-upsert": "true", // overwrite if same path already exists
    },
    body: blob,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Supabase upload failed (${res.status}): ${text}`);
  }

  // Return the public URL directly
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

/**
 * Upload both image variants to Supabase Storage.
 *
 * Paths:
 *   details/{category}/{slug}-detail.webp
 *   thumbnails/{category}/{slug}-thumbnail.webp
 */
export async function uploadProductImages(
  detail: Blob,
  thumbnail: Blob,
  productName: string,
  category: string,
): Promise<UploadedImageUrls> {
  const slug = slugify(productName);
  const detailPath = `details/${category}/${slug}-detail.webp`;
  const thumbPath = `thumbnails/${category}/${slug}-thumbnail.webp`;

  const [detailUrl, thumbnailUrl] = await Promise.all([
    uploadBlob(detail, detailPath),
    uploadBlob(thumbnail, thumbPath),
  ]);

  return { detailUrl, thumbnailUrl };
}
