import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { parseTasksFromText } from "@/lib/parser";
import { GenerateQuestInput } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<GenerateQuestInput>;
    const theme = body.theme?.trim();
    const labText = body.labText?.trim();

    if (!theme || !labText) {
      return NextResponse.json({ error: "Informe o tema e o texto do laboratorio." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY nao configurada no .env.local." }, { status: 500 });
    }

    const prompt = `Voce e um assistente de aprendizado AWS gamificado. Com base no texto do laboratorio e no tema do usuario, gere tarefas para um quest interativo.

Tema do usuario: "${theme}"
Texto do laboratorio:
"""
${labText}
"""

Regras obrigatorias:
- Leia o texto do laboratorio e extraia objetivos, servicos AWS utilizados e etapas principais.
- Gere entre 5 e 8 tarefas cobrindo as etapas reais do laboratorio.
- Use analogias criativas do tema "${theme}".
- Escreva em portugues do Brasil.
- RETORNE APENAS JSON VALIDO.
- Nao use markdown.
- Nao inclua crases.
- Nao inclua texto antes ou depois do JSON.
- O resultado deve ser um array JSON com objetos no formato abaixo.

[
  {
    "id": 1,
    "title": "Titulo da tarefa usando metafora do tema",
    "mission": "Descricao curta da missao",
    "service": "Servico AWS utilizado",
    "analogy": "Analogia criativa em uma frase",
    "steps": ["Dica de passo 1", "Dica de passo 2", "Dica de passo 3"]
  }
]`;

    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({ model: "gemma-3-4b-it" });

    const result = await model.generateContent(prompt);
    const rawText = result.response.text();
    const tasks = parseTasksFromText(rawText);

    if (tasks.length < 1) {
      return NextResponse.json({ error: "A IA retornou uma lista vazia de tarefas." }, { status: 422 });
    }

    return NextResponse.json({ tasks });
  } catch {
    return NextResponse.json({ error: "Erro ao gerar quest. Tente novamente em instantes." }, { status: 500 });
  }
}
