export type ImportItem = {
  statement: string;
  options: Partial<Record<"A" | "B" | "C" | "D" | "E", string>>;
  correctOption?: string;
  correctOptions?: string[];
  difficulty?: "easy" | "medium" | "hard" | "nightmare";
  questionType?: "single" | "multi";
  topic?: string;
  certificationCode?: string;
  explanations?: Partial<Record<"A" | "B" | "C" | "D" | "E", string>>;
  awsServiceCodes?: string[];   // match exato por code
  awsServiceNames?: string[];   // match fuzzy por name/code (gerado pelo extrator)
};


export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
const keys = new Set(["A", "B", "C", "D", "E"]);
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

export function validateQuestionImport(value: unknown): ImportItem[] {
  const questions = Array.isArray(value) ? value : object(value) ? value.questions : null;
  if (!Array.isArray(questions) || questions.length === 0 || questions.length > 200)
    throw new Error("Informe de 1 a 200 questões em um array ou { questions: [...] }.");
  const errors: string[] = [];
  questions.forEach((q: unknown, i) => {
    const fail = (message: string) => errors.push(`Item ${i + 1}: ${message}`);
    if (!object(q)) { fail("questão deve ser um objeto"); return; }
    if (!text(q.statement)) fail("statement obrigatório e deve ser texto");
    if (!object(q.options) || Object.keys(q.options).length < 2 ||
        Object.entries(q.options).some(([k, v]) => !keys.has(k) || !text(v)))
      fail("options deve conter de 2 a 5 alternativas A–E preenchidas");
    if (q.correctOptions !== undefined && !Array.isArray(q.correctOptions)) fail("correctOptions deve ser uma lista");
    const correct = q.correctOptions ?? (q.correctOption !== undefined ? [q.correctOption] : []);
    if (!Array.isArray(correct) || !correct.length || new Set(correct).size !== correct.length ||
        correct.some(c => typeof c !== "string" || !keys.has(c) || !object(q.options) || !text(q.options[c])))
      fail("respostas corretas inválidas, repetidas ou ausentes nas opções");
    if (q.correctOption !== undefined && (!text(q.correctOption) || !keys.has(q.correctOption) ||
        (Array.isArray(correct) && !correct.includes(q.correctOption)))) fail("correctOption inconsistente");
    if (q.questionType !== undefined && q.questionType !== "single" && q.questionType !== "multi") fail("questionType inválido");
    if (Array.isArray(correct) && ((q.questionType === "single" && correct.length !== 1) ||
        (q.questionType === "multi" && correct.length < 2))) fail("quantidade de respostas incompatível com questionType");
    if (q.difficulty !== undefined && (typeof q.difficulty !== "string" || !["easy", "medium", "hard", "nightmare"].includes(q.difficulty))) fail("difficulty inválida");
    for (const field of ["topic", "certificationCode"]) {
      if (q[field] !== undefined && !text(q[field])) fail(`${field} deve ser texto preenchido`);
    }
    for (const field of ["awsServiceCodes", "awsServiceNames"]) {
      if (q[field] !== undefined && (!Array.isArray(q[field]) || !(q[field] as unknown[]).every(text))) fail(`${field} deve ser uma lista de textos`);
    }
    if (q.explanations !== undefined && (!object(q.explanations) ||
        Object.entries(q.explanations).some(([k, v]) => !keys.has(k) || typeof v !== "string"))) fail("explanations inválidas");
  });
  if (errors.length) throw new Error(errors.join("\n"));
  return questions as ImportItem[];
}

export function parseQuestionJson(source: string): ImportItem[] {
  if (new TextEncoder().encode(source).length > MAX_IMPORT_BYTES) throw new Error("Arquivo excede 2 MB.");
  let value: unknown;
  try { value = JSON.parse(source.replace(/^\uFEFF/, "")); }
  catch { throw new Error("JSON inválido. Verifique a sintaxe do arquivo."); }
  return validateQuestionImport(value);
}

export async function readQuestionFile(file: File): Promise<ImportItem[]> {
  if (!file.name.toLowerCase().endsWith(".json")) throw new Error("Selecione um arquivo .json.");
  if (file.size > MAX_IMPORT_BYTES) throw new Error("Arquivo excede 2 MB.");
  return parseQuestionJson(await file.text());
}
