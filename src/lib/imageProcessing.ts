// Browser-side image processing — mirrors the Python compression script logic.
// Produces two WebP variants from any source image:
//   thumbnail: 200×200, near-lossless (quality=1.0)
//   detail:    800×800, quality=0.80, white background (RGBA → RGB)

export interface ProcessedImages {
  thumbnail: Blob;
  detail: Blob;
}

/**
 * Draw bitmap into a square canvas of `size` px, cropping to center (cover-fit).
 * Optionally fills with white first so RGBA images lose transparency correctly.
 */
function drawSquareCanvas(
  bitmap: ImageBitmap,
  size: number,
  whiteBackground: boolean,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D context");

  if (whiteBackground) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
  }

  // Scale to cover the square, then center-crop
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const scaledW = bitmap.width * scale;
  const scaledH = bitmap.height * scale;
  const offsetX = (size - scaledW) / 2;
  const offsetY = (size - scaledH) / 2;

  ctx.drawImage(bitmap, offsetX, offsetY, scaledW, scaledH);
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("canvas.toBlob returned null"));
      },
      "image/webp",
      quality,
    );
  });
}

/**
 * Process a raw image file into two WebP variants.
 * Matches the Python script: thumbnail is near-lossless, detail uses 80% quality
 * with a white background so transparency is stripped (matching RGBA→RGB conversion).
 */
export async function processProductImage(file: File): Promise<ProcessedImages> {
  const bitmap = await createImageBitmap(file);

  const thumbCanvas = drawSquareCanvas(bitmap, 200, false);
  const detailCanvas = drawSquareCanvas(bitmap, 800, true);

  bitmap.close(); // free GPU memory

  const [thumbnail, detail] = await Promise.all([
    canvasToBlob(thumbCanvas, 1.0),  // near-lossless — matches Python lossless=True
    canvasToBlob(detailCanvas, 0.8), // 80% quality — matches Python quality=80
  ]);

  return { thumbnail, detail };
}
