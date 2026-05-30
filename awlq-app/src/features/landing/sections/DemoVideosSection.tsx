"use client";

const DEMOS = [
  { id: "QdR2LqiS4sQ", title: "Lab Quest — Como Funciona", step: "01", desc: "Veja como completar uma missao pratica e ganhar XP." },
  { id: "6Ij6GgQjoLQ", title: "Knowledge Check", step: "02", desc: "Revisao rapida por topico com feedback instantaneo." },
  { id: "f1vfjb_ZEJs", title: "Simulado Completo", step: "03", desc: "Prova cronometrada com scoring detalhado por dominio." },
];

export function DemoVideosSection() {
  return (
    <section className="landing-section landing-section-img relative overflow-hidden">
      {/* Pixel art background */}
      <div
        className="landing-section-bg"
        style={{ backgroundImage: "url('/backgrounds/px-city-5.png')" }}
      />
      {/* Dark overlay */}
      <div className="landing-section-overlay" style={{ background: "rgba(5,10,20,0.86)" }} />

      <div className="relative z-10 mx-auto max-w-5xl space-y-14">
        <div className="text-center">
          <p
            className="mb-3 font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "var(--pixel-primary,#f97316)" }}
          >
            {`// VER PARA CRER`}
          </p>
          <h2 className="font-mono text-2xl font-bold uppercase tracking-wide text-white md:text-3xl">
            O app em acao
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-white/60">
            Tres minutos de video valem mais do que mil palavras de descricao.
            Veja como funciona antes de criar sua conta.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {DEMOS.map((demo) => (
            <div key={demo.id} className="space-y-4">
              <div className="flex items-center gap-3">
                <span
                  className="font-mono text-3xl font-bold tabular-nums leading-none"
                  style={{ color: "rgba(249,115,22,0.25)" }}
                >
                  {demo.step}
                </span>
                <div>
                  <p className="font-mono text-xs font-bold uppercase text-white">{demo.title}</p>
                  <p className="font-mono text-[10px] text-white/45 mt-0.5">{demo.desc}</p>
                </div>
              </div>
              <div className="crt-frame overflow-hidden" style={{ aspectRatio: "16/9" }}>
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${demo.id}?rel=0`}
                  title={demo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full border-0"
                  style={{ position: "relative", zIndex: 2 }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
