// ponytail: image.pollinations.ai/prompt is the free tier (no API key/balance).
// gen.pollinations.ai/image is the metered "pollen" tier that 402s when the
// account balance runs out — that was the cause of the admin artwork 502s.
const POLLINATIONS_BASE = process.env.POLLINATIONS_BASE ?? "https://image.pollinations.ai/prompt";
const DEFAULT_MODEL = "flux";
const IMAGE_WIDTH = 512;
const IMAGE_HEIGHT = 512;
const MAX_FETCH_ATTEMPTS = 3;
const RETRY_DELAY_MS = 4000;

export async function fetchPollinationsImage(
  prompt: string,
  seed: number,
  model: string = DEFAULT_MODEL,
): Promise<{ dataUrl: string }> {
  const encoded = encodeURIComponent(prompt);
  const url = `${POLLINATIONS_BASE}/${encoded}?model=${encodeURIComponent(model)}&width=${IMAGE_WIDTH}&height=${IMAGE_HEIGHT}&seed=${seed}&nologo=true`;

  let lastError = "";
  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt += 1) {
    const res = await fetch(url);
    if (res.ok) {
      const arrayBuffer = await res.arrayBuffer();
      const contentType = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0].trim();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      return { dataUrl: `data:${contentType};base64,${base64}` };
    }

    lastError = `${res.status} ${res.statusText}`;
    if (attempt < MAX_FETCH_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }

  throw new Error(`Falha ao gerar imagem no Pollinations: ${lastError}`);
}

export const PIXEL_ART_STYLE_RULES = [
  "ESTILO OBRIGATORIO, sem excecoes: pixel art 8-bit/16-bit retro, blocos de pixel nitidos e visiveis.",
  "PROIBIDO: suavizacao, gradientes suaves, renderizacao 3D, foto-realismo, pintura digital lisa.",
  "Paleta de cores limitada estilo retro-RPG, predominando laranja AWS (#f97316) e azul-marinho escuro (#0f172a), poucos tons de contraste.",
  "Composicao: retrato centralizado de um personagem em sprite pixel art estilo RPG classico, cercado por pequenos icones pixelados de servicos AWS (servidores, cubos, nuvem, racks) como elementos de HUD retro.",
  "Atmosfera cinematica sci-fi/cyberpunk, fundo escuro com luzes neon.",
  "Sem texto, sem letras, sem numeros, sem logos de marcas reais.",
  "Composicao quadrada centralizada para 512x512.",
].join("\n");
