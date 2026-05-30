export type ThemePreset = {
  id: string;
  label: string;
  emoji: string;
  vars: Record<string, string>;
};

export const ALL_PIXEL_VARS = [
  "--pixel-primary",
  "--pixel-accent",
  "--pixel-bg",
  "--pixel-card",
  "--pixel-border",
  "--pixel-shadow",
  "--pixel-text",
  "--pixel-subtext",
  "--pixel-muted",
] as const;

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
      "--pixel-bg": "#1a0a2e",
      "--pixel-card": "#2d1b4e",
      "--pixel-border": "#ff00ff",
      "--pixel-shadow": "#ff00ff",
      "--pixel-primary": "#ff00ff",
      "--pixel-accent": "#00ffff",
      "--pixel-text": "#f0e6ff",
      "--pixel-subtext": "#b89fd8",
      "--pixel-muted": "#3d2260",
    },
  },
  {
    id: "forest",
    label: "Floresta",
    emoji: "🌲",
    vars: {
      "--pixel-bg": "#0a1a0a",
      "--pixel-card": "#0d2d0d",
      "--pixel-border": "#22c55e",
      "--pixel-shadow": "#15803d",
      "--pixel-primary": "#22c55e",
      "--pixel-accent": "#84cc16",
      "--pixel-text": "#dcfce7",
      "--pixel-subtext": "#86efac",
      "--pixel-muted": "#14532d",
    },
  },
  {
    id: "ocean",
    label: "Oceano",
    emoji: "🌊",
    vars: {
      "--pixel-bg": "#0a0e1a",
      "--pixel-card": "#0d1a2d",
      "--pixel-border": "#38bdf8",
      "--pixel-shadow": "#0284c7",
      "--pixel-primary": "#38bdf8",
      "--pixel-accent": "#818cf8",
      "--pixel-text": "#e0f2fe",
      "--pixel-subtext": "#7dd3fc",
      "--pixel-muted": "#0c2340",
    },
  },
  {
    id: "amber",
    label: "Âmbar",
    emoji: "🔥",
    vars: {
      "--pixel-bg": "#1a0e00",
      "--pixel-card": "#2d1a00",
      "--pixel-border": "#f59e0b",
      "--pixel-shadow": "#b45309",
      "--pixel-primary": "#f59e0b",
      "--pixel-accent": "#ef4444",
      "--pixel-text": "#fef3c7",
      "--pixel-subtext": "#fcd34d",
      "--pixel-muted": "#3d1f00",
    },
  },
  {
    id: "midnight",
    label: "Midnight",
    emoji: "🌙",
    vars: {
      "--pixel-bg": "#0d0d0d",
      "--pixel-card": "#1a1a1a",
      "--pixel-border": "#a855f7",
      "--pixel-shadow": "#7c3aed",
      "--pixel-primary": "#a855f7",
      "--pixel-accent": "#ec4899",
      "--pixel-text": "#f5f0ff",
      "--pixel-subtext": "#c4b5fd",
      "--pixel-muted": "#2d1f40",
    },
  },
  {
    id: "retro",
    label: "Retro",
    emoji: "👾",
    vars: {
      "--pixel-bg": "#1c1c1c",
      "--pixel-card": "#2a2a2a",
      "--pixel-border": "#facc15",
      "--pixel-shadow": "#ca8a04",
      "--pixel-primary": "#facc15",
      "--pixel-accent": "#f97316",
      "--pixel-text": "#fefce8",
      "--pixel-subtext": "#fde68a",
      "--pixel-muted": "#3a3000",
    },
  },
];

export function findThemePreset(id: string): ThemePreset {
  return THEME_PRESETS.find((t) => t.id === id) ?? THEME_PRESETS[0]!;
}
