"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { FileUp } from "lucide-react";

type Props = {
  label: string;
  accept: string;
  hint: string;
  busy?: boolean;
  error?: string | null;
  status?: string;
  onFile: (file: File) => void;
  children?: (controls: { openFilePicker: () => void }) => ReactNode;
};

export function FileDropzone({ label, accept, hint, busy = false, error, status, onFile, children }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [dragging, setDragging] = useState(false);
  const openFilePicker = () => inputRef.current?.click();

  function selectFile(file?: File) {
    if (file && !busy) onFile(file);
  }

  return (
    <div className="space-y-2 text-sm">
      <label className="block text-xs font-medium text-[#cbd5e1]" htmlFor={inputId}>{label}</label>
      <div
        onDragEnter={event => { event.preventDefault(); setDragging(true); }}
        onDragOver={event => event.preventDefault()}
        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
        onDrop={event => { event.preventDefault(); setDragging(false); selectFile(event.dataTransfer.files[0]); }}
        className={`relative overflow-hidden border border-dashed bg-[#0b1220] transition-colors ${dragging ? "border-[#19e26d] bg-[#19e26d]/10" : "border-[#334155] hover:border-[#64748b]"} ${busy ? "opacity-70" : ""}`}
      >
        {children ? (
          // ponytail: false positive — openFilePicker is only invoked later by the consumer's event handler, never during this render.
          // eslint-disable-next-line react-hooks/refs
          children({ openFilePicker })
        ) : (
          <button type="button" onClick={openFilePicker} disabled={busy} className="flex min-h-36 w-full flex-col items-center justify-center gap-2 px-4 py-6 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[#19e26d]">
            <span className="grid size-11 place-items-center border border-[#334155] bg-[#111c2e] text-[#19e26d]"><FileUp size={21} /></span>
            <span className="font-medium text-[#e2e8f0]">{busy ? "Processando arquivo…" : "Solte o arquivo aqui"}</span>
            <span className="text-xs text-[#94a3b8]">ou <span className="text-[#19e26d] underline underline-offset-4">escolha no dispositivo</span></span>
          </button>
        )}
        <input id={inputId} ref={inputRef} type="file" accept={accept} disabled={busy} className="sr-only" onChange={event => { selectFile(event.target.files?.[0]); event.currentTarget.value = ""; }} />
      </div>
      <p className="text-[11px] text-[#64748b]">{hint}</p>
      {status && <p role="status" className="text-xs text-[#94a3b8]">{status}</p>}
      {error && <p role="alert" className="whitespace-pre-line text-xs text-red-400">{error}</p>}
    </div>
  );
}
