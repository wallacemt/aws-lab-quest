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
