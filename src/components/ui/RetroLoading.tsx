import { Loader2 } from "lucide-react";
import appLogo from "@/assets/logo.png";
import Image from "next/image";

export default function RetroLoading() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm px-4">
      <div className="bg-pixel-card retro-border border-4 retro-shadow p-8 max-w-sm w-full flex flex-col items-center relative overflow-hidden">
        <div className="mb-3 flex justify-center">
          <Image
            src={appLogo}
            alt="AWS Lab Quest logo"
            width={124}
            height={124}
            priority
            className="h-auto w-28 sm:w-32"
          />
        </div>
        {/* Decorative background elements */}
        <div className="absolute -right-10 -top-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl" />
        <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-accent/10 rounded-full blur-2xl" />

        <div className="relative z-10 flex flex-col items-center w-full">
          <h2 className="font-mono text-xl md:text-2xl font-bold text-pixel-text uppercase tracking-widest mb-6 animate-pulse">
            Loading...
          </h2>

          {/* Retro Progress Bar */}
          <div className="w-full h-6 retro-border border-2 bg-pixel-muted p-0.5 relative">
            <div className="h-full bg-accent retro-progress" />
          </div>
        </div>
        <style>{`
        @keyframes retro-progress {
          0% { width: 0%; }
          20% { width: 20%; }
          25% { width: 20%; }
          40% { width: 50%; }
          60% { width: 50%; }
          80% { width: 80%; }
          90% { width: 80%; }
          100% { width: 100%; }
        }
        .retro-progress {
          animation: retro-progress 3s ease-in-out infinite;
        }
      `}</style>
      </div>
    </div>
  );
}
