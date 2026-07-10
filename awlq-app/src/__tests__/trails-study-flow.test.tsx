// @vitest-environment jsdom
/**
 * Regression test for issue #37 — "rever" after failing a trail quiz showed
 * nothing. Root cause: the explanation markdown lived only inside the
 * `explain` phase's own state slice and was hardcoded to "" whenever the UI
 * transitioned back into that phase (e.g. "Reler explicação" after failing),
 * and per-question answers were discarded entirely instead of being kept for
 * a review screen.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

const { mockFetchStageExplain, mockFetchStageQuestions, mockCompleteStage } = vi.hoisted(() => ({
  mockFetchStageExplain: vi.fn(),
  mockFetchStageQuestions: vi.fn(),
  mockCompleteStage: vi.fn(),
}));

vi.mock("@/features/trails/services/trails-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/trails/services/trails-api")>();
  return {
    ...actual,
    fetchStageExplain: mockFetchStageExplain,
    fetchStageQuestions: mockFetchStageQuestions,
    completeStage: mockCompleteStage,
  };
});

import { TrailStudyFlow } from "@/features/trails/components/TrailStudyFlow";

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchStageExplain.mockResolvedValue({ markdown: "Conteudo explicativo do estagio", cached: true });
  mockFetchStageQuestions.mockResolvedValue({
    questions: [
      {
        id: "q1",
        statement: "O que e o Amazon S3?",
        options: [
          { key: "A", text: "Servico de fila" },
          { key: "B", text: "Servico de armazenamento de objetos" },
        ],
        correctKey: "B",
        explanation: "S3 e um servico de armazenamento de objetos.",
      },
    ],
  });
});

afterEach(() => cleanup());

describe("TrailStudyFlow — review after failing (#37)", () => {
  it("keeps the explanation visible when the user re-reads it after failing", async () => {
    render(
      <TrailStudyFlow
        chainId="chain-1"
        stage={{ id: "stage-1", title: "S3" }}
        onClose={vi.fn()}
        onCompleted={vi.fn()}
      />,
    );

    await screen.findByText("Conteudo explicativo do estagio");
    fireEvent.click(screen.getByText("Estou pronto — Iniciar Quiz"));

    await screen.findByText("O que e o Amazon S3?");
    fireEvent.click(screen.getByLabelText(/Servico de fila/i)); // wrong answer
    fireEvent.click(screen.getByText("Confirmar"));
    fireEvent.click(screen.getByText("Ver resultado"));

    await screen.findByText("0/1 corretas");

    // Bug: this used to render a blank card because markdown was hardcoded to "".
    fireEvent.click(screen.getByText("Reler explicação"));
    await waitFor(() => expect(screen.getByText("Conteudo explicativo do estagio")).toBeTruthy());
  });

  it("shows the attempt's questions and the user's answer when reviewing a failed quiz", async () => {
    render(
      <TrailStudyFlow
        chainId="chain-1"
        stage={{ id: "stage-1", title: "S3" }}
        onClose={vi.fn()}
        onCompleted={vi.fn()}
      />,
    );

    await screen.findByText("Conteudo explicativo do estagio");
    fireEvent.click(screen.getByText("Estou pronto — Iniciar Quiz"));

    await screen.findByText("O que e o Amazon S3?");
    fireEvent.click(screen.getByLabelText(/Servico de fila/i)); // wrong answer
    fireEvent.click(screen.getByText("Confirmar"));
    fireEvent.click(screen.getByText("Ver resultado"));

    await screen.findByText("0/1 corretas");
    fireEvent.click(screen.getByText("Rever tentativa"));

    // The failed attempt's question, the user's wrong pick, and the explanation must all resurface.
    await screen.findByText("O que e o Amazon S3?");
    expect(screen.getByText("S3 e um servico de armazenamento de objetos.")).toBeTruthy();
    expect(screen.getByText(/Incorreto/)).toBeTruthy();
  });
});
