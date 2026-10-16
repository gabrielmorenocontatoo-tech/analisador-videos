"use client";

import { useState } from "react";

interface Ficha {
  nicho: string;
  subnicho: string;
  tom_de_voz: string;
  cenario: string;
  angulo_camera: string;
  enquadramento: string;
  gesticulacao: string;
  legenda_tela: string;
  edicao: string;
  observacoes: string;
  duracao?: string;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [erro, setErro] = useState("");
  const [etapa, setEtapa] = useState("");

  async function analisar() {
    if (!url.trim()) return;
    setLoading(true);
    setFicha(null);
    setErro("");
    setEtapa("Analisando vídeo...");

    try {
      const res = await fetch("/api/analisar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErro(data.erro || "Erro ao analisar.");
      } else {
        setFicha(data.ficha);
      }
    } catch {
      setErro("Erro de conexão.");
    } finally {
      setLoading(false);
      setEtapa("");
    }
  }

  const campos = [
    { key: "nicho", label: "Nicho" },
    { key: "subnicho", label: "Subnicho" },
    { key: "duracao", label: "Duração" },
    { key: "tom_de_voz", label: "Tom de Voz" },
    { key: "cenario", label: "Cenário" },
    { key: "angulo_camera", label: "Ângulo de Câmera" },
    { key: "enquadramento", label: "Enquadramento" },
    { key: "gesticulacao", label: "Gesticulação" },
    { key: "legenda_tela", label: "Legenda na Tela" },
    { key: "edicao", label: "Edição / Montagem" },
    { key: "observacoes", label: "Observações Estratégicas" },
  ];

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white font-sans">
      <div className="border-b border-white/10 px-6 py-4">
        <p className="text-xs uppercase tracking-widest text-white/30">Método Metaverso</p>
        <h1 className="text-xl font-semibold tracking-tight mt-0.5">Analisador de Vídeo</h1>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="space-y-3">
          <label className="text-sm text-white/50 block">Link do vídeo</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && analisar()}
              placeholder="https://www.instagram.com/reel/..."
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm placeholder:text-white/20 focus:outline-none focus:border-white/30 transition"
            />
            <button
              onClick={analisar}
              disabled={loading || !url.trim()}
              className="px-5 py-3 bg-white text-black text-sm font-medium rounded-lg hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              {loading ? "..." : "Analisar"}
            </button>
          </div>
          <p className="text-xs text-white/20">Funciona com Instagram, TikTok e YouTube</p>
        </div>

        {loading && (
          <div className="mt-10 flex items-center gap-3 text-white/40">
            <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            <span className="text-sm">{etapa || "Analisando..."}</span>
          </div>
        )}

        {erro && (
          <div className="mt-8 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {erro}
          </div>
        )}

        {ficha && (
          <div className="mt-10 space-y-px">
            <p className="text-xs uppercase tracking-widest text-white/30 mb-4">Ficha técnica</p>
            {campos.map(({ key, label }) => {
              const valor = ficha[key as keyof Ficha];
              if (!valor) return null;
              return (
                <div key={key} className="grid grid-cols-[140px_1fr] gap-4 py-3 border-b border-white/5">
                  <span className="text-xs text-white/30 pt-0.5 uppercase tracking-wide">{label}</span>
                  <span className="text-sm text-white/80 leading-relaxed">{valor}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}