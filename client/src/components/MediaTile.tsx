import { MicOff, MonitorUp, VideoOff, Volume2, AlertTriangle, Activity, Loader2, PictureInPicture2 } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { normalizeParticipantVolume } from "@/lib/participant-volume";
import { motion } from "framer-motion";

type MediaTileProps = {
  stream: MediaStream | null;
  label: string;
  /** Mantido para compatibilidade: o audio remoto agora sai pelo CallAudioSink. */
  muted?: boolean;
  isLocal?: boolean;
  cameraOn?: boolean;
  microphoneOn?: boolean;
  speaking?: boolean;
  sharingScreen?: boolean;
  accent?: boolean;
  volume?: number;
  onVolumeChange?: (volume: number) => void;
  className?: string;
  selected?: boolean;
  onSelect?: () => void;
  connectionQuality?: "connecting" | "stable" | "degraded" | "recovering";
};

export function MediaTile({
  stream,
  label,
  isLocal = false,
  cameraOn = true,
  microphoneOn = true,
  speaking = false,
  sharingScreen = false,
  accent = false,
  volume = 100,
  onVolumeChange,
  className = "",
  selected = false,
  onSelect,
  connectionQuality = "stable",
}: MediaTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLElement>(null);
  const [canPip, setCanPip] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    setCanPip(typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && !!document.pictureInPictureEnabled);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting);
    }, { threshold: 0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!videoRef.current) return;
    if (isVisible && stream) {
      if (videoRef.current.srcObject !== stream) videoRef.current.srcObject = stream;
      void videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.srcObject = null;
    }
  }, [stream, cameraOn, isVisible]);

  const togglePip = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement === videoRef.current) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.warn("Failed to enter PiP", err);
    }
  };

  return (
    <motion.article
      ref={containerRef as any}
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      onClick={onSelect} 
      className={`relative group overflow-hidden rounded-2xl border bg-[#0b0a08] transition-all ${onSelect ? "cursor-pointer" : ""} ${selected ? "ring-2 ring-orange-300/75" : ""} ${speaking ? "border-emerald-300/90 shadow-[0_0_0_2px_rgba(52,211,153,.22),0_0_28px_rgba(52,211,153,.22)]" : accent ? "border-orange-400/80 shadow-[0_0_28px_rgba(255,126,18,.26)]" : "border-orange-200/15"} ${className}`}
    >
      {stream && cameraOn ? (
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_center,rgba(255,125,22,.19),transparent_58%)]">
          <span className="grid size-16 place-items-center rounded-full border border-orange-300/30 bg-orange-400/10 text-xl font-bold text-orange-100">{label.slice(0, 1).toUpperCase()}</span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 pt-10">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">{label}{isLocal ? " (você)" : ""}</span>
          {connectionQuality !== "stable" && (
            <div className="flex items-center gap-1 text-xs" title={connectionQuality === "connecting" ? "Conectando..." : connectionQuality === "recovering" ? "Recuperando conexão" : "Conexão instável"}>
              {connectionQuality === "connecting" && <Loader2 className="size-3 animate-spin text-stone-400" />}
              {connectionQuality === "recovering" && <Activity className="size-3 text-orange-400" />}
              {connectionQuality === "degraded" && <AlertTriangle className="size-3 text-rose-400" />}
            </div>
          )}
        </div>
        <span className="flex items-center gap-1.5 text-white/80">
          {sharingScreen && <MonitorUp className="size-4 text-orange-200" />}
          {!microphoneOn && <MicOff className="size-4" />}
          {!cameraOn && <VideoOff className="size-4" />}
        </span>
      </div>
      {onVolumeChange && (
        <label className="absolute inset-x-3 top-3 flex items-center gap-2 rounded-lg bg-black/60 px-2 py-1.5 text-white/75 opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100">
          <Volume2 className="size-3.5 shrink-0" />
          <input aria-label={`Volume de ${label}`} type="range" min="0" max="150" value={normalizeParticipantVolume(volume)} onChange={event => onVolumeChange(normalizeParticipantVolume(Number(event.target.value)))} className="h-1 w-full accent-orange-400" />
          <span className="w-8 text-right font-mono text-[10px]">{normalizeParticipantVolume(volume)}%</span>
        </label>
      )}
      <div className="absolute left-3 top-3 flex gap-1.5">{sharingScreen && <span className="rounded-full border border-orange-200/30 bg-orange-500/90 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-black">Tela ao vivo</span>}{speaking && <span className="rounded-full border border-emerald-200/25 bg-emerald-400/85 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-950">Falando</span>}</div>
      {canPip && stream && cameraOn && (
        <button 
          onClick={togglePip}
          className="absolute right-3 top-3 grid size-7 place-items-center rounded-lg bg-black/40 text-white/70 hover:bg-black/70 hover:text-white"
          title="Picture-in-Picture"
          aria-label="Picture-in-Picture"
        >
          <PictureInPicture2 className="size-3.5" />
        </button>
      )}
    </motion.article>
  );
}
