import {
  Expand,
  Grid2X2,
  Hand,
  Mic,
  MicOff,
  Minimize2,
  MonitorUp,
  Music2,
  Phone,
  Pin,
  Shrink,
  Video,
  VideoOff,
  Volume2,
  ChevronUp,
  Check,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getStageTile,
  getThumbnailTiles,
  type CallStageTile as CallStageTileState,
} from "@/lib/call-stage";
import { resolveStageFocus } from "@/lib/screen-share";
import {
  getNextCallStageView,
  togglePinnedParticipant,
  type CallStageView,
} from "@/lib/call-stage-ui";
import { MediaTile } from "@/components/MediaTile";
import { MicSensitivityMeter } from "@/components/MicSensitivityMeter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  isFullscreenActive,
  toggleFullscreen as toggleDocumentFullscreen,
  type FullscreenDocumentLike,
  type FullscreenElementLike,
} from "@/lib/fullscreen";
import type { PeerAudioDiagnostics } from "@/lib/peer-audio-diagnostics";

type StageParticipant = CallStageTileState & {
  stream: MediaStream | null;
  label: string;
  muted?: boolean;
  isLocal?: boolean;
  cameraOn?: boolean;
  microphoneOn?: boolean;
  speaking?: boolean;
  handRaised?: boolean;
  accent?: boolean;
  volume?: number;
  onVolumeChange?: (volume: number) => void;
};

