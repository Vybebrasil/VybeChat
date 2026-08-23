import {
  ChevronDown,
  Maximize2,
  Mic,
  MicOff,
  Music2,
  MonitorUp,
  Phone,
  SlidersHorizontal,
  Video,
  VideoOff,
  Volume2,
} from "lucide-react";
import React, { useState } from "react";
import type { AudioInput } from "@/lib/audio-input";
import { MicSensitivityMeter } from "@/components/MicSensitivityMeter";
import {
  SCREEN_QUALITY_HINT,
  SCREEN_QUALITY_LABEL,
  type ScreenQuality,
} from "@/lib/screen-share";

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
  micLevel?: number;
  screenQuality?: ScreenQuality;
  onScreenQualityChange?: (quality: ScreenQuality) => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onShareScreen: () => void;
  onOpenMusic?: () => void;
  musicActive?: boolean;
  onOpenFocus: () => void;
  onLeave: () => void;
};

export function VoiceContextDock({
  roomName,
  participantCount,
  microphoneOn,
  cameraOn,
  screenSharing,
  audioInputs,
  selectedAudioInput,
  onAudioInputChange,
  gateSensitivity,
  onGateSensitivityChange,
  micLevel = 0,
  screenQuality = "nitida",
  onScreenQualityChange,
  onToggleMic,
  onToggleCamera,
  onShareScreen,
  onOpenMusic,
  musicActive = false,
  onOpenFocus,
  onLeave,
}: VoiceContextDockProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <section className="voice-context-dock p-2.5">
      <div className="flex items-center gap-2">
        <span className="voice-room-icon grid size-8 place-items-center rounded-lg">
          <Volume2 className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-white">
            {roomName}
          </p>
          <p className="mt-0.5 text-[11px] text-stone-400">
            Conectado · {participantCount} na sala
          </p>
        </div>
        <button
          onClick={onOpenFocus}
          className="grid size-8 place-items-center rounded-lg text-stone-200"
          aria-label="Expandir chamada"
          title="Expandir chamada"
        >
          <Maximize2 className="size-4" />
        </button>
      </div>

      <div
        className={`mt-2.5 grid gap-1.5 ${onOpenMusic ? "grid-cols-6" : "grid-cols-5"}`}
      >
        <button
          onClick={onToggleMic}
          className={`grid h-9 place-items-center rounded-lg ${microphoneOn ? "bg-white/7 text-white" : "bg-rose-500/18 text-rose-100"}`}
          aria-label={microphoneOn ? "Desligar microfone" : "Ligar microfone"}
          title={microphoneOn ? "Desligar microfone" : "Ligar microfone"}
        >
          {microphoneOn ? (
            <Mic className="size-4" />
          ) : (
            <MicOff className="size-4" />
          )}
        </button>
        <button
          onClick={onToggleCamera}
          className={`grid h-9 place-items-center rounded-lg ${cameraOn ? "bg-white/7 text-white" : "bg-rose-500/18 text-rose-100"}`}
          aria-label={cameraOn ? "Desligar câmera" : "Ligar câmera"}
          title={cameraOn ? "Desligar câmera" : "Ligar câmera"}
        >
          {cameraOn ? (
            <Video className="size-4" />
          ) : (
            <VideoOff className="size-4" />
          )}
        </button>
        <button
          onClick={onShareScreen}
          className={`grid h-9 place-items-center rounded-lg ${screenSharing ? "bg-orange-400 text-black" : "bg-white/7 text-white"}`}
          aria-label={
            screenSharing ? "Parar compartilhamento" : "Compartilhar tela"
          }
          title={screenSharing ? "Parar compartilhamento" : "Compartilhar tela"}
        >
          <MonitorUp className="size-4" />
        </button>
        <button
          onClick={() => setSettingsOpen(current => !current)}
          className={`grid h-9 place-items-center rounded-lg ${settingsOpen ? "bg-orange-400/15 text-orange-100" : "bg-white/7 text-white"}`}
          aria-label="Configurações da chamada"
          aria-expanded={settingsOpen}
          title="Configurações da chamada"
        >
          <SlidersHorizontal className="size-4" />
        </button>
        {onOpenMusic && (
          <button
            onClick={onOpenMusic}
            className={`relative grid h-9 place-items-center rounded-lg ${musicActive ? "bg-orange-400/15 text-orange-200" : "bg-white/7 text-white"}`}
            aria-label="Abrir música da sala"
            title="Música da sala"
          >
            <Music2 className="size-4" />
            {musicActive && (
              <span className="absolute right-1 top-1 size-1.5 rounded-full bg-emerald-400" />
            )}
          </button>
        )}
        <button
          onClick={onLeave}
          className="grid h-9 place-items-center rounded-lg bg-rose-500 text-white"
          aria-label="Sair da chamada"
          title="Sair da chamada"
        >
          <Phone className="size-4 rotate-[135deg]" />
        </button>
      </div>

      {settingsOpen && (
        <div className="voice-context-settings mt-3 space-y-3 pt-3">
          {onScreenQualityChange && (
            <section>
              <span className="flex items-center justify-between text-[11px] font-semibold text-stone-200">
                <span className="flex items-center gap-1.5">
                  <MonitorUp className="size-3.5 text-orange-300" />
                  Compartilhamento
                </span>
                <ChevronDown className="size-3.5 text-stone-500" />
              </span>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {(["nitida", "fluida"] as const).map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => onScreenQualityChange(option)}
                    aria-pressed={screenQuality === option}
                    className={`h-8 rounded-lg text-[11px] font-semibold ${screenQuality === option ? "bg-orange-400 text-black" : "bg-white/7 text-stone-200"}`}
                  >
                    {SCREEN_QUALITY_LABEL[option]}
                  </button>
                ))}
              </div>
              <span className="mt-1.5 block text-[10px] leading-4 text-stone-500">
                {SCREEN_QUALITY_HINT[screenQuality]}
              </span>
            </section>
          )}
          <MicSensitivityMeter
            className="rounded-lg bg-black/20 px-2.5 py-2"
            level={micLevel}
            sensitivity={gateSensitivity}
            onSensitivityChange={onGateSensitivityChange}
          />
          {audioInputs.length > 0 && (
            <label className="flex items-center gap-2 rounded-lg border border-white/8 bg-black/20 px-2.5 py-2 text-[11px] text-stone-400">
              <Mic className="size-3.5 text-orange-300" />
              <span className="sr-only">Microfone</span>
              <select
                aria-label="Microfone"
                value={selectedAudioInput}
                onChange={event => onAudioInputChange(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[11px] text-stone-200 outline-none"
              >
                <option value="">Microfone padrão</option>
                {audioInputs.map(input => (
                  <option key={input.deviceId} value={input.deviceId}>
                    {input.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
    </section>
  );
}
