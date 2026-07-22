export type GameMode = {
  id: string;
  title: string;
  description: string;
  cta: string;
};

export const STUDY_MODES: GameMode[] = [
  {
    id: "simulado",
    title: "Modo Simulado",
    description: "Simulacao de prova com 90 minutos e bloqueio de outras acoes.",
    cta: "Iniciar Simulado",
  },
  {
    id: "lab",
    title: "Modo Lab",
    description: "Gerar um quest hands-on a partir de um lab real da AWS.",
    cta: "Jogar Lab",
  },
  {
    id: "kc",
    title: "Modo KC",
    description: "Knowledge Check com auditoria de respostas para fixar conceitos.",
    cta: "Abrir KC",
  },
  {
    id: "revisao",
    title: "Modo Revisao",
    description: "Revisao guiada por lacunas de conhecimento.",
    cta: "Abrir Revisao",
  },
];

export const RETENTION_MODES: GameMode[] = [
  {
    id: "flashcards",
    title: "Flashcards",
    description: "Revisao espacada com SM-2. Mantenha o conhecimento ativo no longo prazo.",
    cta: "Revisar Cards",
  },
  {
    id: "sprint",
    title: "Sprint Mode",
    description: "Sessoes ultra-rapidas de 3 a 10 questoes para manter o ritmo diario.",
    cta: "Iniciar Sprint",
  },
];

export const ADVENTURE_MODES: GameMode[] = [
  {
    id: "arena",
    title: "Arena de Batalha",
    description: "Enfrente bosses respondendo questoes e reduza o HP do inimigo.",
    cta: "Entrar na Arena",
  },
  {
    id: "trilhas",
    title: "Trilhas",
    description: "Percursos de aprendizagem por servico AWS com estagio a estagio.",
    cta: "Ver Trilhas",
  },
  {
    id: "desafio-semanal",
    title: "Desafio Semanal",
    description: "Responda o desafio da semana e dispute o ranking com todos os usuarios.",
    cta: "Encarar Desafio",
  },
];

export const TOOLS_MODES: GameMode[] = [
  {
    id: "biblioteca",
    title: "Biblioteca",
    description: "Acesse materiais de estudo, PDFs e artigos selecionados pelos instrutores.",
    cta: "Abrir Biblioteca",
  },
  {
    id: "mentor",
    title: "Mentor IA",
    description: "Receba orientacao personalizada do Mestre AWS baseada nas suas lacunas de conhecimento.",
    cta: "Consultar Mentor",
  },
  {
    id: "noticias",
    title: "Noticias AWS",
    description: "Fique por dentro das ultimas novidades, lancamentos e atualizacoes da AWS.",
    cta: "Ver Noticias",
  },
];

export const ALL_APP_MODES: GameMode[] = [
  ...STUDY_MODES,
  ...RETENTION_MODES,
  ...ADVENTURE_MODES,
  ...TOOLS_MODES,
];

// Section label per app id — used by admin UI to group context
export const APP_SECTION_LABEL: Record<string, string> = {
  simulado: "Estudo",
  lab: "Estudo",
  kc: "Estudo",
  revisao: "Estudo",
  flashcards: "Retencao",
  sprint: "Retencao",
  arena: "Aventura",
  trilhas: "Aventura",
  "desafio-semanal": "Aventura",
  biblioteca: "Ferramentas",
  mentor: "Ferramentas",
  noticias: "Ferramentas",
};
