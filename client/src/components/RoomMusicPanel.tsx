import { ChevronLeft, ChevronRight, CirclePlay, CircleStop, ListMusic, Music2, Pause, Play, Plus, Radio, Trash2, Volume2, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { formatMusicTime, musicItemLabel, parseYouTubeMusicSource, type MusicControlAction, type RoomMusicState } from "@/lib/room-music";

type YouTubeApi = {
  Player: new (element: HTMLElement, options: Record<string, unknown>) => YouTubePlayer;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number };
};

type YouTubePlayer = {
  destroy: () => void;
  setVolume: (volume: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  getPlaylistIndex: () => number;
  loadVideoById: (value: { videoId: string; startSeconds: number }) => void;
  cueVideoById: (value: { videoId: string; startSeconds: number }) => void;
  loadPlaylist: (value: { listType: "playlist"; list: string; index: number; startSeconds: number }) => void;
  cuePlaylist: (value: { listType: "playlist"; list: string; index: number; startSeconds: number }) => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
  pauseVideo: () => void;
};

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<YouTubeApi> | null = null;

function loadYouTubeApi(): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("A API do YouTube não ficou disponível."));
    };

    if (document.querySelector("script[data-vybe-youtube-api='true']")) return;
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.dataset.vybeYoutubeApi = "true";
    script.addEventListener("error", () => {
      youtubeApiPromise = null;
      reject(new Error("Não foi possível carregar o player do YouTube."));
    });
    document.head.appendChild(script);
  });

  return youtubeApiPromise;
}

export type RoomMusicPanelProps = {
  open: boolean;
  channelId: number;
  roomName: string;
  userId: string;
  musicState: RoomMusicState | null;
  canModerate?: boolean;
  onClose: () => void;
  onRequestState: () => void;
  onEnqueue: (source: { kind: "video" | "playlist"; videoId?: string; playlistId?: string }) => void;
  onClaimDj: () => void;
  onControl: (action: MusicControlAction, payload?: Partial<Pick<RoomMusicState, "queueIndex" | "playlistIndex" | "positionSeconds" | "playing">>) => void;
};

