# Sistema de Conquistas

Guia tecnico e funcional do sistema de conquistas persistido.

## Objetivo

- Expor um catalogo fixo de conquistas.
- Persistir desbloqueios por usuario.
- Mostrar progresso para conquistas ainda bloqueadas.
- Permitir compartilhamento publico de conquistas desbloqueadas.

## Modelagem de dados

## Tabelas

1. Achievement

- code unico da conquista
- nome, descricao, raridade
- imageUrl e supabasePath (arte da conquista)
- generationPrompt (prompt utilizado para gerar arte)
- active, displayOrder

2. UserAchievement

- referencia para user e achievement
- unlockedAt
- progress
- metadata (json opcional)

## Fluxo de desbloqueio

1. Usuario conclui lab/KC/simulado.
2. Rotas de historico chamam syncUserAchievements(userId).
3. Engine calcula metricas atuais do usuario.
4. Conquistas desbloqueadas sao upsert em UserAchievement.

## API

## /api/achievements (GET)

Retorna:

- total de conquistas
- quantidade desbloqueada
- itens com:
  - id, code, name, description, rarity, imageUrl
  - unlocked, unlockedAt
  - current, target, progressPercent

## /api/users/[userId] (GET)

Retorna conquistas no payload publico do usuario para perfil publico.

## Galeria de conquistas

Pagina: /achievements

Comportamento:

- Card com arte e raridade.
- Se bloqueada: overlay de cadeado + progresso.
- Se desbloqueada: data de desbloqueio + botao de compartilhar.

## Compartilhamento

Rota publica:

- /share/achievement/[userId]/[achievementId]

Regras:

- Exibe jogador, conquista e data de desbloqueio.
- Se userId/achievementId nao existir em UserAchievement, mostra estado invalido.

## Seed e geracao de arte

No seed:

- Catalogo de conquistas eh upsertado.
- Se Supabase estiver configurado, a imagem de cada conquista eh gerada por prompt e enviada ao bucket.

Dependencias de ambiente:

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- POLLINATIONS_API_KEY (recomendado)

## Expansao futura

- Adicionar conquistas por servico AWS especifico (ex.: EC2, IAM).
- Recompensas cosmeticas por raridade.
- Feed de conquistas em tempo real no leaderboard.
