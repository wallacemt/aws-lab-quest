import { TaskCard } from "@/components/ui/task-card";
import { Task } from "@/lib/types";

export function TasksBoard({
  tasks,
  completedCount,
  onToggle,
}: {
  tasks: Task[];
  completedCount: number;
  onToggle: (taskId: number, checked: boolean) => void;
}) {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="font-[var(--font-pixel)] text-xs uppercase text-[var(--pixel-primary)]">Suas Missoes</h2>
        <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
          {completedCount} / {tasks.length} tarefas concluidas
        </p>
      </div>

      <div className="space-y-4">
        <div className="h-3 overflow-hidden border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-[2px]">
          <div
            className="h-full bg-[var(--pixel-primary)] transition-all duration-300"
            style={{ width: `${tasks.length ? (completedCount / tasks.length) * 100 : 0}%` }}
          />
        </div>

        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(360px,1fr))]">
          {tasks.map((task, index) => (
            <div key={task.id} className="relative pt-4">
              <span className="absolute left-3 top-0 z-10 inline-flex h-8 w-8 items-center justify-center border-2 border-[var(--pixel-border)] bg-[var(--pixel-primary)] font-[var(--font-pixel)] text-[10px] text-black shadow-[2px_2px_0_0_var(--pixel-shadow)]">
                {index + 1}
              </span>
              <TaskCard task={task} index={index} onToggle={onToggle} />
            </div>
          ))}
        </div>

        <div className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] p-3 text-center shadow-[4px_4px_0_0_var(--pixel-shadow)]">
          <p className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-accent)]">Chegada da Trilha</p>
          <p className="mt-1 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
            Complete todas as etapas para desbloquear a celebracao final.
          </p>
        </div>
      </div>
    </section>
  );
}
