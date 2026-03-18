export type AchievementDef = {
  code: string;
  name: string;
  description: string;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  target: number;
  displayOrder: number;
  prompt: string;
};

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  {
    code: "first_lab",
    name: "Primeiro Passo",
    description: "Concluir seu primeiro lab.",
    rarity: "common",
    target: 1,
    displayOrder: 1,
    prompt:
      "pixel-art badge, retro game style, bronze rank emblem, cloud icon, textless, warm colors, high contrast, aws learning journey",
  },
  {
    code: "lab_master_10",
    name: "Mestre de Labs",
    description: "Concluir 10 labs.",
    rarity: "uncommon",
    target: 10,
    displayOrder: 2,
    prompt:
      "pixel-art badge, retro shield with 10 stars, cloud and terminal motifs, green/teal palette, textless, crisp icon",
  },
  {
    code: "lab_master_25",
    name: "Veterano de Labs",
    description: "Concluir 25 labs.",
    rarity: "rare",
    target: 25,
    displayOrder: 3,
    prompt: "pixel-art badge, rare sapphire medal, lightning cloud symbol, arcade style, textless, polished edges",
  },
  {
    code: "perfect_kc",
    name: "Especialista Perfeito",
    description: "Fazer 100% em um KC.",
    rarity: "rare",
    target: 1,
    displayOrder: 4,
    prompt: "pixel-art badge, perfect score trophy, checkmark + cloud, blue neon glow, retro game UI, textless",
  },
  {
    code: "simulado_aprovado",
    name: "Candidato Real",
    description: "Atingir 70% ou mais em um simulado.",
    rarity: "uncommon",
    target: 1,
    displayOrder: 5,
    prompt: "pixel-art badge, exam pass stamp, cloud and parchment, emerald accent, old-school style, textless",
  },
  {
    code: "simulado_veterano_5",
    name: "Veterano de Simulado",
    description: "Concluir 5 simulados.",
    rarity: "rare",
    target: 5,
    displayOrder: 6,
    prompt: "pixel-art badge, five marks exam insignia, cyber-retro style, blue and orange contrast, textless",
  },
  {
    code: "knowledge_hunter_10",
    name: "Cacador de Conhecimento",
    description: "Concluir 10 KCs.",
    rarity: "rare",
    target: 10,
    displayOrder: 7,
    prompt: "pixel-art badge, hunter compass and cloud, vintage fantasy arcade style, cool hues, textless",
  },
  {
    code: "xp_500",
    name: "Acumulador 500XP",
    description: "Alcancar 500 XP total.",
    rarity: "uncommon",
    target: 500,
    displayOrder: 8,
    prompt: "pixel-art badge, xp crystal shard icon, orange and teal glow, retro game inventory icon, textless",
  },
  {
    code: "xp_2000",
    name: "Acumulador 2000XP",
    description: "Alcancar 2000 XP total.",
    rarity: "epic",
    target: 2000,
    displayOrder: 9,
    prompt: "pixel-art badge, epic crystal crown, magenta and cyan palette, dramatic arcade badge, textless",
  },
  {
    code: "streak_3_days",
    name: "Ritmo Constante",
    description: "Manter uma sequencia de 3 dias de estudo.",
    rarity: "uncommon",
    target: 3,
    displayOrder: 10,
    prompt: "pixel-art badge, calendar flame icon, continuous streak motif, bright green accent, textless",
  },
  {
    code: "consistency_20_sessions",
    name: "Foco Continuo",
    description: "Concluir 20 sessoes de estudo (labs, KC ou simulados).",
    rarity: "epic",
    target: 20,
    displayOrder: 11,
    prompt: "pixel-art badge, disciplined warrior helm with cloud core, epic style, clean edges, textless",
  },
  {
    code: "aws_legend",
    name: "Lenda AWS",
    description: "Somar 5000 XP e 5 simulados aprovados.",
    rarity: "legendary",
    target: 2,
    displayOrder: 12,
    prompt: "pixel-art legendary badge, radiant golden cloud dragon emblem, premium arcade icon, textless, high detail",
  },
];
