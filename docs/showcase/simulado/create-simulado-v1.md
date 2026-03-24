# Criando uma sessao de Simulado (v1)

Este guia cobre o fluxo do Simulado AWS, incluindo aceite de regras, prova cronometrada, envio e revisao de pontos fracos.

## Video

Troque apenas o link abaixo pela URL final do seu video:

[Assistir tutorial de Simulado](https://SEU_LINK_DE_VIDEO_AQUI)

Opcional (thumbnail YouTube):

`https://img.youtube.com/vi/SEU_VIDEO_ID/0.jpg`

## Objetivo

Ao final deste fluxo, voce deve conseguir:

- Iniciar simulado da certificacao alvo
- Realizar prova com tempo ativo
- Enviar respostas e registrar resultado
- Revisar fraquezas por topico/servico
- Reiniciar para novo simulado

## Pre-requisitos

- Usuario autenticado
- Certificacao alvo definida no perfil
- Exam Guide disponivel para a certificacao (quando exigido)

## Fluxo rapido

1. Acesse a pagina Simulado.
2. Leia e aceite as regras.
3. Clique em Iniciar Simulado.
4. Responda as questoes dentro do tempo.
5. Clique em Enviar Simulado.
6. Revise score, historico e prioridades de estudo.

## Fluxo detalhado

### 1) Iniciar com gate de regras

- Se nao houver aceite recente, o modal de regras aparece.
- Marque o aceite e confirme para iniciar.

### 2) Prova em andamento

- Cronometro visivel durante toda a sessao.
- Navegacao por numero de questao no painel lateral.
- Simulado ativo pode restringir navegacao para manter integridade da prova.

### 3) Envio do simulado

- Clique em Enviar Simulado para finalizar.
- O sistema calcula score, XP e persistencia no historico.

### 4) Revisao

- Resultado final mostra percentual de acerto.
- O painel de revisao destaca topicos/servicos com maior taxa de erro.
- Permite iniciar novo simulado.

## Resultado esperado

Ao concluir corretamente:

- XP atualizado no header com animacao count up
- Sessao salva no historico de estudo
- Indicadores de fraqueza atualizados para priorizacao
- Evolucao de achievements relacionados a simulados

## Problemas comuns

### Nao inicia simulado

- Verifique certificacao alvo no perfil.
- Se houver bloqueio por Exam Guide, valide upload/configuracao no admin.

### Sessao expirada

- Em sessao antiga incompleta, reinicie e comece novo simulado.

### Falha ao salvar historico

- O resultado local pode aparecer sem persistencia.
- Repetir quando API estiver disponivel.

## Checklist de validacao (demo)

- [ ] Aceitou regras e iniciou prova
- [ ] Cronometro exibido corretamente
- [ ] Navegou entre questoes
- [ ] Enviou simulado
- [ ] Viu score final e revisao de fraquezas
- [ ] XP refletiu no header
- [ ] Historico de estudo atualizado
