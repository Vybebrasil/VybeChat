import React, { useState, type FormEvent, useRef } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Briefcase, KeyRound, Shuffle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type TeamLoginProps = {
  workerUrl?: string;
  codigoInicial: string;
  erroExterno?: string;
  onEntrar: (nome: string, photo: string, workspaceCode: string) => void;
  onBack?: () => void;
};

// Gera avatar elegante usando Dicebear (initials ou micah/lorelei)
const generateAvatar = (name: string, seed: string) => {
  if (name.trim()) {
    return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name.trim())}&backgroundColor=f97316,ea580c,c2410c,fb923c`;
  }
  return `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(seed)}&backgroundColor=0c0d10`;
};

export function TeamLogin({
  codigoInicial,
  erroExterno,
  onEntrar,
  onBack,
}: TeamLoginProps) {
  const [codigo, setCodigo] = useState(codigoInicial);
  const [nome, setNome] = useState("");
  const [avatarSeed, setAvatarSeed] = useState(() => Math.random().toString(36).substring(7));
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mensagem = erro || erroExterno || "";
  const currentAvatar = customAvatar || generateAvatar(nome, avatarSeed);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setErro("A imagem deve ter no máximo 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustomAvatar(reader.result as string);
        setErro("");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRollAvatar = () => {
    setCustomAvatar(null);
    setAvatarSeed(Math.random().toString(36).substring(7));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!nome.trim()) {
      setErro("Digite seu nome para continuar.");
      return;
    }
    if (!codigo.trim()) {
      setErro("Informe o código de acesso da equipe.");
      return;
    }
    setErro("");
    onEntrar(nome.trim(), currentAvatar, codigo.trim());
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

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="cyber-panel cyber-corner cyber-reveal p-1">
          <div className="border border-orange-300/15 bg-[#0c0d10]/90 p-7 sm:p-9 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20">
                  <Briefcase className="size-4" />
                </span>
                <p className="cyber-label">VybeChat · Equipe</p>
              </div>
              <span className="signal-pulse size-2 rounded-full bg-orange-400" />
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div>
                <h1 className="font-sans text-2xl font-bold tracking-tight text-orange-100 sm:text-3xl">
                  Entre para o workspace
                </h1>
                <p className="mt-1.5 text-xs text-stone-400 sm:text-sm">
                  Identifique-se para entrar na comunicação da equipe.
                </p>
              </div>

              {/* Avatar Picker */}
              <div className="flex flex-col items-center gap-3 pt-2">
                <div className="relative size-20 overflow-hidden rounded-2xl border border-orange-300/20 bg-black/60 shadow-lg shadow-orange-950/20 ring-2 ring-orange-500/10 transition-all hover:ring-orange-500/30 sm:size-24">
                  <img
                    src={currentAvatar}
                    alt="Preview"
                    className="size-full object-cover"
                    onError={e => {
                      (e.target as HTMLImageElement).src = `https://api.dicebear.com/9.x/initials/svg?seed=${nome || "Vybe"}`;
                    }}
                  />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                  />
                </div>
                <div className="flex w-full max-w-[260px] gap-2">
                  <button
                    type="button"
                    onClick={handleRollAvatar}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/5 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-stone-300 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <Shuffle className="size-3" />
                    Aleatório
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-orange-500/20 bg-orange-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-orange-300 transition-colors hover:bg-orange-500/20"
                  >
                    <Upload className="size-3" />
                    Sua Foto
                  </button>
                </div>
              </div>

              {/* Nome */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-orange-200/70">
                  Seu Nome
                </label>
                <Input
                  value={nome}
                  onChange={event => {
                    setNome(event.target.value);
                    setErro("");
                  }}
                  placeholder="Como a equipe te conhece"
                  autoFocus
                  autoComplete="name"
                  className="h-12 rounded-xl border-orange-300/20 bg-black/50 text-orange-50 placeholder:text-stone-600 focus-visible:ring-orange-400"
                />
              </div>

              {/* Código */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-orange-200/70">
                  <KeyRound className="size-3 text-orange-400" />
                  Código da Equipe
                </label>
                <Input
                  value={codigo}
                  onChange={event => {
                    setCodigo(event.target.value);
                    setErro("");
                  }}
                  placeholder="Código de acesso"
                  type="password"
                  autoComplete="off"
                  className="h-12 rounded-xl border-orange-300/20 bg-black/50 text-orange-50 placeholder:text-stone-600 focus-visible:ring-orange-400"
                />
              </div>

              {mensagem && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-center text-xs leading-5 text-red-200"
                >
                  {mensagem}
                </p>
              )}

              <Button
                type="submit"
                className="h-12 w-full rounded-xl bg-orange-500 font-bold text-black transition-all hover:bg-orange-400 hover:shadow-[0_0_20px_rgba(249,115,22,0.3)]"
              >
                Entrar no VybeChat
              </Button>
            </form>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
