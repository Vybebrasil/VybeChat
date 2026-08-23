import {
  Hash,
  MessageCircleMore,
  Radio,
  Sparkles,
  UsersRound,
  Mic,
  MicOff,
  Coffee,
  Brain,
  CircleDot,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import type { ExternalChannel } from "@/lib/external-workspace";

type TeamMember = { userId: string; name: string };

type Props = {
  channels: ExternalChannel[];
  members: TeamMember[];
  onSelectChannel: (channelId: number) => void;
  onJoinVoice: (channelId: number) => void;
  onOpenDirect: (member: TeamMember) => void;
  onOpenCentral: () => void;
  hideTrigger?: boolean;
  microphoneOn?: boolean;
  onToggleMic?: () => void;
  status?: "online" | "away" | "offline" | "focus" | "meeting";
  onSetStatus?: (status: "online" | "away" | "offline" | "focus" | "meeting") => void;
};

export function VybeCommandPalette({
  channels,
  members,
  onSelectChannel,
  onJoinVoice,
  onOpenDirect,
  onOpenCentral,
  hideTrigger = false,
  microphoneOn,
  onToggleMic,
  status,
  onSetStatus,
}: Props) {
  const [open, setOpen] = useState(false);
  const run = (action: () => void) => {
    action();
    setOpen(false);
  };
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(current => !current);
      }
    };
    const openFromShell = () => setOpen(true);
    window.addEventListener("keydown", listener);
    window.addEventListener("vybe:open-commands", openFromShell);
    return () => {
      window.removeEventListener("keydown", listener);
      window.removeEventListener("vybe:open-commands", openFromShell);
    };
  }, []);
  return (
    <>
      {!hideTrigger && (
        <button
          onClick={() => setOpen(true)}
          className="vybe-command-trigger fixed bottom-4 left-4 z-20 hidden items-center gap-2 rounded-xl border border-orange-300/20 bg-[#111217]/95 px-3 py-2 text-xs font-semibold text-orange-100 shadow-xl backdrop-blur md:flex"
          aria-label="Abrir paleta de comandos"
        >
          <Sparkles className="size-4 text-orange-400" />
          Comandos{" "}
          <kbd className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-stone-400">
            ⌘ K
          </kbd>
        </button>
      )}
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Comandos do VybeChat"
        description="Pesquise canais, pessoas e ações"
        className="vybe-command-palette max-w-xl border-orange-300/25 bg-[#111217] text-orange-50"
      >
        <CommandInput placeholder="Ir para um canal, iniciar conversa ou ação…" />
        <CommandList>
          <CommandEmpty className="text-stone-400">
            Nenhum comando encontrado.
          </CommandEmpty>
          <CommandGroup heading="Ações">
            {onToggleMic && (
              <CommandItem onSelect={() => run(onToggleMic)} className="text-orange-50">
                {microphoneOn ? <MicOff className="text-rose-400" /> : <Mic className="text-emerald-400" />}
                {microphoneOn ? "Desativar Microfone" : "Ativar Microfone"}
                <CommandShortcut>M</CommandShortcut>
              </CommandItem>
            )}
            {onSetStatus && status !== "online" && (
              <CommandItem onSelect={() => run(() => onSetStatus("online"))} className="text-orange-50">
                <CircleDot className="text-emerald-400" /> Ficar Online
              </CommandItem>
            )}
            {onSetStatus && status !== "away" && (
              <CommandItem onSelect={() => run(() => onSetStatus("away"))} className="text-orange-50">
                <Coffee className="text-amber-400" /> Ficar Ausente
              </CommandItem>
            )}
            {onSetStatus && status !== "focus" && (
              <CommandItem onSelect={() => run(() => onSetStatus("focus"))} className="text-orange-50">
                <Brain className="text-purple-400" /> Modo Foco (Não Perturbe)
              </CommandItem>
            )}
            <CommandItem
              onSelect={() => run(onOpenCentral)}
              className="text-orange-50"
            >
              <UsersRound className="text-orange-400" />
              Abrir detalhes do canal<CommandShortcut>⇧ C</CommandShortcut>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Canais de texto">
            {channels
              .filter(channel => channel.type === "text")
              .map(channel => (
                <CommandItem
                  key={channel.id}
                  value={`canal ${channel.name}`}
                  onSelect={() => run(() => onSelectChannel(channel.id))}
                  className="text-orange-50"
                >
                  <Hash className="text-orange-400" />#{channel.name}
                </CommandItem>
              ))}
          </CommandGroup>
          <CommandGroup heading="Salas de voz">
            {channels
              .filter(channel => channel.type === "voice")
              .map(channel => (
                <CommandItem
                  key={channel.id}
                  value={`sala ${channel.name}`}
                  onSelect={() => run(() => onJoinVoice(channel.id))}
                  className="text-orange-50"
                >
                  <Radio className="text-orange-400" />
                  Entrar em {channel.name}
                </CommandItem>
              ))}
          </CommandGroup>
          {members.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Conversas privadas">
                {members.map(member => (
                  <CommandItem
                    key={member.userId}
                    value={`direta ${member.name}`}
                    onSelect={() => run(() => onOpenDirect(member))}
                    className="text-orange-50"
                  >
                    <MessageCircleMore className="text-orange-400" />
                    Mensagem para {member.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
