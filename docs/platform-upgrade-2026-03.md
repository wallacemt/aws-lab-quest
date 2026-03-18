# Platform Upgrade - Mar 2026

Este documento resume as principais entregas da fase de evolucao para preparacao de certificacao AWS.

## Entregas de produto

## 1. Simulado com fraquezas por servico

- Tela final do simulado passou a exibir pontos de fraqueza por servico AWS.
- Revisao lateral prioriza os topicos com maior taxa de erro.
- Endpoint de suporte: /api/study/weak-services.

## 2. Pre-requisito de Exam Guide

- Simulado so inicia se existir exam guide salvo na certificacao alvo do usuario.
- Admin upload agora separa:
  - Exam Guide
  - PDF de Simulado
- Para PDFs escaneados, existe fallback de texto manual.
- Endpoint novo: /api/admin/pdf/exam-guide.

## 3. Leaderboard em tempo real

- Gatilhos de evento foram adicionados em salvamentos de lab e estudo.
- Tela de leaderboard assina atualizacoes via Supabase Realtime.
- Atualizacao ocorre sem refresh manual da pagina.

## 4. Usuarios online

- Presenca ativa via heartbeat autenticado.
- Endpoint de contagem com janela de atividade.
- Header mostra quantidade apenas quando onlineCount > 1.

## 5. Conquistas persistidas

- Conquistas migradas para banco:
  - Achievement (catalogo)
  - UserAchievement (desbloqueios)
- Gatilho de sync de conquistas ao salvar historico de quest/study.
- Galeria dedicada em /achievements com lock/unlock e progresso.
- Compartilhamento publico de conquista:
  - /share/achievement/[userId]/[achievementId]

## 6. Geracao automatica de arte de conquistas

- Seed gera imagens por prompt para cada conquista (quando Supabase + Pollinations configurados).
- Arte e path sao persistidos na tabela Achievement.

## Observacoes operacionais

- Sempre executar npm run db:generate apos alteracoes de schema.
- Para ativar imagens automaticas no seed:
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY
  - POLLINATIONS_API_KEY (opcional, recomendado)
