export type OptionLabel = "A" | "B" | "C" | "D" | "E";
export type QuestionDificult = "easy" | "medium" | "hard" | "nightmare"
export type NormalizedOptionItem = {
  order: number;
  content: string;
  isCorrect: boolean;
  explanation: string | null;
};

export type RouteContext = {
  params: Promise<{
    questionId: string;
  }>;
};

export type PatchBody = {
  statement?: string;
  topic?: string;
  difficulty?: QuestionDificult;
  questionType?: "single" | "multi";
  usage?: "KC" | "SIMULADO" | "BOTH";
  active?: boolean;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  optionE?: string | null;
  correctOption?: string;
  correctOptions?: string[] | null;
  explanationA?: string | null;
  explanationB?: string | null;
  explanationC?: string | null;
  explanationD?: string | null;
  explanationE?: string | null;
  options?: Array<{
    label?: string;
    content?: string | null;
    explanation?: string | null;
    isCorrect?: boolean;
  }>;
  serviceCodes?: string[] | null;
};

export type CurrentQuestionState = {
  id: string;
  questionType: "single" | "multi";
  statement: string;
  topic: string;
  difficulty: QuestionDificult;
  usage: "KC" | "SIMULADO" | "BOTH";
  active: boolean;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE: string | null;
  correctOption: string;
  correctOptions: unknown;
  explanationA: string | null;
  explanationB: string | null;
  explanationC: string | null;
  explanationD: string | null;
  explanationE: string | null;
  awsService: { code: string } | null;
  questionAwsServices: Array<{ service: { code: string } }>;
  questionOptions: NormalizedOptionItem[];
};