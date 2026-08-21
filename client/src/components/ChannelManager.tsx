import React, { useEffect, useState } from "react";
import { Hash, Plus, Settings2, Trash2, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExternalCategory } from "@/lib/external-workspace";

type Props = {
  workspace: ExternalCategory[];
  onSave: (workspace: ExternalCategory[]) => void;
};

/** Menor id livre, para quem cria um canal não precisar escolher número. */
function proximoId(workspace: ExternalCategory[]) {
  const usados = new Set(workspace.flatMap(c => c.channels.map(ch => ch.id)));
  let id = 1;
  while (usados.has(id)) id += 1;
  return id;
}

/**
 * Gerência dos canais dentro do próprio VybeChat.
 *
 * Antes a lista estava fixa no código: criar, renomear ou remover exigia
 * publicar de novo. Foi assim que a seção "PESSOAL" ficou com gente que não é da
 * equipe e sem gente que é.
 */
export function ChannelManager({ workspace, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [rascunho, setRascunho] = useState<ExternalCategory[]>(workspace);

  // Enquanto está fechado, acompanha o que vier do servidor; aberto, não
  // atropela o que a pessoa está editando.
  useEffect(() => { if (!open) setRascunho(workspace); }, [workspace, open]);

  const alterarCanal = (ci: number, chi: number, campo: "name" | "type", valor: string) =>
    setRascunho(atual => atual.map((cat, i) => i !== ci ? cat : {
      ...cat,
      channels: cat.channels.map((ch, j) => j !== chi ? ch : { ...ch, [campo]: campo === "type" ? (valor === "voice" ? "voice" : "text") : valor }),
    }));

  const removerCanal = (ci: number, chi: number) =>
    setRascunho(atual => atual.map((cat, i) => i !== ci ? cat : { ...cat, channels: cat.channels.filter((_, j) => j !== chi) }).filter(cat => cat.channels.length));

  const adicionarCanal = (ci: number) =>
    setRascunho(atual => atual.map((cat, i) => i !== ci ? cat : {
      ...cat,
      channels: [...cat.channels, { id: proximoId(atual), name: "novo-canal", type: "text" as const }],
    }));

  const adicionarCategoria = () =>
    setRascunho(atual => [...atual, { name: "NOVA SEÇÃO", channels: [{ id: proximoId(atual), name: "novo-canal", type: "text" as const }] }]);

  const salvar = () => {
    const limpo = rascunho
      .map(cat => ({ ...cat, name: cat.name.trim(), channels: cat.channels.filter(ch => ch.name.trim()) }))
      .filter(cat => cat.name && cat.channels.length);
    if (!limpo.length) return;
    onSave(limpo);
    setOpen(false);
  };

  if (!open) {
    return <button onClick={() => setOpen(true)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-stone-500 hover:bg-white/5 hover:text-orange-200" aria-label="Gerenciar canais">
      <Settings2 className="size-3.5" />Gerenciar canais
    </button>;
  }

  return <section className="fixed inset-y-0 right-0 z-[72] flex w-full max-w-md flex-col border-l border-orange-300/25 bg-[#0b0c10]/98 p-4 shadow-2xl backdrop-blur sm:p-5">
    <header className="flex items-center justify-between border-b border-orange-300/15 pb-4">
      <div>
        <p className="cyber-label">Estrutura da equipe</p>
        <h3 className="mt-1 font-sans text-lg font-semibold text-orange-50">Gerenciar canais</h3>
      </div>
      <button onClick={() => setOpen(false)} className="grid size-9 rounded-xl border border-orange-300/20 text-orange-100" aria-label="Fechar gerenciador"><X className="size-4" /></button>
    </header>

    <div className="mt-4 flex-1 space-y-4 overflow-y-auto">
      {rascunho.map((categoria, ci) => <article key={ci} className="rounded-xl border border-orange-300/15 bg-white/[.025] p-3">
        <input
          value={categoria.name}
          onChange={event => setRascunho(atual => atual.map((cat, i) => i === ci ? { ...cat, name: event.target.value } : cat))}
          aria-label={`Nome da seção ${ci + 1}`}
          className="h-8 w-full border-b border-orange-300/15 bg-transparent text-xs font-bold uppercase tracking-wider text-orange-200 outline-none"
        />
        <div className="mt-2 space-y-1.5">
          {categoria.channels.map((canal, chi) => <div key={canal.id} className="flex items-center gap-1.5">
            <button
              onClick={() => alterarCanal(ci, chi, "type", canal.type === "voice" ? "text" : "voice")}
              title={canal.type === "voice" ? "Sala de voz — tocar para virar texto" : "Canal de texto — tocar para virar voz"}
              aria-label={`Tipo do canal ${canal.name}`}
              className="grid size-7 shrink-0 place-items-center rounded-lg border border-orange-300/20 text-orange-300"
            >{canal.type === "voice" ? <Volume2 className="size-3.5" /> : <Hash className="size-3.5" />}</button>
            <input
              value={canal.name}
              onChange={event => alterarCanal(ci, chi, "name", event.target.value)}
              aria-label={`Nome do canal ${chi + 1}`}
              className="h-8 min-w-0 flex-1 rounded-lg border border-orange-300/15 bg-black/25 px-2 text-sm text-orange-50 outline-none"
            />
            <button onClick={() => removerCanal(ci, chi)} aria-label={`Remover ${canal.name}`} className="grid size-7 shrink-0 place-items-center rounded-lg text-stone-500 hover:text-rose-300"><Trash2 className="size-3.5" /></button>
          </div>)}
        </div>
        <button onClick={() => adicionarCanal(ci)} className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-orange-300 hover:text-orange-200"><Plus className="size-3" />Adicionar canal</button>
      </article>)}
      <button onClick={adicionarCategoria} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-orange-300/25 py-2.5 text-xs font-semibold text-orange-200 hover:bg-orange-400/5"><Plus className="size-3.5" />Adicionar seção</button>
    </div>

    <footer className="mt-4 border-t border-orange-300/15 pt-3">
      <p className="mb-2 text-[10px] leading-4 text-stone-500">Remover um canal não apaga as mensagens dele: elas voltam se o canal for recriado com o mesmo lugar na lista.</p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setOpen(false)} className="flex-1 border-orange-300/25 text-orange-100">Cancelar</Button>
        <Button onClick={salvar} className="flex-1 bg-orange-500 font-semibold text-black hover:bg-orange-400">Salvar para a equipe</Button>
      </div>
    </footer>
  </section>;
}
