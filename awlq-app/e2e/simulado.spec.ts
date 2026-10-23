import { test, expect, type Page } from "@playwright/test";

/**
 * Real-browser regression test for the Simulado UX fixes:
 *  1. Long, unbroken text (e.g. a base64 auth-failure message) no longer overflows the page.
 *  2. Focus mode exposes "Enviar Simulado"/"Encerrar" so finishing never requires leaving focus mode.
 *  3. The confidence rating prompt surfaces on hover/click of "Proxima", non-blocking otherwise.
 *
 * SAFETY: run only against an isolated local DB, never production. See playwright.config.ts
 * for the one-time local setup (isolated Postgres/Redis, migrate, seed, seed-mock-user).
 */

const EMAIL = process.env.E2E_USER_EMAIL ?? "mock@awlq.dev";
const PASSWORD = process.env.E2E_USER_PASSWORD ?? "MockUser@123";

// Mirrors the real question reported as breaking layout: a single unbroken token
// (an authorization-failure message AWS actually returns Base64-encoded, with no spaces)
// inside a normal Portuguese sentence.
const LONG_TEXT_QUESTION = {
  id: "e2e-long-text-001",
  statement:
    "Um desenvolvedor executa um comando da AWS CLI em uma instância do Amazon EC2. Entretanto, o comando falha com a seguinte resposta: A client error (UnauthorizedOperation) occurred when calling the RunInstances operation: You are not authorized to perform this operation. Mensagem de falha de autorização codificada: mVqaktia1h2cDhtVG90THBhK216SG9reldscThOcHlqeXo3M3ZJU3NZMVg4SWVUQVNvZVUrIGltRDYrSDZ2QWdFNXhYQk5MQWw4Qmg5S3QzbU16S2RDM2VjZVFLV09KTlRiZjNSU3VFSXdobnpiYlo5UTJRUkNSZy81SjdiTDZlZzFhdFkwRDVqeFV5SWRucENEe Como o desenvolvedor pode decodificar a resposta na parte codificada da mensagem?",
  certificationCode: "DEV",
  topic: "IAM",
  difficulty: "medium",
  questionType: "single",
  options: {
    A: "Usando a API DecodeAuthorizationMessage do AWS STS",
    B: "Usando o comando aws iam decode-authorization-message",
    C: "Decodificando manualmente a string em Base64",
    D: "Abrindo um chamado de suporte com a AWS",
    E: "",
  },
  correctOption: "A",
  correctOptions: ["A"],
  explanations: {
    A: "A API DecodeAuthorizationMessage do STS decodifica a mensagem de falha de autorização.",
    B: "Não existe esse comando na AWS CLI.",
    C: "A mensagem não é um Base64 simples, requer a API do STS.",
    D: "Não é necessário abrir um chamado para isso.",
    E: "",
  },
  optionMapping: {
    displayToOriginal: { A: "A", B: "B", C: "C", D: "D", E: "E" },
    originalToDisplay: { A: "A", B: "B", C: "C", D: "D", E: "E" },
  },
};

const SHORT_QUESTION = {
  id: "e2e-short-001",
  statement: "Qual serviço AWS é usado para armazenamento de objetos escalável e durável?",
  certificationCode: "DEV",
  topic: "S3",
  difficulty: "easy",
  questionType: "single",
  options: {
    A: "Amazon EC2",
    B: "Amazon S3",
    C: "Amazon RDS",
    D: "AWS Lambda",
    E: "",
  },
  correctOption: "B",
  correctOptions: ["B"],
  explanations: { A: "", B: "", C: "", D: "", E: "" },
  optionMapping: {
    displayToOriginal: { A: "A", B: "B", C: "C", D: "D", E: "E" },
    originalToDisplay: { A: "A", B: "B", C: "C", D: "D", E: "E" },
  },
};

async function login(page: Page) {
  await page.goto("/login");
  const cookieButton = page.getByRole("button", { name: "Entendido" });
  if (await cookieButton.isVisible().catch(() => false)) {
    await cookieButton.click();
  }
  await page.getByRole("textbox", { name: "E-mail" }).fill(EMAIL);
  await page.getByRole("textbox", { name: /Senha/ }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar no Jogo" }).click();
  await page.waitForURL(/\/(home|profile)/, { timeout: 30_000 });
}

/** Seeds the same localStorage shape the app itself persists (src/lib/storage.ts,
 * src/stores/simulatedExamStore.ts), so the exam resumes straight into a controlled,
 * 2-question scenario. The shipped "Simulado Teste" dev button only ever creates a
 * single question (so "Proxima" is always disabled) — this is the only way to reach
 * a second question, including the long-text one, without a real generated pack. */
async function seedTwoQuestionDraft(page: Page) {
  await page.addInitScript(
    ({ short, long }) => {
      const now = Date.now();
      window.localStorage.setItem(
        "awlq_active_simulated_exam",
        JSON.stringify({
          id: `sim-${now}`,
          startedAt: new Date(now).toISOString(),
          endsAt: new Date(now + 5 * 60 * 1000).toISOString(),
          certificationCode: "DEV",
          locked: true,
        }),
      );
      window.localStorage.setItem(
        "awlq_simulado_draft",
        JSON.stringify({
          sessionId: `sim-${now}`,
          questions: [short, long],
          answers: {},
          currentIndex: 0,
          markedForReview: [],
        }),
      );
    },
    { short: SHORT_QUESTION, long: LONG_TEXT_QUESTION },
  );
}

test.describe("Simulado", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("modo foco permite finalizar sem precisar sair do foco", async ({ page }) => {
    await page.goto("/simulado");
    await page.getByRole("button", { name: /Simulado Teste/ }).click();

    await page.getByRole("radio", { name: /Amazon S3/ }).check();

    await page.getByRole("button", { name: "Foco" }).click();

    // Before the fix, "Enviar Simulado" only existed in the sidebar, which focus mode hides.
    await expect(page.getByRole("button", { name: "Enviar Simulado" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Encerrar" })).toBeVisible();
  });

  test("texto longo nao estoura a tela e o popover de confianca aparece em Proxima", async ({ page }) => {
    await seedTwoQuestionDraft(page);
    await page.goto("/simulado");

    const resumeButton = page.getByRole("button", { name: "Retomar de onde parei" });
    await expect(resumeButton).toBeVisible({ timeout: 10_000 });
    await resumeButton.click();

    await expect(page.getByText("Questao 1 de 2")).toBeVisible();
    await page.getByRole("radio", { name: /Amazon S3/ }).check();

    const nextButton = page.getByRole("button", { name: "Proxima →" });
    await nextButton.hover();
    await expect(page.getByText("Quão confiante você estava?")).toBeVisible();
    await page.getByRole("button", { name: "Muito confiante🤩" }).click();

    // Now on the long-text question — the regression this test guards against.
    await expect(page.getByText("Questao 2 de 2")).toBeVisible();
    await expect(page.getByText(/Mensagem de falha de autorização codificada/)).toBeVisible();

    const overflowX = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflowX).toBeLessThanOrEqual(1);
  });
});
