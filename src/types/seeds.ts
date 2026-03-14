export type SeedAwsService = {
  code: string;
  name: string;
  description?: string;
};

export type SeedQuestion = {
  externalId: string;
  statement: string;
  usage: "KC" | "SIMULADO" | "BOTH";
  difficulty: "easy" | "medium" | "hard";
  topic: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE?: string;
  correctOption: "A" | "B" | "C" | "D" | "E";
  explanationA: string;
  explanationB: string;
  explanationC: string;
  explanationD: string;
  explanationE?: string;
  certificationCode: string;
  serviceCode: string;
};
