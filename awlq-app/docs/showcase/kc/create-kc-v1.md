# Criando uma sessao de KC (v1)

Este guia mostra o fluxo completo para iniciar, responder e finalizar uma sessao de Knowledge Check (KC).

## Video
[![Assistir tutorial de LAB](https://img.youtube.com/vi/6Ij6GgQjoLQ/0.jpg)](https://youtu.be/6Ij6GgQjoLQ)

## Objetivo

Ao final deste fluxo, voce deve conseguir:

- Selecionar servicos AWS e dificuldade
- Iniciar o KC com questoes geradas
- Responder questoes com feedback por alternativa
- Finalizar o KC e registrar XP no historico
- Iniciar outro KC rapidamente

## Pre-requisitos

- Usuario autenticado
- Perfil com certificacao alvo definida
- Banco/API disponiveis para salvar historico

## Fluxo rapido

1. Acesse a pagina KC.
2. Selecione assuntos AWS e dificuldade.
3. Clique em Iniciar KC.
4. Responda as questoes (uma por vez).
5. Clique em Finalizar KC na ultima pergunta.
6. Na tela de resultado, clique em Fazer outro KC ou Voltar ao inicio.

## Fluxo detalhado

### 1) Configurar KC

- Pesquise servicos por nome ou codigo.
- Selecione os topicos desejados.
- Defina dificuldade (easy, medium, hard).

### 2) Iniciar sessao

- Clique em Iniciar KC.
- O sistema monta as questoes com base nos filtros.

### 3) Responder com revisao

- Envie a resposta da questao atual.
- O sistema mostra:
  - Se acertou ou errou
  - Explicacao resumida
  - Revisao alternativa por alternativa

### 4) Finalizar KC

- Ao finalizar, o sistema calcula score e XP.
- O resultado e salvo no historico de estudo.

### 5) Pos-resultado

- Bloco de resumo exibido com score e XP.
- Acoes disponiveis:
  - Fazer outro KC (volta para /kc)
  - Voltar ao inicio

## Resultado esperado

Ao concluir corretamente:

- XP atualizado no header com animacao count up
- Registro no historico de estudo
- Evolucao em achievements relacionados a KC

## Problemas comuns

### Erro ao iniciar KC

- Confirme se ao menos um topico foi selecionado.
- Verifique se os servicos carregaram corretamente.

### Resultado sem historico salvo

- O fluxo conclui, mas pode falhar persistencia em caso de indisponibilidade da API.
- Repetir o KC apos estabilizar backend.

## Checklist de validacao (demo)

- [ ] Selecionou topicos e dificuldade
- [ ] Iniciou sessao de KC
- [ ] Respondeu questoes e viu revisao
- [ ] Finalizou KC com score exibido
- [ ] XP refletiu no header
- [ ] Item salvo no historico de estudo
