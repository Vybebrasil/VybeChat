import {
  ChevronLeft,
  ChevronRight,
  ListMusic,
  Music2,
  Minus,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import React, {
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  formatMusicTime,
  getExpectedMusicPosition,
  musicSourceLabel,
  parseYouTubeMusicSource,
  type SharedMusicState,
  type YouTubeMusicSourceInput,
} from "@/lib/youtube-music";

type YouTubePlayer = {
  cueVideoById: (options: { videoId: string; startSeconds?: number }) => void;
  loadVideoById: (options: { videoId: string; startSeconds?: number }) => void;
  cuePlaylist: (options: {
    listType: "playlist";
    list: string;
    index?: number;
    startSeconds?: number;
  }) => void;
  loadPlaylist: (options: {
    listType: "playlist";
    list: string;
    index?: number;
    startSeconds?: number;
  }) => void;
  playVideoAt: (index: number) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  getPlaylist: () => string[] | null;
  getPlaylistIndex: () => number;
  setVolume: (volume: number) => void;
  destroy: () => void;
};

type YouTubeApi = {
  Player: new (
    element: HTMLElement,
    options: {
      width: string;
      height: string;
      playerVars: Record<string, number | string>;
      events: {
        onReady: (event: { target: YouTubePlayer }) => void;
        onStateChange: (event: { data: number; target: YouTubePlayer }) => void;
        onError: (event: { data: number }) => void;
      };
    }
  ) => YouTubePlayer;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number };
};

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<YouTubeApi> | null = null;

export function loadYouTubePlayerApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise<YouTubeApi>((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("A API do YouTube não ficou disponível."));
    };
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-vybe-youtube-api="true"]'
    );
    if (existing) return;
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

type MusicControlPayload = {
  queueIndex?: number;
  playlistIndex?: number;
  positionSeconds?: number;
  playing?: boolean;
};

type MusicRoomPanelProps = {
  open: boolean;
  channelId: number;
  roomName: string;
  userId: string;
  musicState: SharedMusicState | null;
  canModerate?: boolean;
  onClose: () => void;
  onRequestState: () => void;
  onEnqueue: (source: YouTubeMusicSourceInput, playNow: boolean) => void;
  onClaimDj: () => void;
  onControl: (action: string, payload?: MusicControlPayload) => void;
};

