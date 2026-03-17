# Integracao de feedback com GitHub Issues

Este projeto usa o GitHub Issues como canal oficial de feedback de usuarios.

## Objetivo

Permitir que o usuario reporte bugs, sugira melhorias e acompanhe o status das solicitacoes em um fluxo publico e rastreavel.

## URL de destino

Use a URL abaixo no botao de feedback da interface:

https://github.com/wallacemt/aws-lab-quest/issues/new/choose

## Passo a passo

1. Garanta que o repositorio tenha Issues habilitado em Settings.
2. Opcional: crie templates em `.github/ISSUE_TEMPLATE` para Bug Report e Feature Request.
3. Na UI, adicione um CTA persistente em area de facil acesso (rodape, ajuda ou perfil).
4. Configure o link para abrir em nova aba (`target="_blank"` + `rel="noopener noreferrer"`).
5. Teste o fluxo clicando no CTA e validando abertura da tela de criacao de issue.

## Boas praticas

- Use titulo e descricao orientando o usuario a incluir contexto, passos e evidencias.
- Padronize labels para triagem rapida (bug, enhancement, question).
- Revise periodicamente os issues para manter o backlog limpo.

## Validacao rapida

- O botao de feedback aparece na interface.
- O clique abre o `issues/new/choose` do repositorio correto.
- O usuario consegue registrar um issue sem autenticar no app.