export function RoomMusicPanel({ open, channelId, roomName, userId, musicState, canModerate = false, onClose, onRequestState, onEnqueue, onClaimDj, onControl }: RoomMusicPanelProps) {
  const [source, setSource] = useState("");
  const [sourceError, setSourceError] = useState("");
  const [apiReady, setApiReady] = useState(false);
  const [volume, setVolume] = useState(65);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playerError, setPlayerError] = useState("");
  const mountRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const loadedKeyRef = useRef("");
  const suppressControlRef = useRef(false);
  const stateRef = useRef(musicState);
  const controlRef = useRef(onControl);
  const canControlRef = useRef(canModerate);

  stateRef.current = musicState;
  controlRef.current = onControl;

  const currentItem = musicState && musicState.queueIndex >= 0 ? musicState.queue[musicState.queueIndex] : null;
  const canControl = Boolean(musicState && (musicState.djUserId === userId || canModerate));
  canControlRef.current = canControl;
  const sourceKey = currentItem ? `${currentItem.id}:${musicState?.playlistIndex ?? 0}` : "";
  const thumbnail = currentItem?.kind === "video" && currentItem.videoId ? `https://img.youtube.com/vi/${currentItem.videoId}/hqdefault.jpg` : null;

  useEffect(() => {
    if (open) onRequestState();
  }, [channelId, onRequestState, open]);

  useEffect(() => {
    if (open || !playerRef.current) return;
    playerRef.current.destroy();
    playerRef.current = null;
    loadedKeyRef.current = "";
    setApiReady(false);
  }, [open]);

  useEffect(() => {
    if (!open || !mountRef.current || playerRef.current) return;
    let cancelled = false;
    loadYouTubeApi().then((YT) => {
      if (cancelled || !mountRef.current) return;
      playerRef.current = new YT.Player(mountRef.current, {
        width: "100%",
        height: "100%",
        playerVars: { controls: 1, disablekb: 0, enablejsapi: 1, playsinline: 1, rel: 0 },
        events: {
          onReady: ({ target }: { target: YouTubePlayer }) => {
            target.setVolume(volume);
            setApiReady(true);
            setPlayerError("");
          },
          onStateChange: ({ data, target }: { data: number; target: YouTubePlayer }) => {
            const state = stateRef.current;
            if (!state || suppressControlRef.current || !canControlRef.current) return;
            if (data === YT.PlayerState.ENDED) controlRef.current("next");
            if (data === YT.PlayerState.PLAYING && !state.playing) controlRef.current("play", { positionSeconds: target.getCurrentTime() });
            if (data === YT.PlayerState.PAUSED && state.playing) controlRef.current("pause", { positionSeconds: target.getCurrentTime() });
          },
          onError: ({ data }: { data: number }) => setPlayerError(data === 101 || data === 150 ? "O autor não permitiu incorporar este vídeo. Remova-o da fila." : "O YouTube não conseguiu abrir este item."),
        },
      });
    }).catch((error: Error) => setPlayerError(error.message));
    return () => { cancelled = true; };
  }, [canControl, open, volume]);

  useEffect(() => {
    const player = playerRef.current;
    if (!apiReady || !player) return;
    if (!currentItem || !musicState) {
      suppressControlRef.current = true;
      player.pauseVideo();
      suppressControlRef.current = false;
      loadedKeyRef.current = "";
      setPosition(0);
      setDuration(0);
      return;
    }

    const safePosition = Math.max(0, musicState.positionSeconds || 0);
    suppressControlRef.current = true;
    if (loadedKeyRef.current !== sourceKey) {
      if (currentItem.kind === "video" && currentItem.videoId) {
        const value = { videoId: currentItem.videoId, startSeconds: safePosition };
        musicState.playing ? player.loadVideoById(value) : player.cueVideoById(value);
      }
      if (currentItem.kind === "playlist" && currentItem.playlistId) {
        const value = { listType: "playlist" as const, list: currentItem.playlistId, index: musicState.playlistIndex, startSeconds: safePosition };
        musicState.playing ? player.loadPlaylist(value) : player.cuePlaylist(value);
      }
      loadedKeyRef.current = sourceKey;
    } else {
      if (Math.abs(player.getCurrentTime() - safePosition) > 2.5) player.seekTo(safePosition, true);
      musicState.playing ? player.playVideo() : player.pauseVideo();
    }
    suppressControlRef.current = false;
  }, [apiReady, currentItem, musicState, sourceKey]);

  useEffect(() => {
    const player = playerRef.current;
    if (!apiReady || !open || !player) return;
    const interval = window.setInterval(() => {
      const state = stateRef.current;
      if (!state || !playerRef.current) return;
      const current = playerRef.current.getCurrentTime();
      setPosition(current);
      setDuration(playerRef.current.getDuration());
      if (canControl && Date.now() % 15000 < 1100) {
        controlRef.current("sync", {
          queueIndex: state.queueIndex,
          playlistIndex: Math.max(0, playerRef.current.getPlaylistIndex()),
          positionSeconds: current,
          playing: playerRef.current.getPlayerState() === window.YT?.PlayerState.PLAYING,
        });
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [apiReady, canControl, open]);

  useEffect(() => () => {
    playerRef.current?.destroy();
    playerRef.current = null;
  }, []);

  const playbackStatus = useMemo(() => musicState?.playing ? "ao vivo" : "em pausa", [musicState?.playing]);

  if (!open) return null;

  function submitSource(event: FormEvent) {
    event.preventDefault();
    const parsed = parseYouTubeMusicSource(source);
    if (!parsed) {
      setSourceError("Cole um link válido de vídeo ou playlist do YouTube.");
      return;
    }
    onEnqueue(parsed);
    setSource("");
    setSourceError("");
  }

  return (
    <aside className="fixed inset-y-0 right-0 z-[80] w-full max-w-[420px] overflow-y-auto border-l border-white/10 bg-[#17110e] p-4 text-white shadow-2xl" aria-label="Música da sala">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-500/15 text-orange-300"><Music2 className="size-5" /></div>
          <div><h2 className="text-sm font-bold">Música da sala</h2><p className="mt-0.5 text-xs text-stone-400">{roomName}</p></div>
        </div>
        <div className="flex items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${musicState?.playing ? "bg-emerald-400/15 text-emerald-200" : "bg-white/8 text-stone-400"}`}><Radio className="mr-1 inline size-3" />{playbackStatus}</span><button onClick={onClose} className="rounded-md p-1.5 text-stone-400 hover:bg-white/8 hover:text-white" aria-label="Fechar música"><X className="size-4" /></button></div>
      </header>

      <div className="relative mt-4 aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
        {thumbnail && <img src={thumbnail} alt="Capa da música atual" className="absolute inset-0 size-full object-cover opacity-55" />}
        {!currentItem && <div className="absolute inset-0 grid place-items-center text-center text-xs text-stone-500"><div><Music2 className="mx-auto mb-2 size-7" />Adicione uma música para começar</div></div>}
        <div ref={mountRef} className={`relative z-10 size-full ${currentItem ? "" : "pointer-events-none opacity-0"}`} />
      </div>

      {playerError && <p className="mt-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-100">{playerError}</p>}

      <section className="mt-3 rounded-xl border border-white/8 bg-white/[.035] p-3">
        <div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-semibold text-stone-100">{currentItem ? musicItemLabel(currentItem) : "Sem música na fila"}</p><p className="mt-0.5 text-[10px] text-stone-500">{formatMusicTime(position)} / {formatMusicTime(duration)}</p></div>{!canControl && <button onClick={onClaimDj} className="rounded-lg border border-orange-300/30 px-2 py-1 text-[10px] font-semibold text-orange-100">Assumir DJ</button>}</div>
        <input type="range" min="0" max={Math.max(1, duration)} value={Math.min(position, duration || 0)} onChange={(event) => canControl && onControl("sync", { positionSeconds: Number(event.target.value), playing: musicState?.playing })} className="mt-3 w-full accent-orange-400" aria-label="Posição da música" disabled={!canControl || !currentItem} />
        <div className="mt-3 flex items-center justify-center gap-2"><button disabled={!canControl} onClick={() => onControl("previous")} className="rounded-lg bg-white/7 p-2 disabled:opacity-35" aria-label="Faixa anterior"><ChevronLeft className="size-4" /></button><button disabled={!canControl} onClick={() => onControl(musicState?.playing ? "pause" : "play", { positionSeconds: position })} className="rounded-xl bg-orange-500 p-2.5 text-black disabled:opacity-35" aria-label={musicState?.playing ? "Pausar" : "Tocar"}>{musicState?.playing ? <Pause className="size-5" /> : <Play className="size-5" />}</button><button disabled={!canControl} onClick={() => onControl("next")} className="rounded-lg bg-white/7 p-2 disabled:opacity-35" aria-label="Próxima faixa"><ChevronRight className="size-4" /></button></div>
        <label className="mt-3 flex items-center gap-2 text-[10px] text-stone-400"><Volume2 className="size-3.5" /><span>Seu volume</span><input type="range" min="0" max="100" value={volume} onChange={(event) => { const next = Number(event.target.value); setVolume(next); playerRef.current?.setVolume(next); }} className="min-w-0 flex-1 accent-orange-400" aria-label="Volume da música" /><span className="w-7 text-right">{volume}%</span></label>
      </section>

      <form onSubmit={submitSource} className="mt-3 rounded-xl border border-white/8 bg-white/[.03] p-3"><label htmlFor="music-source" className="text-[11px] font-semibold text-stone-200">Adicionar vídeo ou playlist</label><div className="mt-2 flex gap-2"><input id="music-source" value={source} onChange={(event) => { setSource(event.target.value); setSourceError(""); }} placeholder="Cole o link do YouTube" className="h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 text-xs text-white outline-none placeholder:text-stone-600 focus:border-orange-300/40" /><button type="submit" className="grid size-10 shrink-0 place-items-center rounded-lg bg-orange-500 text-black" aria-label="Adicionar à fila"><Plus className="size-4" /></button></div>{sourceError && <p className="mt-2 text-[10px] text-rose-200">{sourceError}</p>}</form>

      <section className="mt-3"><div className="flex items-center justify-between"><p className="text-[11px] font-semibold text-stone-200"><ListMusic className="mr-1 inline size-3.5" />Fila compartilhada · {musicState?.queue.length ?? 0}</p>{canControl && Boolean(musicState?.queue.length) && <button type="button" onClick={() => onControl("clear")} className="flex items-center gap-1 text-[10px] text-stone-500 hover:text-rose-200"><Trash2 className="size-3" />Limpar</button>}</div><div className="mt-2 space-y-1.5">{musicState?.queue.map((item, index) => <div key={item.id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${index === musicState.queueIndex ? "border-orange-300/25 bg-orange-400/8" : "border-white/6 bg-white/[.02]"}`}><span className="grid size-7 shrink-0 place-items-center rounded-md bg-black/25 text-[10px] font-bold text-stone-400">{index + 1}</span><button type="button" disabled={!canControl} onClick={() => onControl("select", { queueIndex: index, playlistIndex: 0, positionSeconds: 0, playing: true })} className="min-w-0 flex-1 text-left disabled:cursor-default"><span className="block truncate text-[11px] font-semibold text-stone-200">{musicItemLabel(item)}</span><span className="block truncate text-[10px] text-stone-500">adicionado por {item.addedBy.name}</span></button></div>)}</div></section>
    </aside>
  );
}