export function MusicRoomPanel({
  open,
  channelId,
  roomName,
  userId,
  musicState,
  canModerate = false,
  onClose,
  onRequestState,
  onEnqueue,
  onClaimDj,
  onControl,
}: MusicRoomPanelProps) {
  const [minimized, setMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [inputError, setInputError] = useState("");
  const [joined, setJoined] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [playerError, setPlayerError] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(65);
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const loadedSourceRef = useRef("");
  const applyingRemoteRef = useRef(false);
  const latestStateRef = useRef(musicState);
  const canControlRef = useRef(false);
  const onControlRef = useRef(onControl);
  const lastSyncAtRef = useRef(0);
  const suppressTimerRef = useRef<number | null>(null);
  const currentSource =
    musicState && musicState.queueIndex >= 0
      ? (musicState.queue[musicState.queueIndex] ?? null)
      : null;
  const canControl = Boolean(
    musicState && (musicState.djUserId === userId || canModerate)
  );
  const sourceKey = currentSource
    ? `${currentSource.id}:${musicState?.playlistIndex ?? 0}`
    : "";

  latestStateRef.current = musicState;
  canControlRef.current = canControl;
  onControlRef.current = onControl;

  const queueSummary = useMemo(
    () => musicState?.queue.map(musicSourceLabel) ?? [],
    [musicState?.queue]
  );

  const suppressRemoteEvents = () => {
    applyingRemoteRef.current = true;
    if (suppressTimerRef.current) window.clearTimeout(suppressTimerRef.current);
    suppressTimerRef.current = window.setTimeout(() => {
      applyingRemoteRef.current = false;
    }, 850);
  };

  const move = (direction: -1 | 1) => {
    if (!musicState || !currentSource || !canControl) return;
    const player = playerRef.current;
    const playlistLength = player?.getPlaylist()?.length ?? 0;
    const playlistIndex = Math.max(
      0,
      player?.getPlaylistIndex() ?? musicState.playlistIndex
    );
    if (
      currentSource.kind === "playlist" &&
      ((direction === 1 && playlistIndex + 1 < playlistLength) ||
        (direction === -1 && playlistIndex > 0))
    ) {
      onControl("select", {
        queueIndex: musicState.queueIndex,
        playlistIndex: playlistIndex + direction,
        positionSeconds: 0,
        playing: true,
      });
      return;
    }
    const nextQueueIndex = musicState.queueIndex + direction;
    if (musicState.queue[nextQueueIndex]) {
      onControl("select", {
        queueIndex: nextQueueIndex,
        playlistIndex: 0,
        positionSeconds: 0,
        playing: true,
      });
      return;
    }
    if (direction === 1)
      onControl("pause", { positionSeconds: player?.getDuration() ?? 0 });
  };

  useEffect(() => {
    if (open) onRequestState();
  }, [channelId, onRequestState, open]);

  useEffect(() => {
    if (open || !playerRef.current) return;
    playerRef.current.destroy();
    playerRef.current = null;
    loadedSourceRef.current = "";
    setPlayerReady(false);
    setJoined(false);
    setMinimized(false);
  }, [open]);

  useEffect(() => {
    if (!open || !joined || !hostRef.current || playerRef.current) return;
    let cancelled = false;
    void loadYouTubePlayerApi()
      .then(api => {
        if (cancelled || !hostRef.current) return;
        playerRef.current = new api.Player(hostRef.current, {
          width: "100%",
          height: "100%",
          playerVars: {
            controls: 1,
            disablekb: 0,
            enablejsapi: 1,
            playsinline: 1,
            rel: 0,
          },
          events: {
            onReady: ({ target }) => {
              target.setVolume(volume);
              setPlayerReady(true);
              setPlayerError("");
            },
            onStateChange: ({ data, target }) => {
              const shared = latestStateRef.current;
              if (!shared || applyingRemoteRef.current) return;
              if (data === api.PlayerState.ENDED && canControlRef.current) {
                moveFromPlayer(target, shared, onControlRef.current);
              } else if (
                data === api.PlayerState.PLAYING &&
                canControlRef.current
              ) {
                const currentIndex = Math.max(0, target.getPlaylistIndex());
                const currentSource = shared.queue[shared.queueIndex];
                if (
                  currentSource?.kind === "playlist" &&
                  currentIndex !== shared.playlistIndex
                ) {
                  onControlRef.current("select", {
                    queueIndex: shared.queueIndex,
                    playlistIndex: currentIndex,
                    positionSeconds: target.getCurrentTime(),
                    playing: true,
                  });
                } else if (!shared.playing) {
                  onControlRef.current("play", {
                    positionSeconds: target.getCurrentTime(),
                  });
                }
              } else if (
                data === api.PlayerState.PAUSED &&
                shared.playing &&
                canControlRef.current
              ) {
                onControlRef.current("pause", {
                  positionSeconds: target.getCurrentTime(),
                });
              }
            },
            onError: ({ data }) =>
              setPlayerError(
                data === 101 || data === 150
                  ? "O autor não permitiu incorporar este vídeo. Remova-o da fila."
                  : "O YouTube não conseguiu abrir este item."
              ),
          },
        });
      })
      .catch(error =>
        setPlayerError(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o player."
        )
      );
    return () => {
      cancelled = true;
    };
  }, [joined, open, volume]);

  useEffect(() => {
    const player = playerRef.current;
    if (!playerReady || !joined || !player) return;
    if (!currentSource || !musicState) {
      suppressRemoteEvents();
      player.pauseVideo();
      loadedSourceRef.current = "";
      setCurrentTime(0);
      setDuration(0);
      return;
    }
    const expected = getExpectedMusicPosition(musicState);
    suppressRemoteEvents();
    if (loadedSourceRef.current !== sourceKey) {
      const prevSourceId = loadedSourceRef.current.split(":")[0];
      if (
        currentSource.kind === "playlist" &&
        prevSourceId === currentSource.id
      ) {
        player.playVideoAt(musicState.playlistIndex);
        if (expected > 2) player.seekTo(expected, true);
        if (musicState.playing) player.playVideo();
        else player.pauseVideo();
      } else if (currentSource.kind === "video") {
        const options = {
          videoId: currentSource.videoId,
          startSeconds: expected,
        };
        if (musicState.playing) player.loadVideoById(options);
        else player.cueVideoById(options);
      } else {
        const options = {
          listType: "playlist" as const,
          list: currentSource.playlistId,
          index: musicState.playlistIndex,
          startSeconds: expected,
        };
        if (musicState.playing) player.loadPlaylist(options);
        else player.cuePlaylist(options);
      }
      loadedSourceRef.current = sourceKey;
    } else {
      if (Math.abs(player.getCurrentTime() - expected) > 2.2)
        player.seekTo(expected, true);
      if (musicState.playing) player.playVideo();
      else player.pauseVideo();
    }
  }, [currentSource, joined, musicState, playerReady, sourceKey]);

  useEffect(() => {
    if (!playerReady || !joined) return;
    const timer = window.setInterval(() => {
      const player = playerRef.current;
      const shared = latestStateRef.current;
      if (!player || !shared) return;
      const time = player.getCurrentTime();
      setCurrentTime(time);
      setDuration(player.getDuration());
      const playerState = player.getPlayerState();
      const expected = getExpectedMusicPosition(shared);
      const isBufferingOrTransitioning =
        playerState === window.YT?.PlayerState.BUFFERING ||
        playerState === window.YT?.PlayerState.UNSTARTED ||
        playerState === window.YT?.PlayerState.ENDED;
      const isPlaylistIndexSync =
        shared.queue[shared.queueIndex]?.kind !== "playlist" ||
        Math.max(0, player.getPlaylistIndex()) === shared.playlistIndex;

      if (
        !isBufferingOrTransitioning &&
        isPlaylistIndexSync &&
        Math.abs(time - expected) > 2.5
      ) {
        suppressRemoteEvents();
        player.seekTo(expected, true);
      }

      if (shared.playing && playerState !== window.YT?.PlayerState.PLAYING) {
        suppressRemoteEvents();
        player.playVideo();
      } else if (
        !shared.playing &&
        playerState === window.YT?.PlayerState.PLAYING
      ) {
        suppressRemoteEvents();
        player.pauseVideo();
      }
      if (!canControlRef.current || Date.now() - lastSyncAtRef.current < 15_000)
        return;
      lastSyncAtRef.current = Date.now();
      onControlRef.current("sync", {
        queueIndex: shared.queueIndex,
        playlistIndex: Math.max(0, player.getPlaylistIndex()),
        positionSeconds: time,
        playing: playerState === window.YT?.PlayerState.PLAYING,
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [joined, playerReady]);

  useEffect(
    () => () => {
      if (suppressTimerRef.current)
        window.clearTimeout(suppressTimerRef.current);
      playerRef.current?.destroy();
      playerRef.current = null;
    },
    []
  );

  if (!open && !minimized) return null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const source = parseYouTubeMusicSource(input);
    if (!source) {
      setInputError("Cole um link válido de vídeo ou playlist do YouTube.");
      return;
    }
    onEnqueue(source, !musicState?.queue.length);
    setInput("");
    setInputError("");
  };

  const togglePlayback = (event?: React.MouseEvent) => {
    if (event) event.stopPropagation();
    if (!musicState || !canControl) return;
    const positionSeconds = playerRef.current?.getCurrentTime() ?? currentTime;
    onControl(musicState.playing ? "pause" : "play", { positionSeconds });
  };

  if (minimized) {
    return (
      <aside className="music-room-panel fixed bottom-3 right-3 z-[70] flex items-center gap-3 rounded-xl border border-orange-300/20 bg-[#131115]/98 px-4 py-2.5 text-white shadow-[0_24px_90px_rgba(0,0,0,.72)] backdrop-blur-xl w-[min(320px,calc(100vw-24px))] cursor-pointer hover:bg-[#131115]" onClick={() => setMinimized(false)}>
        <span className="grid size-9 place-items-center rounded-lg bg-orange-400/12 text-orange-300 shrink-0">
           <Music2 className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold">Tocando agora</p>
          <p className="truncate text-[10px] text-stone-400">
            {currentSource ? musicSourceLabel(currentSource) : "Música da sala"}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={togglePlayback} disabled={!canControl || !currentSource} className="grid size-8 place-items-center rounded-lg text-stone-200 hover:bg-white/10 disabled:opacity-30">
            {musicState?.playing ? <Pause className="size-4"/> : <Play className="size-4 fill-current"/>}
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); move(1); }} disabled={!canControl || !currentSource} className="grid size-8 place-items-center rounded-lg text-stone-200 hover:bg-white/10 disabled:opacity-30">
            <ChevronRight className="size-4" />
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onClose(); }} className="grid size-8 place-items-center rounded-lg text-stone-400 hover:bg-rose-500/10 hover:text-rose-200">
            <X className="size-4" />
          </button>
        </div>
        <div className="absolute opacity-0 pointer-events-none w-1 h-1 overflow-hidden">
          {joined && <div ref={hostRef} className="w-full h-full" />}
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="music-room-panel fixed bottom-3 right-3 top-3 z-[70] flex w-[min(460px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-orange-300/20 bg-[#131115]/98 text-white shadow-[0_24px_90px_rgba(0,0,0,.72)] backdrop-blur-xl"
      aria-label="Música da sala"
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-white/8 px-4 py-3.5">
        <span className="grid size-9 place-items-center rounded-xl bg-orange-400/12 text-orange-300">
          <Music2 className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Música da sala</p>
          <p className="truncate text-[11px] text-stone-400">{roomName}</p>
        </div>
        {musicState?.playing && (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200">
            <Radio className="size-3" /> ao vivo
          </span>
        )}
        <button
          type="button"
          onClick={() => setMinimized(true)}
          className="grid size-8 place-items-center rounded-lg text-stone-400 hover:bg-white/8 hover:text-white"
          aria-label="Minimizar música"
        >
          <Minus className="size-4" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="grid size-8 place-items-center rounded-lg text-stone-400 hover:bg-white/8 hover:text-white"
          aria-label="Fechar música"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
          {joined ? (
            <div ref={hostRef} className="min-h-[200px] w-full aspect-video" />
          ) : (
            <div className="flex min-h-[220px] flex-col items-center justify-center px-7 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-orange-400/12 text-orange-300">
                <Volume2 className="size-5" />
              </span>
              <p className="mt-4 text-sm font-semibold">Entrar na música</p>
              <p className="mt-1.5 max-w-xs text-[11px] leading-5 text-stone-400">
                O player fica visível e o volume é só seu. Clique para liberar o
                áudio no navegador.
              </p>
              <button
                type="button"
                onClick={() => setJoined(true)}
                className="mt-4 rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-bold text-black hover:bg-orange-400"
              >
                Ouvir junto
              </button>
            </div>
          )}
        </div>

        {playerError && (
          <p className="mt-2 rounded-lg bg-rose-500/12 px-3 py-2 text-[11px] leading-4 text-rose-100">
            {playerError}
          </p>
        )}

        <section className="mt-3 rounded-xl border border-white/8 bg-white/[.03] p-3">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-orange-400/10 text-orange-300">
              <ListMusic className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">
                {currentSource
                  ? musicSourceLabel(currentSource)
                  : "Nada tocando agora"}
              </p>
              <p className="mt-1 text-[10px] text-stone-500">
                {musicState?.djName
                  ? `DJ: ${musicState.djName}`
                  : "A primeira pessoa que adicionar vira DJ"}
              </p>
            </div>
            {!canControl && (
              <button
                type="button"
                onClick={onClaimDj}
                className="rounded-lg border border-orange-300/25 px-2.5 py-1.5 text-[10px] font-semibold text-orange-100 hover:bg-orange-400/10"
              >
                Assumir DJ
              </button>
            )}
          </div>

          <div className="mt-3 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => move(-1)}
              disabled={!canControl || !currentSource}
              className="grid size-9 place-items-center rounded-lg bg-white/6 text-stone-200 disabled:opacity-30"
              aria-label="Faixa anterior"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={togglePlayback}
              disabled={!canControl || !currentSource}
              className="grid size-11 place-items-center rounded-xl bg-orange-500 text-black disabled:opacity-30"
              aria-label={
                musicState?.playing ? "Pausar música" : "Tocar música"
              }
            >
              {musicState?.playing ? (
                <Pause className="size-5" />
              ) : (
                <Play className="size-5 fill-current" />
              )}
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              disabled={!canControl || !currentSource}
              className="grid size-9 place-items-center rounded-lg bg-white/6 text-stone-200 disabled:opacity-30"
              aria-label="Próxima faixa"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2 text-[10px] text-stone-500">
            <span className="w-9 text-right">
              {formatMusicTime(currentTime)}
            </span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-orange-400"
                style={{
                  width: `${duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0}%`,
                }}
              />
            </div>
            <span className="w-9">{formatMusicTime(duration)}</span>
          </div>
          <label className="mt-3 flex items-center gap-2 text-[10px] text-stone-400">
            <Volume2 className="size-3.5" />
            <span>Seu volume</span>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={event => {
                const next = Number(event.target.value);
                setVolume(next);
                playerRef.current?.setVolume(next);
              }}
              className="min-w-0 flex-1 accent-orange-400"
              aria-label="Volume da música"
            />
            <span className="w-7 text-right">{volume}%</span>
          </label>
        </section>

        <form
          onSubmit={submit}
          className="mt-3 rounded-xl border border-white/8 bg-white/[.03] p-3"
        >
          <label
            htmlFor="music-source"
            className="text-[11px] font-semibold text-stone-200"
          >
            Adicionar vídeo ou playlist
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="music-source"
              value={input}
              onChange={event => {
                setInput(event.target.value);
                setInputError("");
              }}
              placeholder="Cole o link do YouTube"
              className="h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 text-xs text-white outline-none placeholder:text-stone-600 focus:border-orange-300/40"
            />
            <button
              type="submit"
              className="grid size-10 shrink-0 place-items-center rounded-lg bg-orange-500 text-black"
              aria-label="Adicionar à fila"
            >
              <Plus className="size-4" />
            </button>
          </div>
          {inputError && (
            <p className="mt-2 text-[10px] text-rose-200">{inputError}</p>
          )}
        </form>

        <section className="mt-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-stone-200">
              Fila compartilhada · {musicState?.queue.length ?? 0}
            </p>
            {canControl && Boolean(musicState?.queue.length) && (
              <button
                type="button"
                onClick={() => onControl("clear")}
                className="flex items-center gap-1 text-[10px] text-stone-500 hover:text-rose-200"
              >
                <RotateCcw className="size-3" /> Limpar
              </button>
            )}
          </div>
          <div className="mt-2 space-y-1.5">
            {musicState?.queue.map((source, index) => (
              <div
                key={source.id}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${index === musicState.queueIndex ? "border-orange-300/25 bg-orange-400/8" : "border-white/6 bg-white/[.02]"}`}
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-md bg-black/25 text-[10px] font-bold text-stone-400">
                  {index + 1}
                </span>
                <button
                  type="button"
                  disabled={!canControl}
                  onClick={() =>
                    onControl("select", {
                      queueIndex: index,
                      playlistIndex: 0,
                      positionSeconds: 0,
                      playing: true,
                    })
                  }
                  className="min-w-0 flex-1 text-left disabled:cursor-default"
                >
                  <span className="block truncate text-[11px] font-semibold text-stone-200">
                    {queueSummary[index]}
                  </span>
                  <span className="block truncate text-[10px] text-stone-500">
                    adicionado por {source.addedBy.name}
                  </span>
                </button>
                {canControl && (
                  <button
                    type="button"
                    onClick={() => onControl("remove", { queueIndex: index })}
                    className="grid size-7 place-items-center rounded-md text-stone-600 hover:bg-rose-500/10 hover:text-rose-200"
                    aria-label={`Remover item ${index + 1}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
            {!musicState?.queue.length && (
              <p className="rounded-lg border border-dashed border-white/8 px-3 py-5 text-center text-[10px] text-stone-500">
                Cole uma playlist do YouTube para começar.
              </p>
            )}
          </div>
        </section>
      </div>
    </aside>
  );
}

function moveFromPlayer(
  player: YouTubePlayer,
  musicState: SharedMusicState,
  onControl: MusicRoomPanelProps["onControl"]
) {
  const source = musicState.queue[musicState.queueIndex];
  const playlistIndex = Math.max(0, player.getPlaylistIndex());
  const playlistLength = player.getPlaylist()?.length ?? 0;
  if (
    source?.kind === "playlist" &&
    playlistLength > 0 &&
    playlistIndex + 1 < playlistLength
  ) {
    onControl("select", {
      queueIndex: musicState.queueIndex,
      playlistIndex: playlistIndex + 1,
      positionSeconds: 0,
      playing: true,
    });
    return;
  }
  const nextQueueIndex = musicState.queueIndex + 1;
  if (musicState.queue[nextQueueIndex]) {
    onControl("select", {
      queueIndex: nextQueueIndex,
      playlistIndex: 0,
      positionSeconds: 0,
      playing: true,
    });
  } else {
    onControl("pause", { positionSeconds: player.getDuration() });
  }
}
