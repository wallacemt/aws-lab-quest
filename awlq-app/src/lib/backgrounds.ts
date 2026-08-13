export type BgPreset = {
  id: string;
  label: string;
  url: string;
  category: "landing" | "pixel-art";
};

export const BG_PRESETS: BgPreset[] = [
  { id: "none", label: "Nenhum", url: "", category: "landing" },
  { id: "cityscape-1", label: "Cityscape I", url: "/landing/cityscape-1.png", category: "landing" },
  { id: "cityscape-2", label: "Cityscape II", url: "/landing/cityscape-2.png", category: "landing" },
  { id: "ruins", label: "Ruins", url: "/landing/ruins-1.png", category: "landing" },
  { id: "px-city-1", label: "Pixel City I", url: "/backgrounds/px-city-1.png", category: "pixel-art" },
  { id: "px-city-2", label: "Pixel City II", url: "/backgrounds/px-city-2.png", category: "pixel-art" },
  { id: "px-city-3", label: "Pixel City III", url: "/backgrounds/px-city-3.png", category: "pixel-art" },
  { id: "px-city-4", label: "Pixel City IV", url: "/backgrounds/px-city-4.png", category: "pixel-art" },
  { id: "px-city-5", label: "Pixel City V", url: "/backgrounds/px-city-5.png", category: "pixel-art" },
  { id: "px-city-6", label: "Pixel City VI", url: "/backgrounds/px-city-6.png", category: "pixel-art" },
];

export function findBgPreset(url: string): BgPreset | undefined {
  return BG_PRESETS.find((b) => b.url === url);
}

const PRESET_BG_URLS = new Set(BG_PRESETS.map((b) => b.url).filter(Boolean));

/** Accepts HTTPS URLs (user-provided/uploaded) and same-origin preset paths (in /public). */
export function isValidBgImageUrl(value: unknown): value is string | null {
  if (value === null || value === undefined) return true;
  if (typeof value !== "string") return false;
  if (value === "") return true;
  if (value.startsWith("https://")) return true;
  if (value.startsWith("/") && PRESET_BG_URLS.has(value)) return true;
  return false;
}

/** Stricter check for user-created themes: only our own uploaded images (via /api/user/theme-image) or presets — no arbitrary URLs. */
export function isValidThemeImageUrl(value: unknown): value is string | null {
  if (value === null || value === undefined) return true;
  if (typeof value !== "string") return false;
  if (value === "") return true;
  if (value.includes("/storage/v1/object/public/aws-lab-quest/theme-bgs/")) return true;
  if (value.startsWith("/") && PRESET_BG_URLS.has(value)) return true;
  return false;
}
