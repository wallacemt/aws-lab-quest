"use client";

import { useEffect, useState } from "react";
import { Cloud, Swords } from "lucide-react";

const MESSAGES = [
  "INVOCANDO O BOSS...",
  "CARREGANDO ARSENAL AWS...",
  "AFIANDO AS ESPADAS...",
  "CONSULTANDO A CLOUD...",
  "PREPARANDO A ARENA...",
];

export function ArenaLoading() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % MESSAGES.length);
    }, 1400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="flex flex-col items-center gap-4 border-2 border-[#f97316] bg-[#0f172a] p-8">
        <div className="relative flex h-20 w-20 items-center justify-center border-2 border-[#f97316] bg-[#1e293b]">
          <Swords className="h-10 w-10 animate-pulse text-[#f97316]" />
          <Cloud className="absolute -right-3 -top-3 h-6 w-6 text-[#38bdf8]" />
        </div>
        <p className="font-mono text-xs uppercase tracking-widest text-[#f97316]">
          {MESSAGES[messageIndex]}
          <span className="animate-blink ml-1 inline-block h-4 w-2 align-middle bg-[#f97316]" />
        </p>
      </div>
    </div>
  );
}
