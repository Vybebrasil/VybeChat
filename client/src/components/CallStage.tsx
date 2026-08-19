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
    <section ref={stageRef} className="fixed inset-0 z-50 flex min-h-screen flex-col bg-[#08060d] text-white">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 bg-[#100c17]/96 px-3 sm:px-5">
        <span className="grid size-9 place-items-center rounded-xl bg-violet-500/15 text-violet-200"><Volume2 className="size-4" /></span>
        <div className="min-w-0"><p className="truncate text-sm font-bold">{roomName}</p><p className="text-[11px] text-slate-400">{participants.length} participante{participants.length === 1 ? "" : "s"} na chamada</p></div>
        {selected.sharingScreen && <span className="ml-auto hidden items-center gap-1.5 rounded-full border border-violet-200/20 bg-violet-500/15 px-3 py-1 text-[11px] font-semibold text-violet-100 sm:flex"><MonitorUp className="size-3.5" />Tela compartilhada</span>}
        <button onClick={() => setView(getNextCallStageView)} className="grid size-9 place-items-center rounded-lg bg-white/6 text-slate-200 hover:bg-white/12" aria-label={view === "stage" ? "Abrir grade de participantes" : "Abrir palco principal"}>{view === "stage" ? <Grid2X2 className="size-4" /> : <MonitorUp className="size-4" />}</button>
        <button onClick={toggleFullscreen} className="grid size-9 place-items-center rounded-lg bg-white/6 text-slate-200 hover:bg-white/12" aria-label={isFullscreen ? "Sair da tela cheia" : "Abrir em tela cheia"}>{isFullscreen ? <Minimize2 className="size-4" /> : <Pin className="size-4" />}</button>
        <button onClick={onMinimize} className="grid size-9 place-items-center rounded-lg bg-white/6 text-slate-200 hover:bg-white/12" aria-label="Minimizar chamada"><Minimize2 className="size-4" /></button>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:gap-4 sm:p-5">
        {view === "stage" ? <><div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-[#110d18] shadow-2xl">
          <MediaTile {...selected} sharingScreen={selected.sharingScreen} className="h-full min-h-0 rounded-none border-0" selected />
          <button onClick={() => setPinnedId(current => togglePinnedParticipant(current, selected.id))} className="absolute right-3 top-3 flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/55 px-2.5 py-1.5 text-[11px] font-semibold text-white backdrop-blur hover:bg-black/75"><Pin className="size-3.5" />{pinnedId === selected.id ? "Fixado" : "Fixar"}</button>
        </div>
        {thumbnails.length > 0 && <div className="flex max-h-[23vh] shrink-0 gap-2 overflow-x-auto pb-1 sm:gap-3">
          {thumbnails.map(participant => <button key={participant.id} onClick={() => setPinnedId(participant.id)} className="h-24 w-36 shrink-0 overflow-hidden rounded-xl text-left sm:h-28 sm:w-48" aria-label={`Exibir ${participant.label} no palco`}><MediaTile {...participant} sharingScreen={participant.sharingScreen} className="h-full min-h-0 rounded-xl" /></button>)}
        </div>}</> : <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">{participants.map(participant => <button key={participant.id} onClick={() => { setPinnedId(participant.id); setView("stage"); }} className="min-h-[180px] overflow-hidden rounded-2xl text-left" aria-label={`Exibir ${participant.label} no palco`}><MediaTile {...participant} sharingScreen={participant.sharingScreen} className="h-full min-h-[180px]" /></button>)}</div>}
      </main>

      <footer className="flex shrink-0 items-center justify-center gap-2 border-t border-white/10 bg-[#100c17]/96 px-3 py-3 sm:gap-3">
        <button onClick={onToggleMic} className={`grid size-11 place-items-center rounded-xl transition-colors ${microphoneOn ? "bg-white/8 text-white hover:bg-white/14" : "bg-rose-500/20 text-rose-100"}`} aria-label={microphoneOn ? "Desligar microfone" : "Ligar microfone"}>{microphoneOn ? <Mic className="size-5" /> : <MicOff className="size-5" />}</button>
        <button onClick={onToggleCamera} className={`grid size-11 place-items-center rounded-xl transition-colors ${cameraOn ? "bg-white/8 text-white hover:bg-white/14" : "bg-rose-500/20 text-rose-100"}`} aria-label={cameraOn ? "Desligar câmera" : "Ligar câmera"}>{cameraOn ? <Video className="size-5" /> : <VideoOff className="size-5" />}</button>
        <button onClick={onShareScreen} className={`flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors ${sharingScreen ? "bg-violet-500 text-white" : "bg-white/8 text-white hover:bg-white/14"}`}><MonitorUp className="size-5" /><span className="hidden sm:inline">{sharingScreen ? "Parar de compartilhar" : "Compartilhar tela"}</span></button>
        <button onClick={onLeave} className="grid size-11 place-items-center rounded-xl bg-rose-500 text-white hover:bg-rose-400" aria-label="Sair da chamada"><Phone className="size-5 rotate-[135deg]" /></button>
      </footer>
    </section>
  );
}
