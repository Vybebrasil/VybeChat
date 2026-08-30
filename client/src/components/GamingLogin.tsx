import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Gamepad2, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type GamingLoginProps = {
  codigoInicial: string;
  erroExterno?: string;
  onBack: () => void;
  onEntrar: (nome: string, avatar: string, codigo: string) => void;
};

// Gera um avatar pixelado adorável usando a API de dicebear
const generateAvatar = (seed: string) => 
  `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(seed)}`;

export function GamingLogin({ codigoInicial, erroExterno, onBack, onEntrar }: GamingLoginProps) {
  const [codigo, setCodigo] = useState(codigoInicial);
  const [nome, setNome] = useState("");
  const [avatarSeed, setAvatarSeed] = useState(() => Math.random().toString(36).substring(7));
  const [erro, setErro] = useState("");

  const mensagem = erro || erroExterno || "";

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return setErro("Digite seu Nickname.");
    if (!codigo.trim()) return setErro("Digite o código do servidor.");
    setErro("");
    onEntrar(nome.trim(), generateAvatar(avatarSeed), codigo.trim());
  };

  return (
    <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-[#0b0c16] px-4 font-sans text-stone-300">
      <button 
        onClick={onBack}
        className="absolute left-6 top-6 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-400 hover:bg-white/5 hover:text-white"
      >
        <ChevronLeft className="size-4" />
        Voltar
      </button>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm rounded-3xl border border-fuchsia-500/20 bg-[#12131e] p-8 shadow-2xl shadow-fuchsia-900/10"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 grid size-16 place-items-center rounded-2xl bg-fuchsia-500/10 text-fuchsia-400 shadow-[0_0_30px_rgba(217,70,239,0.3)] ring-1 ring-fuchsia-500/20">
            <Gamepad2 className="size-8" />
          </div>
          <h1 className="text-2xl font-bold text-white">Join Server</h1>
          <p className="mt-1 text-sm text-stone-400">Entre rápido e comece a jogar.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex flex-col items-center gap-3">
            <div className="relative size-24 overflow-hidden rounded-xl bg-[#0b0c16] ring-1 ring-white/10">
              <img 
                src={generateAvatar(avatarSeed)} 
                alt="Avatar Preview" 
                className="size-full object-cover"
              />
            </div>
            <button
              type="button"
              onClick={() => setAvatarSeed(Math.random().toString(36).substring(7))}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-fuchsia-400 hover:bg-fuchsia-400/10"
            >
              <Shuffle className="size-3.5" />
              Rolar Avatar
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-400">
                Nickname
              </label>
              <Input
                autoFocus
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Seu nome no jogo"
                className="h-12 border-white/10 bg-[#0b0c16] px-4 text-base placeholder:text-stone-600 focus-visible:ring-fuchsia-500/50"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-400">
                Código do Servidor
              </label>
              <Input
                value={codigo}
                onChange={e => setCodigo(e.target.value)}
                placeholder="Ex: gaming-123"
                className="h-12 border-white/10 bg-[#0b0c16] px-4 text-base placeholder:text-stone-600 focus-visible:ring-fuchsia-500/50"
              />
            </div>
          </div>

          {mensagem && (
            <p className="rounded-lg bg-rose-500/10 p-3 text-center text-sm font-semibold text-rose-400">
              {mensagem}
            </p>
          )}

          <Button 
            type="submit" 
            className="h-12 w-full bg-fuchsia-600 text-base font-bold text-white hover:bg-fuchsia-500"
          >
            Entrar no Servidor
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
