export const ARTWORK_MAX_WIDTH = 640;
export const ARTWORK_MAX_SIZE_MB = 3;
export const ARTWORK_JPEG_QUALITY = 0.82;

export async function compressImageToDataUrl(
  file: File,
  maxWidth = ARTWORK_MAX_WIDTH,
  quality = ARTWORK_JPEG_QUALITY,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const blobUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(blobUrl);
      const scale = Math.min(1, maxWidth / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas nao suportado")); return; }

      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };

    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      reject(new Error("Falha ao carregar imagem"));
    };

    img.src = blobUrl;
  });
}

export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith("image/")) return "Arquivo deve ser uma imagem (PNG, JPG, WebP, etc.)";
  if (file.size > ARTWORK_MAX_SIZE_MB * 1024 * 1024)
    return `Imagem muito grande. Maximo: ${ARTWORK_MAX_SIZE_MB}MB`;
  return null;
}
