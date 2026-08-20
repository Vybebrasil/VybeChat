import { Grid2X2, Hand, Mic, MicOff, Minimize2, MonitorUp, Phone, Pin, Video, VideoOff, Volume2 } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { getStageTile, getThumbnailTiles, type CallStageTile as CallStageTileState } from "@/lib/call-stage";
import { getNextCallStageView, togglePinnedParticipant, type CallStageView } from "@/lib/call-stage-ui";
import { MediaTile } from "@/components/MediaTile";
import { isFullscreenActive, toggleFullscreen as toggleDocumentFullscreen, type FullscreenDocumentLike, type FullscreenElementLike } from "@/lib/fullscreen";
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

type CallStageProps = {
  roomName: string;
  participants: StageParticipant[];
  microphoneOn: boolean;
  cameraOn: boolean;
  sharingScreen: boolean;
  handRaised?: boolean;
  diagnostics?: Record<string, PeerAudioDiagnostics>;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onShareScreen: () => void;
  onToggleHandRaise?: () => void;
  onLeave: () => void;
  onMinimize: () => void;
};

export function CallStage({
  roomName,
  participants,
  microphoneOn,
  cameraOn,
  sharingScreen,
  handRaised = false,
  diagnostics = {},
  onToggleMic,
  onToggleCamera,
  onShareScreen,
  onToggleHandRaise = () => {},
  onLeave,
  onMinimize,
}: CallStageProps) {
  const stageRef = useRef<HTMLElement>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [view, setView] = useState<CallStageView>("stage");
  const [rosterOpen, setRosterOpen] = useState(false);
  const selected = useMemo(() => getStageTile(participants, pinnedId), [participants, pinnedId]);
  const thumbnails = useMemo(() => getThumbnailTiles(participants, selected?.id ?? null), [participants, selected?.id]);
  const callQuality = Object.values(diagnostics).some(item => item.quality === "recovering") ? "Recuperando conexão" : Object.values(diagnostics).some(item => item.quality === "degraded") ? "Conexão instável" : Object.values(diagnostics).some(item => item.quality === "connecting") ? "Conectando mídia" : "Conexão estável";

  useEffect(() => {
    if (pinnedId && !participants.some(participant => participant.id === pinnedId)) setPinnedId(null);
  }, [participants, pinnedId]);

  useEffect(() => {
    const syncFullscreen = () => {
      setIsFullscreen(isFullscreenActive(document as FullscreenDocumentLike));
    };
    document.addEventListener("fullscreenchange", syncFullscreen);
    document.addEventListener("webkitfullscreenchange", syncFullscreen as EventListener);
    syncFullscreen();
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreen);
      document.removeEventListener("webkitfullscreenchange", syncFullscreen as EventListener);
    };
  }, []);

  const toggleFullscreen = async () => {
    const element = stageRef.current as FullscreenElementLike | null;
    if (!element) return;
    await toggleDocumentFullscreen(document as FullscreenDocumentLike, element);
  };

  if (!selected) return null;

  return (
    <section ref={stageRef} className="command-call-stage fixed inset-0 z-50 flex min-h-screen flex-col text-white">
      <header className="command-call-header flex h-16 shrink-0 items-center gap-3 px-3 sm:px-5">
        <span className="grid size-10 place-items-center rounded-xl border border-white/10 bg-orange-400/10 text-orange-300"><Volume2 className="size-4" /></span>
        <div className="min-w-0"><p className="truncate font-sans text-sm font-semibold text-white">{roomName}</p><p className="text-[11px] text-stone-400">{participants.length} participante{participants.length === 1 ? "" : "s"} na chamada</p></div>
        {selected.sharingScreen && <span className="ml-auto hidden items-center gap-1.5 rounded-full bg-orange-400/15 px-3 py-1.5 text-[11px] font-semibold text-orange-100 sm:flex"><MonitorUp className="size-3.5" />Tela ao vivo</span>}
        <span className={`hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold sm:flex ${microphoneOn ? "bg-emerald-400/10 text-emerald-200" : "bg-rose-400/10 text-rose-200"}`}><span className={`size-1.5 rounded-full ${microphoneOn ? "bg-emerald-400" : "bg-rose-400"}`} />{microphoneOn ? "Microfone ativo" : "Microfone pausado"}</span><span className={`hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold lg:flex ${callQuality === "Conexão estável" ? "bg-emerald-400/10 text-emerald-200" : callQuality === "Conectando mídia" ? "bg-orange-400/10 text-orange-100" : "bg-rose-400/10 text-rose-200"}`}><span className={`size-1.5 rounded-full ${callQuality === "Conexão estável" ? "bg-emerald-400" : callQuality === "Conectando mídia" ? "bg-orange-300" : "bg-rose-400"}`} />{callQuality}</span>
        <button onClick={() => setRosterOpen(current => !current)} className={`grid size-9 place-items-center rounded-lg border text-xs font-bold transition-colors ${rosterOpen ? "border-orange-300/50 bg-orange-400/15 text-orange-100" : "border-white/10 bg-white/5 text-stone-200 hover:bg-white/10"}`} aria-label={rosterOpen ? "Fechar participantes" : "Abrir participantes"}>{participants.length}</button>
        <button onClick={() => setView(getNextCallStageView)} className="grid size-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-stone-200 hover:bg-white/10" aria-label={view === "stage" ? "Abrir grade de participantes" : "Abrir palco principal"}>{view === "stage" ? <Grid2X2 className="size-4" /> : <MonitorUp className="size-4" />}</button>
        <button onClick={toggleFullscreen} className="grid size-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-stone-200 hover:bg-white/10" aria-label={isFullscreen ? "Sair da tela cheia" : "Abrir em tela cheia"}>{isFullscreen ? <Minimize2 className="size-4" /> : <Pin className="size-4" />}</button>
        <button onClick={onMinimize} className="grid size-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-stone-200 hover:bg-white/10" aria-label="Minimizar chamada"><Minimize2 className="size-4" /></button>
      </header>

      <main className="relative flex min-h-0 flex-1 flex-col gap-3 p-3 sm:gap-4 sm:p-5">
        {view === "stage" ? <><div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-black/70 shadow-[0_0_55px_rgba(0,0,0,.55)]">
          <MediaTile {...selected} sharingScreen={selected.sharingScreen} className="h-full min-h-0 rounded-none border-0" selected />
          <button onClick={() => setPinnedId(current => togglePinnedParticipant(current, selected.id))} className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/70 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur hover:bg-white/10"><Pin className="size-3.5" />{pinnedId === selected.id ? "Fixado" : "Fixar"}</button>
        </div>
        {thumbnails.length > 0 && <div className="flex max-h-[23vh] shrink-0 gap-2 overflow-x-auto pb-1 sm:gap-3">
          {thumbnails.map(participant => <button key={participant.id} onClick={() => setPinnedId(participant.id)} className="h-24 w-36 shrink-0 overflow-hidden rounded-xl border border-white/10 text-left sm:h-28 sm:w-48" aria-label={`Exibir ${participant.label} no palco`}><MediaTile {...participant} sharingScreen={participant.sharingScreen} className="h-full min-h-0 rounded-none" /></button>)}
        </div>}</> : <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">{participants.map(participant => <button key={participant.id} onClick={() => { setPinnedId(participant.id); setView("stage"); }} className="min-h-[180px] overflow-hidden border border-orange-300/20 text-left" aria-label={`Exibir ${participant.label} no palco`}><MediaTile {...participant} sharingScreen={participant.sharingScreen} className="h-full min-h-[180px]" /></button>)}</div>}
        {rosterOpen && <aside className="absolute bottom-4 right-4 top-4 z-10 w-[min(88vw,288px)] overflow-y-auto rounded-2xl border border-white/10 bg-[#171519]/95 p-3 shadow-2xl backdrop-blur-xl sm:bottom-5 sm:right-5 sm:top-5"><div className="flex items-center justify-between border-b border-white/10 pb-3"><div><p className="text-sm font-semibold text-white">Na chamada</p><p className="mt-0.5 text-[11px] text-stone-400">Diagnóstico de áudio ao vivo</p></div><button onClick={() => setRosterOpen(false)} className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-stone-300">Fechar</button></div><div className="mt-3 space-y-2">{participants.map(participant => { const diagnostic = diagnostics[participant.id]; const detail = participant.isLocal ? (participant.microphoneOn ? "Enviando microfone" : "Microfone pausado") : diagnostic?.connection === "connected" ? diagnostic.receiving && diagnostic.sending ? "Áudio enviando e recebendo" : diagnostic.receiving ? "Áudio recebendo" : diagnostic.sending ? "Áudio enviando" : "Aguardando áudio" : diagnostic?.quality === "recovering" ? "Recuperando conexão" : "Conectando mídia"; const healthy = participant.microphoneOn && diagnostic?.quality !== "recovering" && diagnostic?.quality !== "degraded"; return <div key={participant.id} className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[.03] p-2.5"><span className="grid size-8 place-items-center rounded-lg bg-orange-400/10 text-xs font-bold text-orange-100">{participant.label.slice(0, 1).toUpperCase()}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-white">{participant.label}{participant.isLocal ? " (você)" : ""}{participant.handRaised && <span className="ml-1.5 text-orange-300" aria-label="Pediu a palavra">✋</span>}</p><p className={`mt-0.5 text-[10px] ${healthy ? "text-emerald-300" : "text-orange-200"}`}>{detail}</p></div><span className={`size-2 rounded-full ${healthy ? "bg-emerald-400" : "bg-orange-300"}`} /></div> })}</div><p className="mt-4 rounded-lg border border-white/8 bg-black/20 p-2.5 text-[10px] leading-4 text-stone-400">Cancelamento de eco, supressão de ruído e ganho automático são solicitados ao navegador de cada participante.</p></aside>}
      </main>

      <footer className="command-call-dock flex shrink-0 items-center justify-center gap-2 px-3 py-3 sm:gap-3">
        <button onClick={onToggleMic} className={`grid size-11 place-items-center rounded-xl border transition-colors ${microphoneOn ? "border-white/10 bg-white/5 text-white hover:bg-white/10" : "border-rose-500/30 bg-rose-500/20 text-rose-100"}`} aria-label={microphoneOn ? "Desligar microfone" : "Ligar microfone"}>{microphoneOn ? <Mic className="size-5" /> : <MicOff className="size-5" />}</button>
        <button onClick={onToggleCamera} className={`grid size-11 place-items-center rounded-xl border transition-colors ${cameraOn ? "border-white/10 bg-white/5 text-white hover:bg-white/10" : "border-rose-500/30 bg-rose-500/20 text-rose-100"}`} aria-label={cameraOn ? "Desligar câmera" : "Ligar câmera"}>{cameraOn ? <Video className="size-5" /> : <VideoOff className="size-5" />}</button>
        <button onClick={onShareScreen} className={`flex h-11 items-center gap-2 rounded-xl border px-3 text-[12px] font-semibold transition-colors ${sharingScreen ? "border-orange-300 bg-orange-500 text-black" : "border-white/10 bg-white/5 text-white hover:bg-white/10"}`}><MonitorUp className="size-5" /><span className="hidden sm:inline">{sharingScreen ? "Parar transmissão" : "Compartilhar tela"}</span></button>
        <button onClick={onToggleHandRaise} className={`grid size-11 place-items-center rounded-xl border transition-colors ${handRaised ? "border-orange-300 bg-orange-400 text-black" : "border-white/10 bg-white/5 text-white hover:bg-white/10"}`} aria-label={handRaised ? "Baixar a mão" : "Levantar a mão"}><Hand className="size-5" /></button>
        <button onClick={onLeave} className="grid size-11 place-items-center rounded-xl bg-rose-500 text-white hover:bg-rose-400" aria-label="Sair da chamada"><Phone className="size-5 rotate-[135deg]" /></button>
      </footer>
    </section>
  );
}
