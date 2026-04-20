import { Suspense } from "react";
import { ResetPasswordScreen } from "@/features/auth/screens/ResetPasswordScreen";

function ResetPasswordFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--pixel-bg)] px-4 py-12">
      <p className="font-mono text-xs uppercase text-[var(--pixel-subtext)]">Carregando...</p>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordScreen />
    </Suspense>
  );
}
