import React from "react";
import { AudioLines, Mic, MicOff, MonitorUp, Phone, Settings2, ShieldCheck, Video, VideoOff, Volume2 } from "lucide-react";
import type { AudioInput } from "@/lib/audio-input";
import type { VoiceFocusMode } from "@/lib/voice-focus";

type VoiceContextDockProps = {
  roomName: string;
  participantCount: number;
  microphoneOn: boolean;
  cameraOn: boolean;
  screenSharing: boolean;
  audioInputs: AudioInput[];
  selectedAudioInput: string;
  voiceFocusEnabled: boolean;
  voiceFocusMode: VoiceFocusMode;
  voiceFocusLevel: number;
  voiceFocusGateOpen: boolean;
  voiceFocusWarning: string | null;
  onAudioInputChange: (deviceId: string) => void;
  onToggleVoiceFocus: () => void;
  onVoiceFocusModeChange: (mode: VoiceFocusMode) => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onShareScreen: () => void;
  onOpenFocus: () => void;
  onLeave: () => void;
};

export function VoiceContextDock({ roomName, participantCount, microphoneOn, cameraOn, screenSharing, audioInputs, selectedAudioInput, voiceFocusEnabled, voiceFocusMode, voiceFocusLevel, voiceFocusGateOpen, voiceFocusWarning, onAudioInputChange, onToggleVoiceFocus, onVoiceFocusModeChange, onToggleMic, onToggleCamera, onShareScreen, onOpenFocus, onLeave }: VoiceContextDockProps) {
  return <section className="voice-context-dock rounded-2xl border border-orange-300/20 bg-orange-400/[.06] p-3 shadow-[0_14px_30px_rgba(0,0,0,.18)]">
    <div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-orange-400 text-black"><Volume2 className="size-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-orange-50">{roomName}</p><p className="mt-0.5 text-[11px] text-stone-400">Conectado · {participantCount} na sala</p></div><button onClick={onOpenFocus} className="grid size-8 place-items-center rounded-lg border border-orange-300/20 text-orange-100 hover:bg-orange-400/10" aria-label="Abrir modo foco"><Settings2 className="size-4" /></button></div>
    <div className="mt-3 grid grid-cols-4 gap-1.5"><button onClick={onToggleMic} className={`grid h-9 place-items-center rounded-xl ${microphoneOn ? "bg-white/8 text-orange-50" : "bg-rose-500/20 text-rose-100"}`} aria-label={microphoneOn ? "Desligar microfone" : "Ligar microfone"}>{microphoneOn ? <Mic className="size-4" /> : <MicOff className="size-4" />}</button><button onClick={onToggleCamera} className={`grid h-9 place-items-center rounded-xl ${cameraOn ? "bg-white/8 text-orange-50" : "bg-rose-500/20 text-rose-100"}`} aria-label={cameraOn ? "Desligar câmera" : "Ligar câmera"}>{cameraOn ? <Video className="size-4" /> : <VideoOff className="size-4" />}</button><button onClick={onShareScreen} className={`grid h-9 place-items-center rounded-xl ${screenSharing ? "bg-orange-400 text-black" : "bg-white/8 text-orange-50"}`} aria-label={screenSharing ? "Parar compartilhamento" : "Compartilhar tela"}><MonitorUp className="size-4" /></button><button onClick={onLeave} className="grid h-9 place-items-center rounded-xl bg-rose-500 text-white" aria-label="Sair da chamada"><Phone className="size-4 rotate-[135deg]" /></button></div>
    {audioInputs.length > 0 && <label className="mt-3 flex items-center gap-2 rounded-xl bg-black/20 px-2.5 py-2 text-[11px] text-stone-400"><Mic className="size-3.5 text-orange-300" /><span className="sr-only">Microfone</span><select aria-label="Microfone" value={selectedAudioInput} onChange={event => onAudioInputChange(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[11px] text-stone-200 outline-none"><option value="">Microfone padrão</option>{audioInputs.map(input => <option key={input.deviceId} value={input.deviceId}>{input.label}</option>)}</select></label>}
    <div className={`mt-3 rounded-xl border p-2.5 ${voiceFocusEnabled ? "border-emerald-400/25 bg-emerald-400/[.07]" : "border-white/8 bg-black/20"}`}><div className="flex items-center gap-2"><ShieldCheck className={`size-3.5 ${voiceFocusEnabled ? "text-emerald-300" : "text-stone-500"}`} /><div className="min-w-0 flex-1"><p className="text-[11px] font-semibold text-stone-100">Foco de voz</p><p className="text-[10px] text-stone-400">{voiceFocusEnabled ? voiceFocusGateOpen ? "Transmitindo fala" : "Filtrando som ambiente" : "Desativado"}</p></div><button onClick={onToggleVoiceFocus} className={`rounded-lg px-2 py-1 text-[10px] font-semibold ${voiceFocusEnabled ? "bg-emerald-400 text-black" : "bg-white/8 text-stone-200"}`}>{voiceFocusEnabled ? "Ativo" : "Ativar"}</button></div>{voiceFocusEnabled && <><div className="mt-2 h-1 overflow-hidden rounded-full bg-black/40"><div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-orange-300 transition-[width] duration-100" style={{ width: `${Math.max(2, voiceFocusLevel)}%` }} /></div><label className="mt-2 flex items-center gap-1.5 text-[10px] text-stone-400"><AudioLines className="size-3" />Filtro<select aria-label="Intensidade do foco de voz" value={voiceFocusMode} onChange={event => onVoiceFocusModeChange(event.target.value as VoiceFocusMode)} className="ml-auto bg-transparent text-[10px] text-stone-200 outline-none"><option value="balanced">Equilibrado</option><option value="strong">Forte</option></select></label></>}{voiceFocusWarning && <p className="mt-2 text-[10px] leading-4 text-orange-200">{voiceFocusWarning}</p>}</div>
  </section>;
}
