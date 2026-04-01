"use client";

import { useId } from "react";

type SimuladoScoreGaugeProps = {
  points: number;
  maxPoints?: number;
  minimumCertificationPoints?: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function SimuladoScoreGauge({
  points,
  maxPoints = 1000,
  minimumCertificationPoints = 700,
}: SimuladoScoreGaugeProps) {
  const uniqueId = useId().replace(/:/g, "");
  const gradientId = `retroGaugeGradient-${uniqueId}`;

  const safeMaxPoints = Math.max(1, maxPoints);
  const safePoints = clamp(points, 0, safeMaxPoints);
  const progress = clamp(safePoints / safeMaxPoints, 0, 1);
  const thresholdProgress = clamp(minimumCertificationPoints / safeMaxPoints, 0, 1);

  const gaugeCenterX = 160;
  const gaugeCenterY = 160;
  const gaugeRadius = 120;
  const gaugeNeedleRadius = 96;

  const needleRadians = Math.PI * (1 - progress);
  const thresholdRadians = Math.PI * (1 - thresholdProgress);
  const needleX = gaugeCenterX + Math.cos(needleRadians) * gaugeNeedleRadius;
  const needleY = gaugeCenterY - Math.sin(needleRadians) * gaugeNeedleRadius;
  const thresholdX = gaugeCenterX + Math.cos(thresholdRadians) * gaugeRadius;
  const thresholdY = gaugeCenterY - Math.sin(thresholdRadians) * gaugeRadius;

  return (
    <div className="border border-[var(--pixel-border)] bg-[repeating-linear-gradient(45deg,rgba(148,163,184,0.07),rgba(148,163,184,0.07)_8px,rgba(15,23,42,0.22)_8px,rgba(15,23,42,0.22)_16px)] p-3 sm:p-4">
      <div className="mx-auto w-full max-w-[34rem] overflow-hidden">
        <div className="relative">
          <svg viewBox="0 0 320 210" className="h-auto w-full" role="img" aria-label="Velocimetro de pontuacao">
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#b91c1c" />
                <stop offset="40%" stopColor="#f59e0b" />
                <stop offset="72%" stopColor="#84cc16" />
                <stop offset="100%" stopColor="#22c55e" />
              </linearGradient>
            </defs>

            <path d="M 40 160 A 120 120 0 0 1 280 160" stroke="rgba(148,163,184,0.2)" strokeWidth="26" fill="none" />
            <path d="M 40 160 A 120 120 0 0 1 280 160" stroke={`url(#${gradientId})`} strokeWidth="20" fill="none" />

            <line
              x1={gaugeCenterX}
              y1={gaugeCenterY}
              x2={thresholdX}
              y2={thresholdY}
              stroke="#fca5a5"
              strokeWidth="2"
              strokeDasharray="4 4"
            />

            <line
              x1={gaugeCenterX}
              y1={gaugeCenterY}
              x2={needleX}
              y2={needleY}
              stroke="#f8fafc"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <circle cx={gaugeCenterX} cy={gaugeCenterY} r="8" fill="#e2e8f0" stroke="#0f172a" strokeWidth="2" />

            <text x="40" y="184" textAnchor="middle" className="fill-[var(--pixel-subtext)] text-[10px] font-mono">
              0
            </text>
            <text x="280" y="184" textAnchor="middle" className="fill-[var(--pixel-subtext)] text-[10px] font-mono">
              {safeMaxPoints}
            </text>
            <text x={thresholdX} y={thresholdY - 8} textAnchor="middle" className="fill-red-300 text-[10px] font-mono">
              {minimumCertificationPoints}
            </text>
          </svg>

          <div className="pointer-events-none absolute inset-x-0 bottom-1 text-center">
            <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Pontuacao</p>
            <p className="font-mono text-xl text-[var(--pixel-text)] sm:text-2xl">
              {safePoints}
              <span className="text-xs text-[var(--pixel-subtext)] sm:text-sm"> / {safeMaxPoints}</span>
            </p>
          </div>
        </div>
      </div>

      <p className="text-center font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
        Corte de certificacao marcado em vermelho: {minimumCertificationPoints} pontos.
      </p>
    </div>
  );
}
