# Criando uma Lab Quest (v1)

Este tutorial mostra como criar uma nova jornada de LAB no AWS  Quest, desde a entrada do texto ate a finalizacao com XP salvo no historico.

## Video
[![Assistir tutorial de LAB](https://img.youtube.com/vi/QdR2LqiS4sQ/0.jpg)](https://youtu.be/QdR2LqiS4sQ)

## Objetivo

Ao final deste fluxo, voce deve conseguir:

- Gerar uma quest a partir de um texto de laboratorio AWS
- Concluir todas as tarefas
- Finalizar o LAB para persistir XP
- Voltar para Home ou iniciar outro LAB

## Pre-requisitos

- Usuario autenticado
- Perfil preenchido (nome, username, certificacao alvo e tema)
- Texto de lab com passos claros (servicos AWS, objetivo e ordem das etapas)

## Fluxo rapido

1. Acesse a pagina LAB.
2. Informe tema e cole o texto do laboratorio.
3. Clique em Gerar Quest.
4. Marque as tarefas como concluidas.
5. Clique em Finalizar LAB quando todas estiverem completas.
6. Na tela final, escolha Fazer outro LAB ou Voltar ao inicio.

## Fluxo detalhado

### 1) Abrir o modo LAB

- No menu principal, acesse LAB.
- Se existir quest em andamento, o sistema exibe a opcao de continuar.

### 2) Preparar entrada

- Tema: use algo especifico (ex.: networking, IAM, observability).
- Texto do lab: inclua objetivo, servicos e sequencia de execucao.

Boas praticas de prompt:

- Evite texto muito generico.
- Informe contexto tecnico real do laboratorio.
- Inclua passos de verificacao quando possivel.

### 3) Gerar a quest

- Clique em Gerar Quest.
- O sistema cria cards com tarefas, dificuldade e XP estimado por etapa.

### 4) Executar tarefas

- Marque cada tarefa ao concluir.
- A barra de progresso evolui conforme as tasks finalizadas.
- O XP da jornada aumenta no decorrer da execucao.

### 5) Finalizar LAB

- Quando todas as tarefas estiverem concluidas, aparece o modal de finalizacao.
- Clique em Finalizar LAB para registrar historico e aplicar XP.

### 6) Encerrar fluxo

- Tela de celebracao exibida com resumo da jornada.
- Acoes disponiveis:
  - Fazer outro LAB
  - Voltar ao inicio

## Resultado esperado

Ao concluir corretamente:

- XP contabilizado no perfil
- Animacao de count up no header refletindo o novo total
- Registro no historico de LAB
- Progressao de badges/achievements conforme regra de desbloqueio

## Problemas comuns

### Nao gerou quest

- Verifique se tema e texto foram preenchidos.
- Reforce o texto com passos objetivos.

### XP nao mudou

- Confirme se clicou em Finalizar LAB no modal.
- Reabra Home/Profile para validar historico e total de XP.

### Historico vazio

- Verifique sessao autenticada e status da API.

## Checklist de validacao (demo)

- [ ] Gerou quest com sucesso
- [ ] Marcou todas as tarefas
- [ ] Finalizou LAB no modal
- [ ] Visualizou tela final com botoes de proxima acao
- [ ] XP atualizado no header
- [ ] Novo item salvo no historico
