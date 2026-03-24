"use client";

import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { getOnboardingStep, setOnboardingStep } from "@/lib/onboarding";
import { CreatorCredits } from "@/components/ui/creator-credits";

const manualSections = [
  {
    title: "1. Comece pelo perfil",
    objective: "Preencha nome, certificacao AWS alvo e tema favorito para destravar a experiencia completa.",
    howTo: [
      "Acesse a aba de perfil assim que terminar este manual.",
      "Informe o nome que vai aparecer no ranking e no historico.",
      "Escolha a certificacao que voce esta perseguindo para deixar sua jornada contextualizada.",
      "Defina um tema favorito para gerar quests mais alinhadas ao seu estilo.",
    ],
    bestExperience:
      "Quanto mais claro estiver seu perfil, mais consistente fica a experiencia entre quests, badges e historico.",
  },
  {
    title: "2. Gere quests com contexto real",
    objective: "Transforme um lab AWS em uma sequencia de tarefas gamificadas.",
    howTo: [
      "Na Home, cole um texto de laboratorio AWS com objetivos, etapas e servicos envolvidos.",
      "Use um tema que faca sentido para voce ou mantenha o tema favorito salvo no perfil.",
      "Revise o texto antes de enviar para evitar entradas vagas ou incompletas.",
    ],
    bestExperience:
      "Use labs com passos claros e servicos especificos. Isso gera quests mais coerentes e evita desperdicio de tokens.",
  },
  {
    title: "3. Execute uma quest por vez",
    objective: "Concluir cada jornada sem perder progresso nem contexto.",
    howTo: [
      "Abra a quest gerada e avance tarefa por tarefa.",
      "Se precisar interromper, volte depois e continue a quest atual em vez de gerar outra.",
      "Marque as tarefas conforme concluir para acumular XP corretamente.",
    ],
    bestExperience:
      "Terminar a quest em andamento antes de criar outra evita retrabalho e reduz consumo desnecessario de geracao.",
  },
  {
    title: "4. Acompanhe sua evolucao",
    objective: "Usar historico, leaderboard em tempo real, badges e conquistas para medir progresso.",
    howTo: [
      "Consulte o historico para revisar quests concluidas e XP acumulado.",
      "Use o leaderboard para comparar consistencia de estudo com outros jogadores em tempo real.",
      "Acompanhe o contador de usuarios online no cabecalho quando houver mais de 1 jogador ativo.",
      "Confira badges e a pagina de conquistas para planejar os proximos desbloqueios.",
      "Compartilhe badges e conquistas desbloqueadas com links publicos.",
    ],
    bestExperience:
      "Volte ao historico depois de cada sessao de estudo para identificar temas recorrentes e manter ritmo de pratica.",
  },
  {
    title: "5. Simulado com guia oficial",
    objective: "Garantir que os simulados sigam o exam guide oficial da certificacao alvo.",
    howTo: [
      "No admin, envie primeiro o PDF do Exam Guide da certificacao.",
      "Se o PDF for escaneado e sem texto selecionavel, use o campo de fallback manual.",
      "Somente apos salvar o exam guide, envie os PDFs de simulados para gerar questoes.",
      "No fim do simulado, revise os pontos de fraqueza por servico para evolucao direcionada.",
    ],
    bestExperience:
      "Sempre mantenha o exam guide atualizado para que a geracao de questoes continue aderente aos topicos e pesos oficiais.",
  },
  {
    title: "6. Ajuste a experiencia ao seu ritmo",
    objective: "Aproveitar recursos de acessibilidade e personalizacao sem perder foco.",
    howTo: [
      "Use o controle de fonte no cabecalho para melhorar leitura durante labs longos.",
      "Alterne entre temas claro e escuro conforme seu ambiente.",
      "Atualize avatar e perfil quando quiser manter sua identidade de jogador consistente.",
    ],
    bestExperience: "Pequenos ajustes de leitura e contraste aumentam a qualidade das sessoes mais longas.",
  },
];

export function HelpScreen() {
  const router = useRouter();
  const isOnboardingManual = getOnboardingStep() === "manual";

  function handleContinue() {
    setOnboardingStep("profile");
    router.replace("/profile");
  }

  return (
    <AppLayout credits creditsCompact>
      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 xl:px-8">
        <PixelCard className="overflow-hidden bg-[linear-gradient(135deg,var(--pixel-card)_0%,var(--pixel-bg)_100%)]">
          <div className="space-y-4">
            <p className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-accent)]">
              Manual do jogador
            </p>
            <h1 className="font-[var(--font-pixel)] text-sm uppercase leading-6 text-[var(--pixel-primary)] sm:text-base">
              Como usar o AWS Quest do jeito certo
            </h1>
            <p className="max-w-3xl font-[var(--font-body)] text-base leading-7 text-[var(--pixel-text)]">
              Este manual mostra o que fazer em cada parte do app e como configurar sua rotina para ter a melhor
              experiencia ao estudar laboratorios AWS em formato de quest.
            </p>
          </div>
        </PixelCard>
        <CreatorCredits compact={false} />

        {isOnboardingManual && (
          <PixelCard className="space-y-3 border-[var(--pixel-primary)] bg-[var(--pixel-primary)]/10">
            <p className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-primary)]">
              Primeiro acesso
            </p>
            <p className="font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">
              Leia os pontos principais abaixo. Quando terminar, confirme para seguir direto para o perfil e completar
              nome, certificacao e tema favorito.
            </p>
            <div className="flex flex-wrap gap-3">
              <PixelButton onClick={handleContinue}>Li e continuar</PixelButton>
            </div>
          </PixelCard>
        )}

        <section className="grid gap-4 lg:grid-cols-2">
          {manualSections.map((section) => (
            <PixelCard key={section.title} className="space-y-4">
              <div className="space-y-2">
                <h2 className="font-[var(--font-pixel)] text-[10px] uppercase leading-5 text-[var(--pixel-primary)]">
                  {section.title}
                </h2>
                <p className="font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">
                  {section.objective}
                </p>
              </div>

              <div className="space-y-2">
                <p className="font-[var(--font-pixel)] text-[9px] uppercase text-[var(--pixel-subtext)]">Como fazer</p>
                <ul className="space-y-2 font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">
                  {section.howTo.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="pt-[2px] font-[var(--font-pixel)] text-[8px] text-[var(--pixel-accent)]">■</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border-t-2 border-dashed border-[var(--pixel-border)] pt-3">
                <p className="font-[var(--font-pixel)] text-[9px] uppercase text-[var(--pixel-subtext)]">
                  Melhor experiencia
                </p>
                <p className="mt-2 font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">
                  {section.bestExperience}
                </p>
              </div>
            </PixelCard>
          ))}
        </section>

        {!isOnboardingManual && (
          <PixelCard className="space-y-3">
            <p className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-primary)]">Resumo rapido</p>
            <p className="font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">
              Perfil completo primeiro, quest bem descrita na Home, uma jornada por vez e revisao constante do
              historico. Esse ciclo entrega a melhor experiencia dentro do app.
            </p>
          </PixelCard>
        )}
      </main>
    </AppLayout>
  );
}
