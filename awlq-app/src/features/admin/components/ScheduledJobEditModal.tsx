"use client";

import { useEffect, useState } from "react";
import {
  cronToScheduleForm,
  DAY_SHORT,
  parseCronToHuman,
  ScheduleForm,
  scheduleFormToCron,
} from "@/lib/cron-utils";

type ScheduledJob = {
  id: string;
  jobId: string;
  name: string;
  description: string | null;
  queue: string;
  cronPattern: string;
  active: boolean;
  updatedAt: string;
};

type Props = {
  job: ScheduledJob | null;
  onClose: () => void;
  onSaved: () => void;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

export function ScheduledJobEditModal({ job, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [form, setForm] = useState<ScheduleForm>({ frequency: "daily", hour: 0, minute: 0, dayOfWeek: 0, custom: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!job) return;
    setName(job.name);
    setForm(cronToScheduleForm(job.cronPattern));
    setError(null);
  }, [job]);

  if (!job) return null;

  const previewCron = scheduleFormToCron(form);
  const preview = parseCronToHuman(previewCron);

  async function handleSave() {
    if (!job) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/scheduled-jobs/${job.jobId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, cronPattern: previewCron }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Falha ao salvar.");
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <div className="w-full max-w-lg space-y-5 rounded border border-[#334155] bg-[#111827] p-5 text-[#e2e8f0]">
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs uppercase text-[#f97316]">Editar Agendamento</p>
          <button type="button" onClick={onClose} className="border border-[#334155] px-3 py-1 text-xs uppercase">
            Fechar
          </button>
        </div>

        <label className="block space-y-1">
          <span className="text-xs uppercase text-[#94a3b8]">Nome do job</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm"
          />
        </label>

        <div className="space-y-3">
          <p className="text-xs uppercase text-[#94a3b8]">Frequencia</p>
          <div className="grid grid-cols-4 gap-2">
            {(["hourly", "daily", "weekly", "custom"] as const).map((freq) => (
              <button
                key={freq}
                type="button"
                onClick={() => setForm((f) => ({ ...f, frequency: freq }))}
                className={`border px-3 py-1.5 text-xs uppercase ${
                  form.frequency === freq
                    ? "border-[#f97316] bg-[#7c2d12]/30 text-[#f97316]"
                    : "border-[#334155] text-[#94a3b8] hover:border-[#475569]"
                }`}
              >
                {freq === "hourly" ? "Horario" : freq === "daily" ? "Diario" : freq === "weekly" ? "Semanal" : "Custom"}
              </button>
            ))}
          </div>
        </div>

        {form.frequency !== "hourly" && form.frequency !== "custom" && (
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs uppercase text-[#94a3b8]">Hora (UTC)</span>
              <select
                value={form.hour}
                onChange={(e) => setForm((f) => ({ ...f, hour: parseInt(e.target.value, 10) }))}
                className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs uppercase text-[#94a3b8]">Minuto</span>
              <select
                value={MINUTES.includes(form.minute) ? form.minute : 0}
                onChange={(e) => setForm((f) => ({ ...f, minute: parseInt(e.target.value, 10) }))}
                className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm"
              >
                {MINUTES.map((m) => (
                  <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        {form.frequency === "hourly" && (
          <label className="block space-y-1">
            <span className="text-xs uppercase text-[#94a3b8]">Minuto de cada hora</span>
            <select
              value={MINUTES.includes(form.minute) ? form.minute : 0}
              onChange={(e) => setForm((f) => ({ ...f, minute: parseInt(e.target.value, 10) }))}
              className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm"
            >
              {MINUTES.map((m) => (
                <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
              ))}
            </select>
          </label>
        )}

        {form.frequency === "weekly" && (
          <div className="space-y-1">
            <p className="text-xs uppercase text-[#94a3b8]">Dia da semana</p>
            <div className="flex gap-2">
              {DAY_SHORT.map((label, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, dayOfWeek: index }))}
                  className={`rounded border px-2 py-1 text-xs ${
                    form.dayOfWeek === index
                      ? "border-[#f97316] bg-[#7c2d12]/30 text-[#f97316]"
                      : "border-[#334155] text-[#94a3b8] hover:border-[#475569]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {form.frequency === "custom" && (
          <label className="block space-y-1">
            <span className="text-xs uppercase text-[#94a3b8]">Expressao cron (5 campos)</span>
            <input
              value={form.custom}
              onChange={(e) => setForm((f) => ({ ...f, custom: e.target.value }))}
              placeholder="0 5 * * *"
              className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 font-mono text-sm"
            />
          </label>
        )}

        <div className="rounded border border-[#1e3a5f] bg-[#0b1220] px-3 py-2">
          <p className="text-[10px] uppercase text-[#475569]">Preview</p>
          <p className="mt-1 text-sm text-[#38bdf8]">{preview}</p>
          <p className="mt-0.5 font-mono text-[10px] text-[#475569]">{previewCron}</p>
        </div>

        {error && <p className="text-sm text-[#fca5a5]">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-[#1e293b] pt-3">
          <button type="button" onClick={onClose} className="border border-[#334155] px-4 py-2 text-xs uppercase">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="border border-[#14532d] bg-green-900/20 px-4 py-2 text-xs uppercase text-green-200 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
