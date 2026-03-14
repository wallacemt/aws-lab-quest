export type CertificationPresetSeed = {
  code: string;
  name: string;
  description: string;
  displayOrder: number;
  examMinutes?: number;
};

export const AWS_CERTIFICATION_PRESETS: CertificationPresetSeed[] = [
  {
    code: "CLF-C02",
    name: "AWS Certified Cloud Practitioner (CLF-C02)",
    description: "Fundamentos de cloud AWS para iniciantes.",
    displayOrder: 10,
  },
  {
    code: "SAA-C03",
    name: "AWS Certified Solutions Architect - Associate (SAA-C03)",
    description: "Arquitetura de soluções seguras, resilientes e custo-efetivas.",
    displayOrder: 20,
  },
  {
    code: "DVA-C02",
    name: "AWS Certified Developer - Associate (DVA-C02)",
    description: "Desenvolvimento e troubleshooting de aplicações na AWS.",
    displayOrder: 30,
  },
  {
    code: "SOA-C02",
    name: "AWS Certified SysOps Administrator - Associate (SOA-C02)",
    description: "Operações, observabilidade e automação de workloads AWS.",
    displayOrder: 40,
  },
  {
    code: "DEA-C01",
    name: "AWS Certified Data Engineer - Associate (DEA-C01)",
    description: "Ingestão, transformação e modelagem de dados na AWS.",
    displayOrder: 50,
  },
  {
    code: "AIF-C01",
    name: "AWS Certified AI Practitioner (AIF-C01)",
    description: "Conceitos de IA/ML e serviços gerenciados na AWS.",
    displayOrder: 60,
  },
  {
    code: "SAP-C02",
    name: "AWS Certified Solutions Architect - Professional (SAP-C02)",
    description: "Arquitetura avançada multi-conta e cenários enterprise.",
    displayOrder: 70,
  },
  {
    code: "DOP-C02",
    name: "AWS Certified DevOps Engineer - Professional (DOP-C02)",
    description: "Entrega contínua, confiabilidade e operações avançadas.",
    displayOrder: 80,
  },
  {
    code: "ANS-C01",
    name: "AWS Certified Advanced Networking - Specialty (ANS-C01)",
    description: "Redes avançadas, conectividade híbrida e performance.",
    displayOrder: 90,
  },
  {
    code: "SCS-C02",
    name: "AWS Certified Security - Specialty (SCS-C02)",
    description: "Segurança, identidade, proteção de dados e resposta a incidentes.",
    displayOrder: 100,
  },
  {
    code: "MLS-C01",
    name: "AWS Certified Machine Learning Engineer - Associate (MLS-C01)",
    description: "Construção de pipelines e deployment de modelos de ML.",
    displayOrder: 110,
  },
];

export function inferCertificationCode(input: string): string | null {
  const normalized = input.toLowerCase();

  if (normalized.includes("practitioner") || normalized.includes("clf")) return "CLF-C02";
  if (normalized.includes("solutions architect") && normalized.includes("professional")) return "SAP-C02";
  if (normalized.includes("solutions architect") || normalized.includes("saa")) return "SAA-C03";
  if (normalized.includes("developer") || normalized.includes("dva")) return "DVA-C02";
  if (normalized.includes("sysops") || normalized.includes("soa")) return "SOA-C02";
  if (normalized.includes("data engineer") || normalized.includes("dea")) return "DEA-C01";
  if (normalized.includes("ai practitioner") || normalized.includes("aif")) return "AIF-C01";
  if (normalized.includes("devops") || normalized.includes("dop")) return "DOP-C02";
  if (normalized.includes("network") || normalized.includes("ans")) return "ANS-C01";
  if (normalized.includes("security") || normalized.includes("scs")) return "SCS-C02";
  if (normalized.includes("machine learning") || normalized.includes("mls")) return "MLS-C01";

  return null;
}
