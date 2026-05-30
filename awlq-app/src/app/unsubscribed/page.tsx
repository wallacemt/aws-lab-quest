import Link from "next/link";

export const metadata = {
  title: "Descadastro de E-mails",
  robots: { index: false },
};

export default function UnsubscribedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--pixel-bg)] px-4 py-12">
      <div className="w-full max-w-md space-y-5 border-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] p-6 text-center shadow-[6px_6px_0_0_var(--pixel-shadow)]">
        <h1 className="font-mono text-sm uppercase text-[var(--pixel-primary)]">Descadastro realizado</h1>
        <p className="font-sans text-sm text-[var(--pixel-text)]">
          Voce foi removido da lista de e-mails de engajamento. Voce continuara recebendo apenas e-mails
          transacionais essenciais (ex: recuperacao de senha).
        </p>
        <p className="font-sans text-sm text-[var(--pixel-subtext)]">
          Se foi um engano, acesse seu perfil e ative as notificacoes novamente.
        </p>
        <Link
          href="/login"
          className="inline-block border-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] px-4 py-2 font-mono text-xs uppercase hover:bg-[var(--pixel-muted)]"
        >
          Voltar ao login
        </Link>
      </div>
    </div>
  );
}
