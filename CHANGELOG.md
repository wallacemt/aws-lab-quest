# Changelog

Todas as mudanças notáveis neste projeto são documentadas aqui.

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
versionamento segue [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [2.0.0] — Em desenvolvimento

### Features
- feat(retention): sistema de flashcards inteligentes gerados automaticamente a partir de erros, flags de revisão e respostas lentas
- feat(retention): repetição espaçada via algoritmo SM-2 com escalonamento de intervalos por dificuldade
- feat(retention): Daily Review — fila diária composta por flashcards pendentes, questões erradas recentes e serviços com baixo desempenho
- feat(retention): Sprint Mode — sessões ultrarrápidas (3 min / 5 min / 5 questões / 10 questões)
- feat(retention): Memory Recovery — reapresenta conteúdos dominados há mais de 45 dias
- feat(retention): Intelligent Streak — streak contabilizado apenas com estudo real, não por login
- feat(retention): Confidence-Based Learning — captura de confiança por resposta; detecção de "falsa crença"
- feat(mentor): AI Mentor — lista priorizada de ações baseada em histórico, áreas fracas e certificação alvo
- feat(trails): Quest Chains — trilhas de aprendizagem estruturadas por certificação com desbloqueio progressivo
- feat(library): Biblioteca de Conteúdo dos Instrutores — PDFs, imagens, markdown e slides com visualização inline e créditos de autores
- feat(arena): Battle Mode — batalhas contra chefes temáticos (IAM Guardian, VPC Titan, Lambda Overlord)
- feat(arena): Weekly Challenge — desafio semanal global com ranking próprio e badge exclusiva
- feat(arena): Daily Quiz — 5 questões diárias cross-cert, desbloqueado após certificação concluída
- feat(news): Tela de Notícias — feeds RSS curados (AWS, dev.to, Hacker News) servidos via worker
- feat(changelog): Tela de Changelog público — releases buscados via GitHub API com curadoria admin

### Chore
- chore(responsiveness): auditoria e correções de responsividade via Playwright (375px / 768px / 1280px)

### Breaking Changes
- feat!: KC agora usa worker dedicado de geração (`kc-generation`) para preencher gaps de questões on-demand

---

## [1.0.0] — 2026-06-03

### Features
- feat: plataforma base com Simulados, Knowledge Check e Labs gerados por IA
- feat: sistema de XP com pesos configuráveis por tipo de atividade
- feat: 6 níveis de progressão (Recruta → Lendário)
- feat: 12 conquistas automáticas com badges gerados via Pollinations API
- feat: Jornada de certificação com rastreamento de progresso
- feat: detecção automática de áreas fracas (correctRate < 60%)
- feat: self-feeding loop — geração contínua de questões via Gemini ponderada por domínios do blueprint
- feat: leaderboard em tempo real via Supabase Realtime
- feat: pipeline de ingestão de PDFs com deduplicação por SHA-256
- feat: painel administrativo completo (usuários, questões, workers, simulado maker)
