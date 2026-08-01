# awlq-worker

Processamento em background do **AWS Lab Quest** — BullMQ + Node.js. Executa tudo que é lento ou assíncrono para o `awlq-app`: geração de questões via IA, análise de áreas fracas, cálculo de métricas de desempenho, revisão de qualidade, envio de email e ingestão de PDF.

O app aciona este worker escrevendo uma linha em `WorkerTrigger` (lida a cada 30s pelo `trigger-poller.ts`) ou empurrando diretamente numa fila BullMQ. Não há API entre os dois processos — a comunicação é via banco de dados/fila compartilhados. Visão geral da arquitetura completa está no [README da raiz](../README.md).

## Comandos

```bash
npm install
npm run dev       # tsx watch (hot-reload)
npm run build      # tsc -> dist/
npm start          # roda o dist/index.js compilado
npx tsc --noEmit    # typecheck
npm run test        # vitest run
npm run prisma:generate   # regenera o Prisma Client após mudança no schema compartilhado
```

## Estrutura

| Path | Papel |
|---|---|
| `queues/index.ts` | As 5 filas BullMQ + tipos de payload dos jobs |
| `workers/*.worker.ts` | Um processador por fila (`source-fetch`, `question-generation`, `feedback-analysis`, `performance-compute`, `quality-review`, `email-send`) |
| `services/` | Lógica de negócio desacoplada da fila (`blueprint-parser`, `question-builder`, `weak-area-analyzer`, `performance-calculator`, `pdf-fetcher`, `trigger-poller`, `email`) |
| `shared/ingestion-pipeline.ts` | Compartilhado com o app: `buildUsageHash`, `validateQuestion`, `persistQuestion` |
| `cron/scheduler.ts` | Jobs recorrentes do BullMQ (padrões salvos na tabela `ScheduledJob`) |

Cada worker roda com concorrência limitada (`concurrency: 1` para qualquer um que chame IA); jobs são idempotentes quando possível, e colisão de `usageHash` é o único caso em que um no-op silencioso é aceitável.
