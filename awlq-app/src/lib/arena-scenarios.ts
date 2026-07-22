export type ArenaScenario = {
  id: string;
  label: string;
  videoUrl: string;
  previewUrl: string;
  posterUrl: string;
};

const base = "/backgrounds/arena";

export const ARENA_SCENARIOS: ArenaScenario[] = [
  {
    id: "sakura-train-night",
    label: "Trem Sakura (Noite)",
    videoUrl: `${base}/sakura-train-night.mp4`,
    previewUrl: `${base}/sakura-train-night-preview.mp4`,
    posterUrl: `${base}/sakura-train-night.jpg`,
  },
  {
    id: "giant-tree",
    label: "Árvore Gigante",
    videoUrl: `${base}/giant-tree.mp4`,
    previewUrl: `${base}/giant-tree-preview.mp4`,
    posterUrl: `${base}/giant-tree.jpg`,
  },
  {
    id: "night-city",
    label: "Cidade Neon 8-bit",
    videoUrl: `${base}/night-city.mp4`,
    previewUrl: `${base}/night-city-preview.mp4`,
    posterUrl: `${base}/night-city.jpg`,
  },
  {
    id: "bad-city",
    label: "Cidade Sombria",
    videoUrl: `${base}/bad-city.mp4`,
    previewUrl: `${base}/bad-city-preview.mp4`,
    posterUrl: `${base}/bad-city.jpg`,
  },
  {
    id: "pizza-shop",
    label: "Pizzaria Noturna",
    videoUrl: `${base}/pizza-shop.mp4`,
    previewUrl: `${base}/pizza-shop-preview.mp4`,
    posterUrl: `${base}/pizza-shop.jpg`,
  },
  {
    id: "donuts-shop",
    label: "Loja de Donuts",
    videoUrl: `${base}/donuts-shop.mp4`,
    previewUrl: `${base}/donuts-shop-preview.mp4`,
    posterUrl: `${base}/donuts-shop.jpg`,
  },
  {
    id: "gladiator-arena",
    label: "Arena de Gladiadores",
    videoUrl: `${base}/gladiator-arena.mp4`,
    previewUrl: `${base}/gladiator-arena-preview.mp4`,
    posterUrl: `${base}/gladiator-arena.jpg`,
  },
];

export const DEFAULT_ARENA_SCENARIO_ID = ARENA_SCENARIOS[0].id;

export function findArenaScenario(id: string | null | undefined): ArenaScenario {
  return ARENA_SCENARIOS.find((s) => s.id === id) ?? ARENA_SCENARIOS[0];
}
