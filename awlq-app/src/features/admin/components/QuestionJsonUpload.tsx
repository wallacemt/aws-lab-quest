"use client";
import { useEffect, useRef, useState } from "react";
import { readQuestionFile, type ImportItem } from "@/lib/question-import";
import { FileDropzone } from "./FileDropzone";

export function QuestionJsonUpload({ onChange, min = 1, max = 200 }: {
  onChange: (questions: ImportItem[] | null) => void; min?: number; max?: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [fileName, setFileName] = useState("");
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);
  return <FileDropzone label={`Arquivo JSON de questões (${min}–${max} questões, até 2 MB)`} accept=".json,application/json" hint="Arquivo JSON · até 2 MB" status={status || fileName} error={error} onFile={async file => {
        const current = ++request.current;
        onChange(null); setError(null); setStatus(""); setFileName(file.name);
        setStatus("Validando arquivo…");
        try {
          const questions = await readQuestionFile(file);
          if (questions.length < min || questions.length > max) throw new Error(`Selecione um arquivo com ${min} a ${max} questões.`);
          if (current !== request.current) return;
          onChange(questions); setStatus(`${file.name} · ${questions.length} questões válidas. Revise antes de salvar.`);
        } catch (err) {
          if (current !== request.current) return;
          setStatus(""); setError(err instanceof Error ? err.message : "Não foi possível ler o arquivo.");
        }
      }} />;
}
