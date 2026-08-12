export type CertWelcomeTheme = {
  code: string;
  headlines: string[];
};

// Thematic home headlines by target certification (profile.certificationPresetCode).
// Several variants per cert so the welcome message doesn't feel identical on every visit.
export const CERT_WELCOME_MESSAGES: CertWelcomeTheme[] = [
  {
    code: "CLF-C02",
    headlines: [
      "Todo herói começa na nuvem — bora dar o primeiro passo.",
      "Sua jornada rumo à Cloud Practitioner começa agora.",
      "Fundamentos hoje, certificação amanhã.",
    ],
  },
  {
    code: "SAA-C03",
    headlines: [
      "Arquitete sua vitória rumo à Solutions Architect.",
      "Construa a solução perfeita, um XP de cada vez.",
      "Todo bom arquiteto testa suas plantas — hora de praticar.",
    ],
  },
  {
    code: "DVA-C02",
    headlines: [
      "Compile conhecimento rumo à Developer Associate.",
      "Debugue suas dúvidas antes da prova.",
      "Cada linha de estudo te aproxima do deploy final: a certificação.",
    ],
  },
  {
    code: "SOA-C02",
    headlines: [
      "Mantenha tudo no ar rumo à SysOps Associate.",
      "Automação, monitoramento e muito XP pela frente.",
      "O painel de controle da sua aprovação está aqui.",
    ],
  },
  {
    code: "DEA-C01",
    headlines: [
      "Transforme dados em XP rumo à Data Engineer.",
      "Pipeline de conhecimento rodando — hora de estudar.",
      "Ingerindo conhecimento rumo à certificação.",
    ],
  },
  {
    code: "AIF-C01",
    headlines: [
      "Treine seu modelo de conhecimento rumo à AI Practitioner.",
      "Inteligência artificial, XP real.",
      "Prevendo sua aprovação com boas doses de estudo.",
    ],
  },
  {
    code: "SAP-C02",
    headlines: [
      "Arquiteturas complexas pedem preparo — vamos à Professional.",
      "Multi-conta, multi-região, multi-XP.",
      "Nível profissional exige treino de elite.",
    ],
  },
  {
    code: "DOP-C02",
    headlines: [
      "Pipeline de estudos rodando rumo à DevOps Professional.",
      "Deploy contínuo de conhecimento, todo dia.",
      "Confiabilidade também se treina — hora do estudo.",
    ],
  },
  {
    code: "ANS-C01",
    headlines: [
      "Conecte os pontos rumo à Advanced Networking.",
      "Baixa latência, alta preparação.",
      "Roteando seu conhecimento rumo à Specialty.",
    ],
  },
  {
    code: "SCS-C02",
    headlines: [
      "Fortaleça suas defesas rumo à Security Specialty.",
      "Todo bom guardião treina diariamente.",
      "Identidade, proteção e muito XP pela frente.",
    ],
  },
  {
    code: "MLS-C01",
    headlines: [
      "Treine seu modelo rumo à Machine Learning Associate.",
      "Cada sessão de estudo é um novo epoch.",
      "Ajustando os hiperparâmetros da sua aprovação.",
    ],
  },
];

const DEFAULT_WELCOME_HEADLINES = [
  "Selecione seu desafio e comece a subir de nível.",
  "Sua próxima sessão de estudo está a um clique.",
];

export function getCertWelcomeHeadline(certificationPresetCode: string): string {
  const theme = CERT_WELCOME_MESSAGES.find((t) => t.code === certificationPresetCode);
  const pool = theme?.headlines ?? DEFAULT_WELCOME_HEADLINES;
  return pool[Math.floor(Math.random() * pool.length)];
}
