import { motion } from "framer-motion";
import { Briefcase, Gamepad2 } from "lucide-react";

export type AppMode = "vybechat" | "vybegaming";

export function ModeSelection({ onSelect }: { onSelect: (mode: AppMode) => void }) {
  return (
    <div className="flex h-[100dvh] w-full flex-col items-center justify-center bg-[#07080b] px-4 text-white">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/5 via-[#07080b] to-[#07080b]" />
      
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12 text-center"
      >
        <h1 className="text-4xl font-black tracking-tighter sm:text-6xl">
          Como você quer <span className="text-stone-400">entrar?</span>
        </h1>
        <p className="mt-4 text-stone-400">Escolha o modo que melhor se adapta ao seu momento.</p>
      </motion.div>

      <div className="flex w-full max-w-4xl flex-col gap-6 sm:flex-row">
        {/* Work Mode */}
        <motion.button
          whileHover={{ scale: 1.02, y: -5 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelect("vybechat")}
          className="group relative flex flex-1 flex-col items-center justify-center overflow-hidden rounded-3xl border border-white/5 bg-white/5 p-8 text-center transition-colors hover:border-orange-500/30 hover:bg-orange-500/5 sm:p-12"
        >
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-orange-500/0 via-transparent to-orange-500/0 transition-all duration-500 group-hover:from-orange-500/10 group-hover:to-transparent" />
          <div className="mb-6 grid size-20 place-items-center rounded-2xl bg-orange-500/10 text-orange-400 shadow-xl shadow-orange-500/20 ring-1 ring-orange-500/20 transition-transform duration-500 group-hover:scale-110">
            <Briefcase className="size-10" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">VybeChat</h2>
          <p className="mt-2 text-sm text-stone-400">Ambiente de trabalho, comunicação focada e integrações.</p>
        </motion.button>

        {/* Gaming Mode */}
        <motion.button
          whileHover={{ scale: 1.02, y: -5 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelect("vybegaming")}
          className="group relative flex flex-1 flex-col items-center justify-center overflow-hidden rounded-3xl border border-white/5 bg-white/5 p-8 text-center transition-colors hover:border-fuchsia-500/30 hover:bg-fuchsia-500/5 sm:p-12"
        >
          <div className="absolute inset-0 -z-10 bg-gradient-to-bl from-fuchsia-500/0 via-transparent to-fuchsia-500/0 transition-all duration-500 group-hover:from-fuchsia-500/10 group-hover:to-transparent" />
          <div className="mb-6 grid size-20 place-items-center rounded-2xl bg-fuchsia-500/10 text-fuchsia-400 shadow-xl shadow-fuchsia-500/20 ring-1 ring-fuchsia-500/20 transition-transform duration-500 group-hover:scale-110">
            <Gamepad2 className="size-10" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">VybeGaming</h2>
          <p className="mt-2 text-sm text-stone-400">Ping baixo, acesso instantâneo e lobby com a galera.</p>
        </motion.button>
      </div>
    </div>
  );
}
