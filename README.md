# AWS Lab Quest

Aplicacao web para transformar labs AWS em uma jornada gamificada.

## O que este projeto faz

- Gera quests a partir do texto de um laboratorio AWS usando Gemini.
- Cria tarefas com analogias tematicas para facilitar o aprendizado.
- Mostra progresso com XP e niveis.
- Salva tudo localmente no navegador (perfil, quest ativa, historico e rascunho).
- Bloqueia criacao de nova quest enquanto houver uma em andamento.

## Tecnologias

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Bun
- Google Gemini API

## Requisitos

- Bun instalado
- Chave da API Gemini

## Como rodar

1. Instale dependencias:

```bash
bun install
```

2. Crie o arquivo `.env.local` na raiz do projeto com:

```env
GEMINI_API_KEY=sua_chave_aqui
```

3. Inicie o projeto:

```bash
bun run dev
```

4. Abra no navegador:

```text
http://localhost:3000
```

## Scripts uteis

```bash
bun run dev     # ambiente de desenvolvimento
bun run lint    # checagem de codigo
bun run build   # build de producao
bun run start   # roda build de producao
```

## Observacoes

- O historico e progresso ficam no `localStorage` do navegador.
- Sem banco de dados.
- A chave Gemini fica no servidor via `.env.local`.
