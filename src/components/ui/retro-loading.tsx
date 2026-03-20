import { useState, useEffect } from "react";
import { Gamepad2 } from "lucide-react";

const LOADING_MESSAGES = [
  "CARREGANDO CARTUCHO...",
  "SOPRANDO A FITA...",
  "CONECTANDO AO SERVIDOR...",
  "GERANDO MUNDO...",
  "QUASE LÁ...",
];

export default function RetroLoading() {
  const [messageIndex, setMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  // Texto rotativo
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // Progresso real
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100;
        return prev + 10;
      });
    }, 300);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/90 backdrop-blur-md px-4 overflow-hidden">
      
      {/* Scanlines */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] opacity-20" />

      <div className="bg-pixel-card retro-border border-4 retro-shadow p-8 max-w-sm w-full flex flex-col items-center relative animate-float">
        
        {/* Glow */}
        <div className="absolute -right-10 -top-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-accent/20 rounded-full blur-3xl animate-pulse delay-1000" />

        {/* Conteúdo */}
        <div className="relative z-10 flex flex-col items-center w-full">
          
          {/* Ícone */}
          <div className="relative mb-8">
            <div className="w-20 h-20 bg-primary retro-border border-4 flex items-center justify-center retro-shadow-sm animate-bounce-slow relative overflow-hidden">
              <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12" />
              <Gamepad2 className="w-10 h-10 text-white relative z-10" />
            </div>

            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-12 h-2 bg-black/20 rounded-full blur-sm animate-shadow-pulse" />
          </div>

          {/* Texto */}
          <div className="h-8 mb-4 flex items-center justify-center w-full">
            <h2 className="font-mono text-sm md:text-base font-bold text-pixel-text uppercase tracking-widest text-center">
              {LOADING_MESSAGES[messageIndex]}
              <span className="animate-blink inline-block w-2 h-4 bg-primary ml-1 align-middle" />
            </h2>
          </div>

          {/* % */}
          <div className="text-xs font-mono text-muted-foreground mb-2">
            {progress}%
          </div>

          {/* Barra */}
          <div className="w-full flex gap-1 h-5 p-1 retro-border border-2 bg-pixel-border">
            {[...Array(10)].map((_, i) => {
              const filled = progress >= (i + 1) * 10;

              return (
                <div
                  key={i}
                  className={`flex-1 h-full transition-all duration-300 ${
                    filled ? "bg-accent opacity-100 scale-100" : "opacity-20 scale-90"
                  }`}
                />
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }

        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        @keyframes shadow-pulse {
          0%, 100% { transform: translateX(-50%) scale(1); opacity: 0.5; }
          50% { transform: translateX(-50%) scale(0.8); opacity: 0.2; }
        }

        @keyframes blink {
          50% { opacity: 0; }
        }

        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }

        .animate-float { animation: float 4s ease-in-out infinite; }
        .animate-bounce-slow { animation: bounce-slow 2s ease-in-out infinite; }
        .animate-shadow-pulse { animation: shadow-pulse 2s ease-in-out infinite; }
        .animate-blink { animation: blink 1s step-end infinite; }
        .animate-shimmer {
          animation: shimmer 1s infinite;
        }
      `}</style>
    </div>
  );
}