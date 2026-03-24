"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getAdminStatus } from "@/features/admin/services/admin-api";
import { useAuth } from "@/hooks/useAuth";

const ADMIN_MENU = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/upload", label: "Upload PDF" },
  { href: "/admin/uploads", label: "Historico Uploads" },
  { href: "/admin/users", label: "Usuarios" },
  { href: "/admin/questions", label: "Banco de Questoes" },
];

export function AdminShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { signOut } = useAuth();

  useEffect(() => {
    async function bootstrap() {
      try {
        await getAdminStatus();
        setAuthorized(true);
      } catch {
        setAuthorized(false);
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0f1720] px-6 text-[#e7edf4]">
        <p className="font-mono text-xs uppercase">Validando acesso admin...</p>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0f1720] px-6 text-[#e7edf4]">
        <div className="w-full max-w-lg space-y-4 border border-[#334155] bg-[#111827] p-6">
          <p className="font-mono text-xs uppercase text-[#f97316]">Acesso negado</p>
          <p className="font-[var(--font-body)] text-sm leading-6 text-[#cbd5e1]">
            Esta area e exclusiva para administradores. Entre com uma conta admin para continuar.
          </p>
          <div className="flex gap-3">
            <Link href="/admin/login" className="border border-[#f97316] px-3 py-2 text-xs uppercase text-[#f97316]">
              Login admin
            </Link>
            <Link href="/" className="border border-[#334155] px-3 py-2 text-xs uppercase text-[#e2e8f0]">
              Voltar
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1220] text-[#e2e8f0]">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#1e293b] bg-[#0f172a]/95 px-4 py-3 backdrop-blur lg:hidden">
        <p className="font-mono text-xs uppercase text-[#f97316]">Admin Console</p>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="border border-[#334155] px-3 py-2 text-xs uppercase"
          aria-label="Abrir menu lateral"
          aria-expanded={mobileMenuOpen}
        >
          Menu
        </button>
      </header>

      <div className="mx-auto flex min-h-screen">
        {mobileMenuOpen && (
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            aria-label="Fechar menu lateral"
          />
        )}

        <aside
          className={[
            "fixed inset-y-0 left-0 z-50 w-72 border-r border-[#1e293b] bg-[#0f172a] transition-transform duration-200 lg:sticky lg:top-0 lg:z-20 lg:h-screen lg:translate-x-0",
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
          ].join(" ")}
        >
          <div className="flex h-full flex-col p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-xs uppercase text-[#f97316]">Admin Console</p>
                <p className="mt-2 text-xs text-[#94a3b8]">Gerencie usuarios, questoes e ingestao de simulados.</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="border border-[#334155] px-2 py-1 text-[10px] uppercase lg:hidden"
              >
                Fechar
              </button>
            </div>

            <nav className="mt-6 flex-1 space-y-2 overflow-y-auto pr-1">
              {ADMIN_MENU.map((item) => {
                const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      "block border px-3 py-2 text-xs uppercase transition-colors",
                      active
                        ? "border-[#f97316] bg-[#1f2937] text-[#f97316]"
                        : "border-[#1e293b] text-[#cbd5e1] hover:border-[#334155] hover:bg-[#111827]",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                );
              })}

              <button
                className="flex w-full cursor-pointer border border-red-500/40 px-3 py-2 text-xs uppercase transition-colors hover:border-red-500/80 hover:bg-[#111827]"
                onClick={signOut}
              >
                Sair
              </button>
            </nav>
          </div>
        </aside>

        <section className="flex-1 p-4 sm:p-6 lg:p-8">{children}</section>
      </div>
    </div>
  );
}
