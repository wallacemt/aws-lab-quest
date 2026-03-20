import { PixelCard } from "@/components/ui/PixelCard";
import { QuestHistoryItem } from "@/lib/types";

export function QuestHistory({ history }: { history: QuestHistoryItem[] }) {
  return (
    <PixelCard className="space-y-3">
      <h2 className="font-[var(--font-pixel)] text-xs uppercase text-[var(--pixel-accent)]">Historico</h2>
      {history.length === 0 ? (
        <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">Nenhum quest finalizado ainda.</p>
      ) : (
        <ul className="space-y-2">
          {history.map((item) => (
            <li key={item.id} className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] p-2">
              <p className="font-[var(--font-body)] text-sm">
                {item.title} - {item.xp} XP
              </p>
              <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                {item.userName} | {item.certification} | {new Date(item.completedAt).toLocaleDateString("pt-BR")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </PixelCard>
  );
}
