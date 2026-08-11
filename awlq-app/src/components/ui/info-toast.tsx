"use client";

type Props = {
  message: string;
  icon?: string;
};

export function InfoToast({ message, icon = "✅" }: Props) {
  return (
    <div className="flex items-center gap-3 border-2 border-[var(--pixel-primary)] bg-[var(--pixel-card)] px-4 py-3 shadow-[4px_4px_0_0_#000]">
      <span className="text-xl">{icon}</span>
      <p className="font-mono text-xs uppercase text-[var(--pixel-text)]">{message}</p>
    </div>
  );
}
