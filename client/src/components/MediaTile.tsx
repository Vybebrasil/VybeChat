import { MicOff, MonitorUp, VideoOff, Volume2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { normalizeParticipantVolume, toMediaElementVolume } from "@/lib/participant-volume";

type MediaTileProps = {
  stream: MediaStream | null;
  label: string;
  muted?: boolean;
  isLocal?: boolean;
  cameraOn?: boolean;
  microphoneOn?: boolean;
  speaking?: boolean;
  sharingScreen?: boolean;
  accent?: boolean;
  volume?: number;
  onVolumeChange?: (volume: number) => void;
};

export function MediaTile({
  stream,
  label,
  muted = false,
  isLocal = false,
  cameraOn = true,
  microphoneOn = true,
  speaking = false,
  sharingScreen = false,
  accent = false,
  volume = 100,
  onVolumeChange,
}: MediaTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.volume = toMediaElementVolume(volume);
  }, [volume]);

  return (
    <article className={`relative min-h-[170px] overflow-hidden rounded-2xl border bg-[#14101d] transition-all ${speaking ? "border-emerald-300/90 shadow-[0_0_0_2px_rgba(52,211,153,.22),0_0_28px_rgba(52,211,153,.22)]" : accent ? "border-violet-400/80 shadow-[0_0_28px_rgba(139,92,246,.28)]" : "border-white/10"}`}>
      {stream && cameraOn ? (
        <video ref={videoRef} autoPlay playsInline muted={muted} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_center,rgba(117,68,212,.24),transparent_58%)]">
          <span className="grid size-16 place-items-center rounded-full border border-violet-300/30 bg-violet-400/15 text-xl font-bold text-violet-100">{label.slice(0, 1).toUpperCase()}</span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 pt-10">
        <span className="text-sm font-semibold text-white">{label}{isLocal ? " (você)" : ""}</span>
        <span className="flex items-center gap-1.5 text-white/80">
          {sharingScreen && <MonitorUp className="size-4 text-violet-200" />}
          {!microphoneOn && <MicOff className="size-4" />}
          {!cameraOn && <VideoOff className="size-4" />}
        </span>
      </div>
      {onVolumeChange && <label className="absolute inset-x-3 bottom-11 flex items-center gap-2 rounded-lg bg-black/55 px-2 py-1.5 text-white/75"><Volume2 className="size-3.5 shrink-0" /><input aria-label={`Volume de ${label}`} type="range" min="0" max="150" value={normalizeParticipantVolume(volume)} onChange={event => onVolumeChange(normalizeParticipantVolume(Number(event.target.value)))} className="h-1 w-full accent-violet-400" /><span className="w-8 text-right font-mono text-[10px]">{normalizeParticipantVolume(volume)}%</span></label>}
      <div className="absolute left-3 top-3 flex gap-1.5">{sharingScreen && <span className="rounded-full border border-violet-200/30 bg-violet-500/85 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-white">Tela ao vivo</span>}{speaking && <span className="rounded-full border border-emerald-200/25 bg-emerald-400/85 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-950">Falando</span>}</div>
    </article>
  );
}
