export type ThemePreset = {
  id: string;
  label: string;
  emoji: string;
  vars: Record<string, string>;
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "default",
    label: "Padrão",
    emoji: "🎮",
    vars: {},
  },
  {
    id: "synthwave",
    label: "Synthwave",
    emoji: "🌆",
    vars: {
      "--pixel-primary": "#ff00ff",
      "--pixel-accent": "#00ffff",
      "--pixel-bg": "#1a0a2e",
      "--pixel-card": "#2d1b4e",
      "--pixel-border": "#ff00ff",
    },
  },
  {
    id: "forest",
    label: "Floresta",
    emoji: "🌲",
    vars: {
      "--pixel-primary": "#22c55e",
      "--pixel-accent": "#84cc16",
      "--pixel-bg": "#0a1a0a",
      "--pixel-card": "#0d2d0d",
      "--pixel-border": "#22c55e",
    },
  },
  {
    id: "ocean",
    label: "Oceano",
    emoji: "🌊",
    vars: {
      "--pixel-primary": "#38bdf8",
      "--pixel-accent": "#818cf8",
      "--pixel-bg": "#0a0e1a",
      "--pixel-card": "#0d1a2d",
      "--pixel-border": "#38bdf8",
    },
  },
  {
    id: "amber",
    label: "Âmbar",
    emoji: "🔥",
    vars: {
      "--pixel-primary": "#f59e0b",
      "--pixel-accent": "#ef4444",
      "--pixel-bg": "#1a0e00",
      "--pixel-card": "#2d1a00",
      "--pixel-border": "#f59e0b",
    },
  },
];

export function findThemePreset(id: string): ThemePreset {
  return THEME_PRESETS.find((t) => t.id === id) ?? THEME_PRESETS[0]!;
}
