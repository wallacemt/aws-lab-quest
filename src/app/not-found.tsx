import { AlertTriangle, Home } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
      <div className="bg-pixel-card retro-border border-4 retro-shadow p-8 max-w-md w-full flex flex-col items-center relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute -right-10 -top-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl" />
        <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-accent/10 rounded-full blur-2xl" />

        <div className="relative z-10 flex flex-col items-center">
          <div className="w-20 h-20 bg-primary retro-border border-4 flex items-center justify-center mb-6 animate-pulse retro-shadow-sm">
            <AlertTriangle className="w-10 h-10 text-white" />
          </div>
          
          <h1 className="font-mono text-6xl md:text-7xl font-bold text-pixel-text mb-2 tracking-tighter">
            404
          </h1>
          
          <h2 className="font-mono text-xl md:text-2xl font-bold text-pixel-text uppercase tracking-widest mb-4">
           Não encontrado!
          </h2>
          
          <div className="w-full h-1 bg-pixel-border/10 rounded-full mb-4" />
          
          <p className="text-pixel-subtext mb-8 text-sm md:text-base leading-relaxed">
            Opps! O Modo que você tentou acessar não foi encontrado ou está corrompido. Sopre a fita e tente novamente.
          </p>
          
          <Link 
            href="/"
            className="retro-btn bg-accent text-white retro-border border-2 retro-shadow-sm px-6 py-3 font-mono font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-accent/90 active:scale-95 w-full justify-center"
          >
            <Home className="w-5 h-5" />
            Voltar ao Início
          </Link>
        </div>
      </div>
    </div>
  );
}
