"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

type LandingUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
} | null;

type Props = {
  user: LandingUser;
};

export function LandingHeader({ user }: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/");
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 backdrop-blur-md bg-black/40 border-b border-white/10">
      {/* Left: Logo */}
      <Link href="/" className="flex items-center gap-3 relative">
        <div>
          <Image src="/logo.png" alt="AWS Quest logo" height={60} width={60} className="h-12 w-12" />
        </div>
        <span className="hidden sm:block font-mono text-base font-bold tracking-wider">
          AWSL<span style={{ color: "var(--pixel-primary, #f97316)" }}>Q</span>
        </span>
      </Link>

      {/* Right */}
      {user ? (
        <div className="relative flex items-center gap-3">
          <Link
            href="/home"
            className="hidden sm:flex items-center gap-2 border border-[var(--pixel-primary,#f97316)] px-3 py-1.5 font-mono text-[10px] uppercase text-[var(--pixel-primary,#f97316)] hover:bg-[var(--pixel-primary,#f97316)]/10 transition-colors"
          >
            Ir para o App
          </Link>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="h-9 w-9 overflow-hidden border-2 border-white/30 hover:border-[var(--pixel-primary,#f97316)] transition-colors"
          >
            {user.image ? (
              <Image src={user.image} alt={user.name} width={36} height={36} className="h-full w-full object-cover" />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center font-mono text-sm font-bold"
                style={{ background: "var(--pixel-card,#0d1a2d)" }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-12 min-w-[160px] border border-white/20 shadow-xl"
              style={{ background: "var(--pixel-card,#0d1a2d)" }}
            >
              <Link
                href="/profile"
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-2.5 font-mono text-[10px] uppercase text-white/80 hover:bg-white/10"
              >
                Meu Perfil
              </Link>
              <Link
                href="/home"
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-2.5 font-mono text-[10px] uppercase text-white/80 hover:bg-white/10"
              >
                Ir para o App
              </Link>
              <button
                onClick={handleSignOut}
                className="block w-full px-4 py-2.5 text-left font-mono text-[10px] uppercase text-red-400 hover:bg-white/10"
              >
                Sair
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="border border-white/30 px-3 py-1.5 font-mono text-[10px] uppercase text-white/80 hover:border-white/60 hover:text-white transition-colors"
          >
            Entrar
          </Link>
          <Link
            href="/register"
            className="border px-3 py-1.5 font-mono text-[10px] uppercase transition-colors"
            style={{
              borderColor: "var(--pixel-primary,#f97316)",
              color: "var(--pixel-primary,#f97316)",
            }}
          >
            Criar Conta
          </Link>
        </div>
      )}
    </header>
  );
}
