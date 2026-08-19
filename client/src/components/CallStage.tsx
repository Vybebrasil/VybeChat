import { Grid2X2, Mic, MicOff, Minimize2, MonitorUp, Phone, Pin, Video, VideoOff, Volume2 } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { getStageTile, getThumbnailTiles, type CallStageTile as CallStageTileState } from "@/lib/call-stage";
import { getNextCallStageView, togglePinnedParticipant, type CallStageView } from "@/lib/call-stage-ui";
import { MediaTile } from "@/components/MediaTile";
import { isFullscreenActive, toggleFullscreen as toggleDocumentFullscreen, type FullscreenDocumentLike, type FullscreenElementLike } from "@/lib/fullscreen";

type StageParticipant = CallStageTileState & {
  stream: MediaStream | null;
  label: string;
  muted?: boolean;
  isLocal?: boolean;
  cameraOn?: boolean;
  microphoneOn?: boolean;
  speaking?: boolean;
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
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onShareScreen: () => void;
  onLeave: () => void;
  onMinimize: () => void;
};

export function CallStage({
  roomName,
  participants,
  microphoneOn,
  cameraOn,
  sharingScreen,
  onToggleMic,
  onToggleCamera,
  onShareScreen,
  onLeave,
  onMinimize,
}: CallStageProps) {
  const stageRef = useRef<HTMLElement>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [view, setView] = useState<CallStageView>("stage");
  const selected = useMemo(() => getStageTile(participants, pinnedId), [participants, pinnedId]);
  const thumbnails = useMemo(() => getThumbnailTiles(participants, selected?.id ?? null), [participants, selected?.id]);

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
    <section ref={stageRef} className="cyber-grid fixed inset-0 z-50 flex min-h-screen flex-col bg-[#07080b] text-white">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-orange-300/20 bg-[#0c0d10]/96 px-3 sm:px-5">
        <span className="grid size-9 place-items-center border border-orange-300/30 bg-orange-400/10 text-orange-300"><Volume2 className="size-4" /></span>
        <div className="min-w-0"><p className="truncate [font-family:Orbitron] text-sm font-bold tracking-wide text-orange-50">{roomName}</p><p className="font-mono text-[10px] uppercase tracking-wider text-orange-300/65">{participants.length} participante{participants.length === 1 ? "" : "s"} no link</p></div>
        {selected.sharingScreen && <span className="ml-auto hidden items-center gap-1.5 border border-orange-300/30 bg-orange-400/10 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-orange-100 sm:flex"><MonitorUp className="size-3.5" />Tela ao vivo</span>}
        <button onClick={() => setView(getNextCallStageView)} className="grid size-9 place-items-center border border-orange-300/20 bg-white/4 text-orange-100 hover:bg-orange-400/10" aria-label={view === "stage" ? "Abrir grade de participantes" : "Abrir palco principal"}>{view === "stage" ? <Grid2X2 className="size-4" /> : <MonitorUp className="size-4" />}</button>
        <button onClick={toggleFullscreen} className="grid size-9 place-items-center border border-orange-300/20 bg-white/4 text-orange-100 hover:bg-orange-400/10" aria-label={isFullscreen ? "Sair da tela cheia" : "Abrir em tela cheia"}>{isFullscreen ? <Minimize2 className="size-4" /> : <Pin className="size-4" />}</button>
        <button onClick={onMinimize} className="grid size-9 place-items-center border border-orange-300/20 bg-white/4 text-orange-100 hover:bg-orange-400/10" aria-label="Minimizar chamada"><Minimize2 className="size-4" /></button>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:gap-4 sm:p-5">
        {view === "stage" ? <><div className="relative min-h-0 flex-1 overflow-hidden border border-orange-300/25 bg-black/70 shadow-[0_0_55px_rgba(0,0,0,.55)]">
          <MediaTile {...selected} sharingScreen={selected.sharingScreen} className="h-full min-h-0 rounded-none border-0" selected />
          <button onClick={() => setPinnedId(current => togglePinnedParticipant(current, selected.id))} className="absolute right-3 top-3 flex items-center gap-1.5 border border-orange-300/30 bg-black/75 px-2.5 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-orange-100 backdrop-blur hover:bg-orange-400/15"><Pin className="size-3.5" />{pinnedId === selected.id ? "Fixado" : "Fixar"}</button>
        </div>
        {thumbnails.length > 0 && <div className="flex max-h-[23vh] shrink-0 gap-2 overflow-x-auto pb-1 sm:gap-3">
          {thumbnails.map(participant => <button key={participant.id} onClick={() => setPinnedId(participant.id)} className="h-24 w-36 shrink-0 overflow-hidden border border-orange-300/20 text-left sm:h-28 sm:w-48" aria-label={`Exibir ${participant.label} no palco`}><MediaTile {...participant} sharingScreen={participant.sharingScreen} className="h-full min-h-0 rounded-none" /></button>)}
        </div>}</> : <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">{participants.map(participant => <button key={participant.id} onClick={() => { setPinnedId(participant.id); setView("stage"); }} className="min-h-[180px] overflow-hidden border border-orange-300/20 text-left" aria-label={`Exibir ${participant.label} no palco`}><MediaTile {...participant} sharingScreen={participant.sharingScreen} className="h-full min-h-[180px]" /></button>)}</div>}
      </main>

      <footer className="flex shrink-0 items-center justify-center gap-2 border-t border-orange-300/20 bg-[#0c0d10]/96 px-3 py-3 sm:gap-3">
        <button onClick={onToggleMic} className={`grid size-11 place-items-center border transition-colors ${microphoneOn ? "border-orange-300/20 bg-white/5 text-orange-100 hover:bg-orange-400/10" : "border-rose-500/30 bg-rose-500/20 text-rose-100"}`} aria-label={microphoneOn ? "Desligar microfone" : "Ligar microfone"}>{microphoneOn ? <Mic className="size-5" /> : <MicOff className="size-5" />}</button>
        <button onClick={onToggleCamera} className={`grid size-11 place-items-center border transition-colors ${cameraOn ? "border-orange-300/20 bg-white/5 text-orange-100 hover:bg-orange-400/10" : "border-rose-500/30 bg-rose-500/20 text-rose-100"}`} aria-label={cameraOn ? "Desligar câmera" : "Ligar câmera"}>{cameraOn ? <Video className="size-5" /> : <VideoOff className="size-5" />}</button>
        <button onClick={onShareScreen} className={`flex h-11 items-center gap-2 border px-3 font-mono text-[11px] font-semibold uppercase tracking-wide transition-colors ${sharingScreen ? "border-orange-300 bg-orange-500 text-black" : "border-orange-300/20 bg-white/5 text-orange-100 hover:bg-orange-400/10"}`}><MonitorUp className="size-5" /><span className="hidden sm:inline">{sharingScreen ? "Parar transmissão" : "Compartilhar tela"}</span></button>
        <button onClick={onLeave} className="grid size-11 place-items-center bg-rose-500 text-white hover:bg-rose-400" aria-label="Sair da chamada"><Phone className="size-5 rotate-[135deg]" /></button>
      </footer>
    </section>
  );
}
