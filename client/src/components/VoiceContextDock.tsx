import React from "react";
import { Mic, MicOff, MonitorUp, Phone, Settings2, Video, VideoOff, Volume2 } from "lucide-react";
import type { AudioInput } from "@/lib/audio-input";

type VoiceContextDockProps = {
  roomName: string;
  participantCount: number;
  microphoneOn: boolean;
  cameraOn: boolean;
  screenSharing: boolean;
  audioInputs: AudioInput[];
  selectedAudioInput: string;
  onAudioInputChange: (deviceId: string) => void;
  gateSensitivity: number;
  onGateSensitivityChange: (value: number) => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onShareScreen: () => void;
  onOpenFocus: () => void;
  onLeave: () => void;
};

export function VoiceContextDock({ roomName, participantCount, microphoneOn, cameraOn, screenSharing, audioInputs, selectedAudioInput, onAudioInputChange, gateSensitivity, onGateSensitivityChange, onToggleMic, onToggleCamera, onShareScreen, onOpenFocus, onLeave }: VoiceContextDockProps) {
  return <section className="voice-context-dock rounded-2xl border border-orange-300/20 bg-orange-400/[.06] p-3 shadow-[0_14px_30px_rgba(0,0,0,.18)]">
    <div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-orange-400 text-black"><Volume2 className="size-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-orange-50">{roomName}</p><p className="mt-0.5 text-[11px] text-stone-400">Conectado · {participantCount} na sala</p></div><button onClick={onOpenFocus} className="grid size-8 place-items-center rounded-lg border border-orange-300/20 text-orange-100 hover:bg-orange-400/10" aria-label="Abrir modo foco"><Settings2 className="size-4" /></button></div>
    <div className="mt-3 grid grid-cols-4 gap-1.5"><button onClick={onToggleMic} className={`grid h-9 place-items-center rounded-xl ${microphoneOn ? "bg-white/8 text-orange-50" : "bg-rose-500/20 text-rose-100"}`} aria-label={microphoneOn ? "Desligar microfone" : "Ligar microfone"}>{microphoneOn ? <Mic className="size-4" /> : <MicOff className="size-4" />}</button><button onClick={onToggleCamera} className={`grid h-9 place-items-center rounded-xl ${cameraOn ? "bg-white/8 text-orange-50" : "bg-rose-500/20 text-rose-100"}`} aria-label={cameraOn ? "Desligar câmera" : "Ligar câmera"}>{cameraOn ? <Video className="size-4" /> : <VideoOff className="size-4" />}</button><button onClick={onShareScreen} className={`grid h-9 place-items-center rounded-xl ${screenSharing ? "bg-orange-400 text-black" : "bg-white/8 text-orange-50"}`} aria-label={screenSharing ? "Parar compartilhamento" : "Compartilhar tela"}><MonitorUp className="size-4" /></button><button onClick={onLeave} className="grid h-9 place-items-center rounded-xl bg-rose-500 text-white" aria-label="Sair da chamada"><Phone className="size-4 rotate-[135deg]" /></button></div>
    <label className="mt-3 block rounded-xl bg-black/20 px-2.5 py-2 text-[11px] text-stone-400">
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5"><Volume2 className="size-3.5 text-orange-300" />Cortar som de fundo</span>
        <span className="font-mono text-[10px] text-stone-300">{gateSensitivity === 0 ? "desligado" : `${gateSensitivity}%`}</span>
      </span>
      <input aria-label="Cortar som de fundo" type="range" min="0" max="60" value={gateSensitivity} onChange={event => onGateSensitivityChange(Number(event.target.value))} className="mt-1.5 h-1 w-full accent-orange-400" />
      <span className="mt-1 block text-[10px] leading-4 text-stone-500">Seu microfone só transmite quando você fala. Aumente se estiver vazando som do computador.</span>
    </label>
    {audioInputs.length > 0 && <label className="mt-3 flex items-center gap-2 rounded-xl bg-black/20 px-2.5 py-2 text-[11px] text-stone-400"><Mic className="size-3.5 text-orange-300" /><span className="sr-only">Microfone</span><select aria-label="Microfone" value={selectedAudioInput} onChange={event => onAudioInputChange(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[11px] text-stone-200 outline-none"><option value="">Microfone padrão</option>{audioInputs.map(input => <option key={input.deviceId} value={input.deviceId}>{input.label}</option>)}</select></label>}
  </section>;
}
