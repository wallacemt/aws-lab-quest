"use client";
import { useEffect, useRef, useState } from "react";
import { readQuestionFile, type ImportItem } from "@/lib/question-import";

export function QuestionJsonUpload({ onChange, min = 1, max = 200 }: {
  onChange: (questions: ImportItem[] | null) => void; min?: number; max?: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);
  return <div className="space-y-2 text-sm">
    <label className="block space-y-2">
      <span>Arquivo JSON de questões ({min}–{max} questões, até 2 MB)</span>
      <input type="file" accept=".json,application/json" className="block w-full" onChange={async event => {
        const current = ++request.current;
        const file = event.target.files?.[0];
        onChange(null); setError(null); setStatus("");
        if (!file) return;
        setStatus("Validando arquivo…");
        try {
          const questions = await readQuestionFile(file);
          if (questions.length < min || questions.length > max) throw new Error(`Selecione um arquivo com ${min} a ${max} questões.`);
          if (current !== request.current) return;
          onChange(questions); setStatus(`${questions.length} questões válidas. Revise antes de salvar.`);
        } catch (err) {
          if (current !== request.current) return;
          setStatus(""); setError(err instanceof Error ? err.message : "Não foi possível ler o arquivo.");
        }
      }} />
    </label>
    <p role="status">{status}</p>
    {error && <p role="alert" className="whitespace-pre-line text-red-400">{error}</p>}
  </div>;
}
