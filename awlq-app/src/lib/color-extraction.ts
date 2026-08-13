type RGB = [number, number, number];

function rgbToHex([r, g, b]: RGB): string {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}

function luminance([r, g, b]: RGB): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function saturation([r, g, b]: RGB): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

function distance(a: RGB, b: RGB): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/**
 * Extracts a --pixel-* color palette from an image file via a downscaled canvas + color
 * quantization (bucketed frequency count, then top-K distinct dominant colors by simple
 * euclidean RGB distance). Runs entirely client-side, no server round-trip or dependency.
 * Returns null if the file can't be decoded (e.g. corrupt image).
 */
export async function extractPaletteFromImageFile(file: File): Promise<Record<string, string> | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = 48;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    // ponytail: bucketed frequency count, not full k-means — good enough for a UI seed color,
    // upgrade to a proper clustering lib if extraction quality becomes a real complaint.
    const BUCKET = 24;
    const buckets = new Map<string, { color: RGB; count: number }>();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3]! < 128) continue; // skip transparent pixels
      const rgb: RGB = [data[i]!, data[i + 1]!, data[i + 2]!];
      const key = rgb.map((v) => Math.round(v / BUCKET) * BUCKET).join(",");
      const existing = buckets.get(key);
      if (existing) existing.count += 1;
      else buckets.set(key, { color: rgb, count: 1 });
    }

    const sorted = Array.from(buckets.values()).sort((a, b) => b.count - a.count);

    const palette: RGB[] = [];
    for (const { color } of sorted) {
      if (palette.length >= 6) break;
      if (palette.every((p) => distance(p, color) > 40)) palette.push(color);
    }
    if (palette.length === 0) return null;

    const byLuminance = [...palette].sort((a, b) => luminance(a) - luminance(b));
    const bySaturation = [...palette].sort((a, b) => saturation(b) - saturation(a));

    const bg = byLuminance[0]!;
    const lightest = byLuminance[byLuminance.length - 1]!;
    const primary = bySaturation[0]!;
    const accent = bySaturation.find((c) => distance(c, primary) > 60) ?? bySaturation[1] ?? primary;

    const card = mix(bg, lightest, 0.18);
    const muted = mix(bg, lightest, 0.08);
    const text: RGB = luminance(bg) < 128 ? [245, 240, 255] : [20, 20, 31];
    const subtext = mix(text, bg, 0.4);

    return {
      "--pixel-bg": rgbToHex(bg),
      "--pixel-card": rgbToHex(card),
      "--pixel-border": rgbToHex(primary),
      "--pixel-shadow": rgbToHex(primary),
      "--pixel-primary": rgbToHex(primary),
      "--pixel-accent": rgbToHex(accent),
      "--pixel-text": rgbToHex(text),
      "--pixel-subtext": rgbToHex(subtext),
      "--pixel-muted": rgbToHex(muted),
    };
  } catch {
    return null;
  }
}
