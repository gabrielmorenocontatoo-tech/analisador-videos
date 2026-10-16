import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = "gemini-2.5-flash";

function tipoUrl(url: string): "youtube" | "instagram" | "tiktok" | "desconhecido" {
  if (/youtube\.com|youtu\.be/.test(url)) return "youtube";
  if (/instagram\.com/.test(url)) return "instagram";
  if (/tiktok\.com/.test(url)) return "tiktok";
  return "desconhecido";
}

async function analisarYouTube(url: string): Promise<Record<string, string>> {
  const prompt = buildPrompt(url, "");
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 1500 },
  };
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
  );
  if (!res.ok) { const err = await res.text(); throw new Error(`Erro Gemini: ${res.status} â ${err.slice(0, 300)}`); }
  const data = await res.json();
  const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  return parseResposta(texto);
}

async function extrairUrlVideo(pageUrl: string): Promise<string | null> {
  try {
    const fetchUrl = pageUrl.includes("instagram.com")
      ? pageUrl.replace(/\/$/, "") + "/?__a=1&__d=dis"
      : pageUrl;
    const res = await fetch(fetchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    const html = await res.text();
    const patterns = [
      /"video_url":"([^"]+)"/,
      /content="([^"]+\.mp4[^"]*)"/,
      /og:video[^>]+content="([^"]+)"/,
      /"playbackUrl":"([^"]+)"/,
      /videoObject[^}]+"contentUrl":"([^"]+)"/,
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return match[1].replace(/\\u0026/g, "&").replace(/\\/g, "");
    }
    return null;
  } catch { return null; }
}

async function uploadVideoGemini(videoUrl: string): Promise<string> {
  const videoRes = await fetch(videoUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  });
  if (!videoRes.ok) throw new Error("NÃ£o foi possÃ­vel baixar o vÃ­deo.");
  const contentType = videoRes.headers.get("content-type") || "video/mp4";
  const videoBuffer = await videoRes.arrayBuffer();
  const videoBytes = Buffer.from(videoBuffer);
  const initRes = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": videoBytes.length.toString(),
        "X-Goog-Upload-Header-Content-Type": contentType,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file: { display_name: "video_analisado" } }),
    }
  );
  const uploadUrl = initRes.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("Falha ao iniciar upload.");
  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": videoBytes.length.toString(),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
      "Content-Type": contentType,
    },
    body: videoBytes,
  });
  const uploadData = await uploadRes.json();
  const fileUri = uploadData?.file?.uri;
  if (!fileUri) throw new Error("Upload falhou â URI nÃ£o encontrada.");
  const fileName = uploadData?.file?.name;
  if (fileName) {
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const statusRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${GEMINI_API_KEY}`);
      const statusData = await statusRes.json();
      if (statusData?.state === "ACTIVE") break;
      if (statusData?.state === "FAILED") throw new Error("Processamento do vÃ­deo falhou.");
    }
  }
  return fileUri;
}

async function analisarComFileUri(fileUri: string, url: string): Promise<Record<string, string>> {
  const prompt = buildPrompt(url, "");
  const payload = {
    contents: [{ parts: [{ text: prompt }, { fileData: { mimeType: "video/mp4", fileUri } }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 1500 },
  };
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
  );
  if (!res.ok) { const err = await res.text(); throw new Error(`Erro Gemini: ${res.status} â ${err.slice(0, 300)}`); }
  const data = await res.json();
  const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  return parseResposta(texto);
}

function buildPrompt(url: string, transcricao: string): string {
  return `VocÃª Ã© um especialista em anÃ¡lise de vÃ­deos virais para redes sociais, usando o MÃ©todo Metaverso.

Analise este vÃ­deo e gere uma ficha tÃ©cnica completa. URL: ${url}

${transcricao ? `TRANSCRIÃÃO:\n${transcricao}\n` : ""}

Retorne APENAS um JSON vÃ¡lido, sem markdown, sem explicaÃ§Ãµes, sem texto extra. Apenas o JSON:

{
  "nicho": "qual o nicho principal (ex: saÃºde, finanÃ§as, empreendedorismo, estÃ©tica...)",
  "subnicho": "subnicho ou tema especÃ­fico",
  "duracao": "duraÃ§Ã£o estimada em segundos",
  "tom_de_voz": "como o creator fala: energia, velocidade, seriedade, informalidade...",
  "cenario": "onde foi gravado: ambiente, decoraÃ§Ã£o, iluminaÃ§Ã£o, cores predominantes",
  "angulo_camera": "plano aberto, plano mÃ©dio, close, cÃ¢mera baixa/alta...",
  "enquadramento": "como o creator estÃ¡ posicionado, o que ocupa cada parte da tela",
  "gesticulacao": "como usa as mÃ£os, corpo, expressÃµes faciais",
  "legenda_tela": "textos, palavras em destaque, elementos grÃ¡ficos visÃ­veis",
  "edicao": "cortes, transiÃ§Ãµes, ritmo de ediÃ§Ã£o, efeitos, elementos visuais",
  "observacoes": "por que este vÃ­deo funciona: gancho, retenÃ§Ã£o, CTA, o que pode ser modelado"
}`;
}

function parseResposta(texto: string): Record<string, string> {
  const limpo = texto.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const jsonMatch = limpo.match(/\{[\s\S]*\}/);
  if (jsonMatch) { try { return JSON.parse(jsonMatch[0]); } catch { } }
  try { return JSON.parse(limpo); } catch { return { observacoes: texto.slice(0, 500) }; }
}

export async function POST(req: NextRequest) {
  const { url } = await req.json();
  if (!url?.trim()) return NextResponse.json({ erro: "URL nÃ£o fornecida." }, { status: 400 });
  if (!GEMINI_API_KEY) return NextResponse.json({ erro: "Chave Gemini nÃ£o configurada." }, { status: 500 });
  const tipo = tipoUrl(url);
  try {
    let ficha: Record<string, string>;
    if (tipo === "youtube") {
      ficha = await analisarYouTube(url);
    } else if (tipo === "instagram" || tipo === "tiktok") {
      const videoUrl = await extrairUrlVideo(url);
      if (videoUrl) {
        const fileUri = await uploadVideoGemini(videoUrl);
        ficha = await analisarComFileUri(fileUri, url);
      } else {
        return NextResponse.json({ erro: "NÃ£o foi possÃ­vel acessar o vÃ­deo. Verifique se Ã© pÃºblico e tente um link do YouTube." }, { status: 422 });
      }
    } else {
      return NextResponse.json({ erro: "Plataforma nÃ£o suportada. Use Instagram, TikTok ou YouTube." }, { status: 400 });
    }
    return NextResponse.json({ ficha });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido.";
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
