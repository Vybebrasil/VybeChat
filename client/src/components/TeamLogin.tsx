import React, { useMemo, useState, type FormEvent } from "react";
import { ChevronLeft, Loader2, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchTeamRoster, filtrarEquipe, iniciais, primeiroNome, type TeamMember } from "@/lib/team-roster";

export type TeamLoginProps = {
  workerUrl: string;
  codigoInicial: string;
  /** Erro vindo do Worker depois da entrada (código revogado, por exemplo). */
  erroExterno?: string;
  onEntrar: (pessoa: TeamMember, workspaceCode: string) => void;
  /** Usado quando o Monday está fora do ar e não há lista para escolher. */
  onEntrarPorNome: (nome: string, workspaceCode: string) => void;
  onBack?: () => void;
};

type Etapa = "codigo" | "quem";

export function TeamLogin({ workerUrl, codigoInicial, erroExterno, onEntrar, onEntrarPorNome, onBack }: TeamLoginProps) {
  const [etapa, setEtapa] = useState<Etapa>("codigo");
  const [codigo, setCodigo] = useState(codigoInicial);
  const [equipe, setEquipe] = useState<TeamMember[]>([]);
  const [degradado, setDegradado] = useState(false);
  const [nome, setNome] = useState("");
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const visiveis = useMemo(() => filtrarEquipe(equipe, busca), [equipe, busca]);
  const mensagem = erro || erroExterno || "";

  const enviarCodigo = async (event: FormEvent) => {
    event.preventDefault();
    setErro("");
    setCarregando(true);
    const resultado = await fetchTeamRoster(workerUrl, codigo);
    setCarregando(false);
    if (!resultado.ok) return setErro(resultado.message);
    setEquipe(resultado.team);
    setDegradado(resultado.degraded || resultado.team.length === 0);
    setEtapa("quem");
  };

  const enviarNome = (event: FormEvent) => {
    event.preventDefault();
    if (!nome.trim()) return;
    onEntrarPorNome(nome, codigo);
  };

  return (
    <main className="cyber-grid grid min-h-screen place-items-center overflow-hidden p-5">
      {onBack && (
        <button 
          onClick={onBack}
          className="absolute left-6 top-6 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-400 transition-colors hover:bg-white/5 hover:text-white"
        >
          <ChevronLeft className="size-4" />
          Voltar
        </button>
      )}
      <div className="cyber-panel cyber-corner cyber-reveal w-full max-w-md p-1">
        <div className="border border-orange-300/15 bg-[#0c0d10]/80 p-7 sm:p-9">
          <div className="flex items-center justify-between">
            <p className="cyber-label">VybeChat</p>
            <span className="signal-pulse size-2 rounded-full bg-orange-400" />
          </div>

          {etapa === "codigo" ? (
            <form onSubmit={enviarCodigo}>
              <h1 className="mt-6 font-sans text-3xl font-semibold tracking-tight text-orange-100">
                Entre para conversar<br />com a equipe.
              </h1>
              <p className="mt-2 text-sm leading-6 text-stone-400">Informe o código da equipe para continuar.</p>
              <div className="my-7 h-px bg-gradient-to-r from-orange-500/70 via-orange-200/10 to-transparent" />
              <Input
                value={codigo}
                onChange={event => setCodigo(event.target.value)}
                placeholder="Código da equipe"
                type="password"
                autoComplete="off"
                autoFocus
                className="h-12 rounded-xl border-orange-300/20 bg-black/50 text-orange-50 placeholder:text-stone-600 focus-visible:ring-orange-400"
              />
              <Button disabled={carregando} className="mt-3 h-12 w-full rounded-xl bg-orange-500 font-semibold text-black hover:bg-orange-400 disabled:opacity-60">
                {carregando ? <><Loader2 className="mr-2 size-4 animate-spin" />Verificando…</> : "Continuar"}
              </Button>
              {mensagem && <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-xs leading-5 text-red-200">{mensagem}</p>}
              <p className="mt-5 text-xs text-stone-500">Sem senha e sem e-mail. Depois do código você escolhe quem está entrando.</p>
            </form>
          ) : (
            <div>
              <h1 className="mt-6 font-sans text-3xl font-semibold tracking-tight text-orange-100">Quem está entrando?</h1>
              <p className="mt-2 text-sm leading-6 text-stone-400">
                {degradado ? "A lista da equipe está indisponível agora. Escreva seu nome para continuar." : "Toque no seu nome. Nós vamos lembrar você neste dispositivo."}
              </p>
              <div className="my-6 h-px bg-gradient-to-r from-orange-500/70 via-orange-200/10 to-transparent" />

              {degradado ? (
                <form onSubmit={enviarNome}>
                  <Input
                    value={nome}
                    onChange={event => setNome(event.target.value)}
                    placeholder="Seu nome"
                    autoComplete="username"
                    autoFocus
                    className="h-12 rounded-xl border-orange-300/20 bg-black/50 text-orange-50 placeholder:text-stone-600 focus-visible:ring-orange-400"
                  />
                  <Button className="mt-3 h-12 w-full rounded-xl bg-orange-500 font-semibold text-black hover:bg-orange-400">Entrar no VybeChat</Button>
                </form>
              ) : (
                <>
                  {equipe.length > 6 && (
                    <label className="mb-3 flex items-center gap-2 rounded-xl border border-orange-300/15 bg-black/40 px-3">
                      <Search className="size-4 shrink-0 text-orange-300" />
                      <span className="sr-only">Buscar pessoa</span>
                      <input
                        value={busca}
                        onChange={event => setBusca(event.target.value)}
                        placeholder="Buscar seu nome"
                        autoFocus
                        className="h-11 min-w-0 flex-1 bg-transparent text-sm text-orange-50 placeholder:text-stone-600 outline-none"
                      />
                    </label>
                  )}
                  <ul className="max-h-[46vh] space-y-1.5 overflow-y-auto pr-1">
                    {visiveis.map(pessoa => (
                      <li key={pessoa.id}>
                        <button
                          onClick={() => onEntrar(pessoa, codigo)}
                          className="flex w-full items-center gap-3 rounded-xl border border-orange-300/15 bg-white/[.03] p-2.5 text-left transition-colors hover:border-orange-300/40 hover:bg-orange-400/10"
                        >
                          {pessoa.photo ? (
                            <img src={pessoa.photo} alt="" loading="lazy" className="size-10 shrink-0 rounded-xl object-cover" />
                          ) : (
                            <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-orange-300/25 bg-orange-400/10 text-xs font-bold text-orange-100">{iniciais(pessoa.name)}</span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-orange-50">{primeiroNome(pessoa.name)}</span>
                            <span className="block truncate text-[11px] text-stone-400">{pessoa.name}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                    {visiveis.length === 0 && (
                      <li className="rounded-xl border border-orange-300/15 bg-black/30 p-4 text-center text-xs text-stone-400">
                        <Users className="mx-auto mb-2 size-4 text-orange-300" />
                        Ninguém encontrado com esse nome.
                      </li>
                    )}
                  </ul>
                </>
              )}

              {mensagem && <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-xs leading-5 text-red-200">{mensagem}</p>}
              <button onClick={() => { setEtapa("codigo"); setErro(""); setBusca(""); }} className="mt-5 text-xs font-semibold text-stone-500 hover:text-orange-200">
                Usar outro código
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