function DeviceSelector({ kind, activeDeviceId, onChange, disabled, audioConfig, onAudioConfigChange }: { kind: "audioinput" | "videoinput"; activeDeviceId?: string; onChange: (id: string) => void; disabled?: boolean; audioConfig?: { echoCancellation: boolean, noiseSuppression: boolean, autoGainControl: boolean }; onAudioConfigChange?: (config: { echoCancellation: boolean, noiseSuppression: boolean, autoGainControl: boolean }) => void; }) {
  const [devices, setDevices] = useState<{deviceId: string, label: string}[]>([]);
  const onOpen = async (open: boolean) => {
    if (open && navigator.mediaDevices?.enumerateDevices) {
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(all.filter(d => d.kind === kind).map((d, i) => ({
        deviceId: d.deviceId,
        label: d.label || (kind === "audioinput" ? `Microfone ${i + 1}` : `Câmera ${i + 1}`),
      })));
    }
  };

  return (
    <DropdownMenu onOpenChange={onOpen}>
      <DropdownMenuTrigger disabled={disabled} className="grid h-11 w-6 place-items-center rounded-r-xl border border-l-0 border-white/10 bg-white/5 text-white transition-colors hover:bg-white/10 data-[state=open]:bg-white/10">
        <ChevronUp className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 border-white/10 bg-[#171519] text-white">
        <DropdownMenuLabel className="text-xs text-stone-400">{kind === "audioinput" ? "Microfones" : "Câmeras"}</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        {devices.map(device => (
          <DropdownMenuItem key={device.deviceId} onClick={() => onChange(device.deviceId)} className="gap-2 focus:bg-white/10">
            {activeDeviceId === device.deviceId ? <Check className="size-4" /> : <span className="size-4" />}
            <span className="truncate">{device.label}</span>
          </DropdownMenuItem>
        ))}
        {kind === "audioinput" && audioConfig && onAudioConfigChange && (
          <>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuLabel className="text-xs text-stone-400 mt-1">Qualidade Profissional (Requer reconectar)</DropdownMenuLabel>
            <DropdownMenuCheckboxItem checked={audioConfig.echoCancellation} onCheckedChange={(c) => onAudioConfigChange({...audioConfig, echoCancellation: c})} className="gap-2 focus:bg-white/10">
              Cancelamento de Eco
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={audioConfig.noiseSuppression} onCheckedChange={(c) => onAudioConfigChange({...audioConfig, noiseSuppression: c})} className="gap-2 focus:bg-white/10">
              Supressão de Ruído
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={audioConfig.autoGainControl} onCheckedChange={(c) => onAudioConfigChange({...audioConfig, autoGainControl: c})} className="gap-2 focus:bg-white/10">
              Ganho Automático
            </DropdownMenuCheckboxItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type CallStageProps = {
  roomName: string;
  participants: StageParticipant[];
  microphoneOn: boolean;
  cameraOn: boolean;
  sharingScreen: boolean;
  handRaised?: boolean;
  diagnostics?: Record<string, PeerAudioDiagnostics>;
  gateSensitivity?: number;
  onGateSensitivityChange?: (value: number) => void;
  micLevel?: number;
  canModerate?: boolean;
  onMuteParticipant?: (socketId: string) => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onChangeAudioDevice?: (deviceId: string) => void;
  onChangeVideoDevice?: (deviceId: string) => void;
  activeAudioDeviceId?: string;
  activeVideoDeviceId?: string;
  audioConfig?: { echoCancellation: boolean, noiseSuppression: boolean, autoGainControl: boolean };
  onAudioConfigChange?: (config: { echoCancellation: boolean, noiseSuppression: boolean, autoGainControl: boolean }) => void;
  onShareScreen: () => void;
  onOpenMusic?: () => void;
  musicActive?: boolean;
  onToggleHandRaise?: () => void;
  onLeave: () => void;
  onMinimize: () => void;
  mode?: "fullscreen" | "split";
};

export function CallStage({
  roomName,
  participants,
  microphoneOn,
  cameraOn,
  sharingScreen,
  handRaised = false,
  diagnostics = {},
  gateSensitivity = 0,
  onGateSensitivityChange,
  micLevel = 0,
  canModerate = false,
  onMuteParticipant,
  onToggleMic,
  onToggleCamera,
  onChangeAudioDevice,
  onChangeVideoDevice,
  activeAudioDeviceId,
  activeVideoDeviceId,
  audioConfig,
  onAudioConfigChange,
  onShareScreen,
  onOpenMusic,
  musicActive = false,
  onToggleHandRaise = () => {},
  onLeave,
  onMinimize,
  mode = "fullscreen",
}: CallStageProps) {
  const stageRef = useRef<HTMLElement>(null);
  // Tela cheia do quadro em foco, e nao do palco inteiro: antes ela levava
  // cabecalho, miniaturas e rodape junto, entao nunca dava para ver so a tela de
  // quem esta compartilhando.
  const focoRef = useRef<HTMLDivElement>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [view, setView] = useState<CallStageView>("stage");
  const [rosterOpen, setRosterOpen] = useState(false);
  // Quem esta compartilhando vai para o centro sem ninguem precisar clicar. Antes
  // a tela ficava numa miniatura ate cada pessoa fixar na mao, e ninguem fixava.
  const compartilhando =
    participants.find(item => item.sharingScreen)?.id ?? null;
  const foco = resolveStageFocus({ pinnedId, sharingId: compartilhando });
  const selected = useMemo(
    () => getStageTile(participants, foco),
    [participants, foco]
  );
  const thumbnails = useMemo(
    () => getThumbnailTiles(participants, selected?.id ?? null),
    [participants, selected?.id]
  );
  const callQuality = Object.values(diagnostics).some(
    item => item.quality === "recovering"
  )
    ? "Recuperando conexão"
    : Object.values(diagnostics).some(item => item.quality === "degraded")
      ? "Conexão instável"
      : Object.values(diagnostics).some(item => item.quality === "connecting")
        ? "Conectando mídia"
        : "Conexão estável";

  useEffect(() => {
    if (
      pinnedId &&
      !participants.some(participant => participant.id === pinnedId)
    )
      setPinnedId(null);
  }, [participants, pinnedId]);

  useEffect(() => {
    const syncFullscreen = () => {
      setIsFullscreen(isFullscreenActive(document as FullscreenDocumentLike));
    };
    document.addEventListener("fullscreenchange", syncFullscreen);
    document.addEventListener(
      "webkitfullscreenchange",
      syncFullscreen as EventListener
    );
    syncFullscreen();
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreen);
      document.removeEventListener(
        "webkitfullscreenchange",
        syncFullscreen as EventListener
      );
    };
  }, []);

  const toggleFullscreen = async () => {
    // Prioriza o quadro em foco; o palco inteiro so entra se ele nao existir.
    const element = (focoRef.current ??
      stageRef.current) as FullscreenElementLike | null;
    if (!element) return;
    await toggleDocumentFullscreen(document as FullscreenDocumentLike, element);
  };

  if (!selected) return null;

  return (
    <section
      ref={stageRef}
      className={`command-call-stage flex flex-col text-white ${
        mode === "fullscreen"
          ? "fixed inset-0 z-50 min-h-screen bg-[#07080b]"
          : "relative flex-none h-[45vh] sm:h-auto sm:flex-1 sm:min-h-0 border-b border-white/10"
      }`}
    >
      <header className="command-call-header flex h-16 shrink-0 items-center gap-3 px-3 sm:px-5">
        <span className="grid size-10 place-items-center rounded-xl border border-white/10 bg-orange-400/10 text-orange-300">
          <Volume2 className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-sans text-sm font-semibold text-white">
            {roomName}
          </p>
          <p className="text-[11px] text-stone-400">
            {participants.length} participante
            {participants.length === 1 ? "" : "s"} na chamada
          </p>
        </div>
        {selected.sharingScreen && (
          <span className="ml-auto hidden items-center gap-1.5 rounded-full bg-orange-400/15 px-3 py-1.5 text-[11px] font-semibold text-orange-100 sm:flex">
            <MonitorUp className="size-3.5" />
            Tela ao vivo
          </span>
        )}
        <span
          className={`hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold sm:flex ${microphoneOn ? "bg-emerald-400/10 text-emerald-200" : "bg-rose-400/10 text-rose-200"}`}
        >
          <span
            className={`size-1.5 rounded-full ${microphoneOn ? "bg-emerald-400" : "bg-rose-400"}`}
          />
          {microphoneOn ? "Microfone ativo" : "Microfone pausado"}
        </span>
        <span
          className={`hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold lg:flex ${callQuality === "Conexão estável" ? "bg-emerald-400/10 text-emerald-200" : callQuality === "Conectando mídia" ? "bg-orange-400/10 text-orange-100" : "bg-rose-400/10 text-rose-200"}`}
        >
          <span
            className={`size-1.5 rounded-full ${callQuality === "Conexão estável" ? "bg-emerald-400" : callQuality === "Conectando mídia" ? "bg-orange-300" : "bg-rose-400"}`}
          />
          {callQuality}
        </span>
        <button
          onClick={() => setRosterOpen(current => !current)}
          className={`grid size-9 place-items-center rounded-lg border text-xs font-bold transition-colors ${rosterOpen ? "border-orange-300/50 bg-orange-400/15 text-orange-100" : "border-white/10 bg-white/5 text-stone-200 hover:bg-white/10"}`}
          aria-label={
            rosterOpen ? "Fechar participantes" : "Abrir participantes"
          }
        >
          {participants.length}
        </button>
        <button
          onClick={() => setView(getNextCallStageView)}
          className="grid size-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-stone-200 hover:bg-white/10"
          aria-label={
            view === "stage"
              ? "Abrir grade de participantes"
              : "Abrir palco principal"
          }
        >
          {view === "stage" ? (
            <Grid2X2 className="size-4" />
          ) : (
            <MonitorUp className="size-4" />
          )}
        </button>

        <button
          onClick={onMinimize}
          className="grid size-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-stone-200 hover:bg-white/10"
          aria-label="Minimizar chamada"
        >
          <Minimize2 className="size-4" />
        </button>
      </header>

      <main className="relative flex min-h-0 flex-1 flex-col gap-3 p-3 sm:gap-4 sm:p-5">
        <AnimatePresence mode="popLayout" initial={false}>
          {view === "stage" ? (
            <motion.div
              key="stage"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="flex min-h-0 flex-1 flex-col gap-3 sm:gap-4"
            >
              <div
                ref={focoRef}
                onDoubleClick={toggleFullscreen}
                className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-black/70 shadow-[0_0_55px_rgba(0,0,0,.55)]"
              >
                <MediaTile
                  {...selected}
                  connectionQuality={diagnostics[selected.id]?.quality}
                  sharingScreen={selected.sharingScreen}
                  className="h-full min-h-0 rounded-none border-0"
                  selected
                />
                <button
                  onClick={toggleFullscreen}
                  title={
                    isFullscreen
                      ? "Sair da tela cheia"
                      : "Tela cheia (ou toque duas vezes)"
                  }
                  aria-label={
                    isFullscreen ? "Sair da tela cheia" : "Ver em tela cheia"
                  }
                  className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/70 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur hover:bg-white/10"
                >
                  {isFullscreen ? (
                    <Shrink className="size-3.5" />
                  ) : (
                    <Expand className="size-3.5" />
                  )}
                  {isFullscreen ? "Sair" : "Tela cheia"}
                </button>
                <button
                  onClick={() =>
                    setPinnedId(current =>
                      togglePinnedParticipant(current, selected.id)
                    )
                  }
                  className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/70 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur hover:bg-white/10"
                >
                  <Pin className="size-3.5" />
                  {pinnedId === selected.id ? "Fixado" : "Fixar"}
                </button>
              </div>
              {thumbnails.length > 0 && (
                <div className="flex max-h-[23vh] shrink-0 gap-2 overflow-x-auto pb-1 sm:gap-3">
                  <AnimatePresence>
                    {thumbnails.map(participant => (
                      <motion.button
                        layout
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.2 }}
                        key={participant.id}
                        onClick={() => setPinnedId(participant.id)}
                        className="h-24 w-36 shrink-0 overflow-hidden rounded-xl border border-white/10 text-left sm:h-28 sm:w-48"
                        aria-label={`Exibir ${participant.label} no palco`}
                      >
                        <MediaTile
                          {...participant}
                          connectionQuality={diagnostics[participant.id]?.quality}
                          className="h-full rounded-xl border-0"
                          selected={pinnedId === participant.id}
                        />
                      </motion.button>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="grid min-h-0 flex-1 auto-rows-fr grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3"
            >
              <AnimatePresence>
                {participants.map(participant => (
                  <motion.button
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                    key={participant.id}
                    onClick={() => {
                      setPinnedId(participant.id);
                      setView("stage");
                    }}
                    className="min-h-[180px] overflow-hidden rounded-2xl border border-orange-300/20 text-left"
                    aria-label={`Exibir ${participant.label} no palco`}
                  >
                    <MediaTile
                      {...participant}
                      connectionQuality={diagnostics[participant.id]?.quality}
                      className="h-full min-h-[180px] rounded-2xl border-0"
                    />
                  </motion.button>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
        {rosterOpen && (
          <aside className="absolute bottom-4 right-4 top-4 z-10 w-[min(88vw,288px)] overflow-y-auto rounded-2xl border border-white/10 bg-[#171519]/95 p-3 shadow-2xl backdrop-blur-xl sm:bottom-5 sm:right-5 sm:top-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <p className="text-sm font-semibold text-white">Na chamada</p>
                <p className="mt-0.5 text-[11px] text-stone-400">
                  Diagnóstico de áudio ao vivo
                </p>
              </div>
              <button
                onClick={() => setRosterOpen(false)}
                className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-stone-300"
              >
                Fechar
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {participants.map(participant => {
                const diagnostic = diagnostics[participant.id];
                const detail = participant.isLocal
                  ? participant.microphoneOn
                    ? "Enviando microfone"
                    : "Microfone pausado"
                  : diagnostic?.connection === "connected"
                    ? diagnostic.receiving && diagnostic.sending
                      ? "Áudio enviando e recebendo"
                      : diagnostic.receiving
                        ? "Áudio recebendo"
                        : diagnostic.sending
                          ? "Áudio enviando"
                          : "Aguardando áudio"
                    : diagnostic?.quality === "recovering"
                      ? "Recuperando conexão"
                      : "Conectando mídia";
                const healthy =
                  participant.microphoneOn &&
                  diagnostic?.quality !== "recovering" &&
                  diagnostic?.quality !== "degraded";
                return (
                  <div
                    key={participant.id}
                    className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[.03] p-2.5"
                  >
                    <span className="grid size-8 place-items-center rounded-lg bg-orange-400/10 text-xs font-bold text-orange-100">
                      {participant.label.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-white">
                        {participant.label}
                        {participant.isLocal ? " (você)" : ""}
                        {participant.handRaised && (
                          <span
                            className="ml-1.5 text-orange-300"
                            aria-label="Pediu a palavra"
                          >
                            ✋
                          </span>
                        )}
                      </p>
                      <p
                        className={`mt-0.5 text-[10px] ${healthy ? "text-emerald-300" : "text-orange-200"}`}
                      >
                        {detail}
                      </p>
                    </div>
                    {canModerate &&
                      onMuteParticipant &&
                      !participant.isLocal &&
                      participant.microphoneOn && (
                        <button
                          onClick={() => onMuteParticipant(participant.id)}
                          title={`Silenciar ${participant.label} para todos`}
                          aria-label={`Silenciar ${participant.label}`}
                          className="grid size-7 shrink-0 place-items-center rounded-lg border border-white/10 text-stone-300 hover:border-rose-400/40 hover:text-rose-300"
                        >
                          <MicOff className="size-3.5" />
                        </button>
                      )}
                    <span
                      className={`size-2 rounded-full ${healthy ? "bg-emerald-400" : "bg-orange-300"}`}
                    />
                  </div>
                );
              })}
            </div>
            {onGateSensitivityChange && (
              <MicSensitivityMeter
                className="mt-4 rounded-lg border border-white/8 bg-black/20 p-2.5"
                level={micLevel}
                sensitivity={gateSensitivity}
                onSensitivityChange={onGateSensitivityChange}
              />
            )}
            <p className="mt-3 rounded-lg border border-white/8 bg-black/20 p-2.5 text-[10px] leading-4 text-stone-400">
              Cancelamento de eco e isolamento de voz são solicitados ao
              navegador de cada participante. Fone de ouvido resolve o vazamento
              por completo.
            </p>
          </aside>
        )}
      </main>

      <footer className="command-call-dock flex shrink-0 items-center justify-center gap-2 px-3 py-3 sm:gap-3">
        <div className="flex items-center">
          <button
            onClick={onToggleMic}
            className={`grid size-11 place-items-center rounded-l-xl border transition-colors ${microphoneOn ? "border-white/10 bg-white/5 text-white hover:bg-white/10" : "border-rose-500/30 bg-rose-500/20 text-rose-100"}`}
            aria-label={microphoneOn ? "Desligar microfone" : "Ligar microfone"}
          >
            {microphoneOn ? (
              <Mic className="size-5" />
            ) : (
              <MicOff className="size-5" />
            )}
          </button>
          {onChangeAudioDevice && <DeviceSelector kind="audioinput" activeDeviceId={activeAudioDeviceId} onChange={onChangeAudioDevice} audioConfig={audioConfig} onAudioConfigChange={onAudioConfigChange} />}
        </div>
        <div className="flex items-center">
          <button
            onClick={onToggleCamera}
            className={`grid size-11 place-items-center rounded-l-xl border transition-colors ${cameraOn ? "border-white/10 bg-white/5 text-white hover:bg-white/10" : "border-rose-500/30 bg-rose-500/20 text-rose-100"}`}
            aria-label={cameraOn ? "Desligar câmera" : "Ligar câmera"}
          >
            {cameraOn ? (
              <Video className="size-5" />
            ) : (
              <VideoOff className="size-5" />
            )}
          </button>
          {onChangeVideoDevice && <DeviceSelector kind="videoinput" activeDeviceId={activeVideoDeviceId} onChange={onChangeVideoDevice} />}
        </div>
        <button
          onClick={onShareScreen}
          className={`flex h-11 items-center gap-2 rounded-xl border px-3 text-[12px] font-semibold transition-colors ${sharingScreen ? "border-orange-300 bg-orange-500 text-black" : "border-white/10 bg-white/5 text-white hover:bg-white/10"}`}
        >
          <MonitorUp className="size-5" />
          <span className="hidden sm:inline">
            {sharingScreen ? "Parar transmissão" : "Compartilhar tela"}
          </span>
        </button>
        {onOpenMusic && (
          <button
            onClick={onOpenMusic}
            className={`grid size-11 place-items-center rounded-xl border transition-colors ${musicActive ? "border-orange-300/40 bg-orange-400/15 text-orange-100" : "border-white/10 bg-white/5 text-white hover:bg-white/10"}`}
            aria-label="Abrir música da sala"
          >
            <Music2 className="size-5" />
          </button>
        )}
        <button
          onClick={onToggleHandRaise}
          className={`grid size-11 place-items-center rounded-xl border transition-colors ${handRaised ? "border-orange-300 bg-orange-400 text-black" : "border-white/10 bg-white/5 text-white hover:bg-white/10"}`}
          aria-label={handRaised ? "Baixar a mão" : "Levantar a mão"}
        >
          <Hand className="size-5" />
        </button>
        <button
          onClick={onLeave}
          className="grid size-11 place-items-center rounded-xl bg-rose-500 text-white hover:bg-rose-400"
          aria-label="Sair da chamada"
        >
          <Phone className="size-5 rotate-[135deg]" />
        </button>
      </footer>
    </section>
  );
}
