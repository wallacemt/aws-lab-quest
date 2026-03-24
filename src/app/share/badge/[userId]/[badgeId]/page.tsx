import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

type Props = {
  params: Promise<{
    userId: string;
    badgeId: string;
  }>;
};

function getBadgeLore(level: number, badgeName: string): string {
  const stories: Record<number, string> = {
    1: "Este badge marca o primeiro voo na nuvem: como uma instancia inicial, pequena mas pronta para escalar.",
    2: "Aqui o aventureiro aprende disciplina de rota e seguranca, como quem configura rede e permissoes para atravessar tempestades de trafego.",
    3: "No nivel Explorador, cada servico vira ferramenta de mapa: armazenar, monitorar e descobrir o melhor caminho entre regioes.",
    4: "Especialista significa combinar servicos como arquitetura bem desenhada: resiliente, observavel e preparada para picos.",
    5: "Guardiao AWS protege a fortaleza em nuvem com defesa em profundidade, automacao e resposta rapida a incidentes.",
    6: "No estado Lendario, a jornada domina custo, performance e confiabilidade como quem orquestra constelacoes inteiras na nuvem.",
  };

  return (
    stories[level] ??
    `${badgeName} representa um marco de evolucao na trilha cloud, onde estrategia e tecnologia andam juntas.`
  );
}

export default async function ShareBadgePage({ params }: Props) {
  const { userId, badgeId } = await params;

  const ownership = await prisma.userBadge.findUnique({
    where: {
      userId_badgeId: {
        userId,
        badgeId,
      },
    },
    include: {
      user: {
        include: {
          profile: {
            select: {
              avatarUrl: true,
            },
          },
        },
      },
      badge: true,
    },
  });

  if (!ownership) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--pixel-bg)] p-4">
        <div className="w-full max-w-lg border-4 border-[var(--pixel-border)] bg-[var(--pixel-card)] p-6 text-center">
          <p className="font-[var(--font-pixel)] text-xs uppercase text-[var(--pixel-primary)]">Badge não encontrado</p>
          <p className="mt-2 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
            Este link é inválido ou o badge ainda não foi conquistado.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block border-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] px-3 py-2 font-[var(--font-pixel)] text-[10px] uppercase hover:bg-[var(--pixel-muted)]"
          >
            Ir para AWS Quest
          </Link>
        </div>
      </main>
    );
  }

  const userName = ownership.user.name;
  const badgeName = ownership.badge.name;
  const avatarUrl = ownership.user.profile?.avatarUrl;
  const badgeLore = getBadgeLore(ownership.badge.level, badgeName);

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--pixel-bg)] p-4">
      <div className="w-full max-w-2xl border-4 border-[var(--pixel-primary)] bg-[var(--pixel-card)] p-6 text-center shadow-[8px_8px_0_0_#000]">
        <p className="font-[var(--font-pixel)] text-xs uppercase text-[var(--pixel-accent)]">Conquista desbloqueada</p>
        <h1 className="mt-2 font-[var(--font-body)] text-2xl">
          {userName} possui o badge {badgeName}
        </h1>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-4">
            <p className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-subtext)]">Jogador</p>
            <div className="mt-3 flex justify-center">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={userName}
                  width={120}
                  height={120}
                  className="h-28 w-28 border-2 border-[var(--pixel-border)] object-cover"
                />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] font-[var(--font-pixel)] text-3xl text-[var(--pixel-subtext)]">
                  {userName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <p className="mt-2 font-[var(--font-body)] text-sm">{userName}</p>
          </div>

          <div className="rounded border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-4">
            <p className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-subtext)]">Badge</p>
            <div className="mt-3 flex justify-center">
              <Image
                src={ownership.badge.imageUrl}
                alt={badgeName}
                width={120}
                height={120}
                className="h-28 w-28 border-2 border-[var(--pixel-border)] object-cover"
              />
            </div>
            <p className="mt-2 font-[var(--font-body)] text-sm">{badgeName}</p>
          </div>
        </div>

        <p className="mt-5 font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
          Conquistado em {new Date(ownership.earnedAt).toLocaleDateString("pt-BR")}
        </p>

        <div className="mt-4 border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-3 text-left">
          <p className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-primary)]">
            Historia do badge
          </p>
          <p className="mt-2 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">{badgeLore}</p>
        </div>

        <Link
          href="/"
          className="mt-5 inline-block border-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] px-3 py-2 font-[var(--font-pixel)] text-[10px] uppercase hover:bg-[var(--pixel-muted)]"
        >
          Conhecer AWS Quest
        </Link>
      </div>
    </main>
  );
}
