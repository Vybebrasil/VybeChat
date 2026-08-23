export type YouTubeMusicSourceInput =
  | { kind: "video"; videoId: string }
  | { kind: "playlist"; playlistId: string };

export type YouTubeMusicSource = YouTubeMusicSourceInput & {
  id: string;
  url: string;
  addedBy: { userId: string; name: string };
  addedAt: string;
};

export type SharedMusicState = {
  channelId: number;
  queue: YouTubeMusicSource[];
  queueIndex: number;
  playlistIndex: number;
  playing: boolean;
  positionSeconds: number;
  updatedAt: number;
  revision: number;
  djUserId: string | null;
  djName: string | null;
  updatedBy: { userId: string; name: string } | null;
};

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);
const SAFE_ID = /^[a-zA-Z0-9_-]+$/;

function validVideoId(value: string | null) {
  return Boolean(value && value.length === 11 && SAFE_ID.test(value));
}

function validPlaylistId(value: string | null) {
  if (!value || value.length < 10 || value.length > 80 || !SAFE_ID.test(value)) return false;
  if (value.startsWith("RD") || value.startsWith("LL") || value.startsWith("WL") || value.startsWith("LM")) return false;
  return true;
}

export function parseYouTubeMusicSource(
  rawValue: string
): YouTubeMusicSourceInput | null {
  const value = rawValue.trim();
  if (!value) return null;
  if (validVideoId(value)) return { kind: "video", videoId: value };
  if (validPlaylistId(value) && value.length !== 11)
    return { kind: "playlist", playlistId: value };

  let url: URL;
  try {
    url = new URL(value.startsWith("http") ? value : `https://${value}`);
  } catch {
    return null;
  }
  if (!YOUTUBE_HOSTS.has(url.hostname.toLocaleLowerCase())) return null;

  const playlistId = url.searchParams.get("list");
  if (validPlaylistId(playlistId)) {
    return { kind: "playlist", playlistId: playlistId! };
  }

  const pathParts = url.pathname.split("/").filter(Boolean);
  const videoId = url.hostname.toLocaleLowerCase().endsWith("youtu.be")
    ? pathParts[0]
    : (url.searchParams.get("v") ??
      (["embed", "shorts", "live"].includes(pathParts[0])
        ? pathParts[1]
        : null));
  return validVideoId(videoId) ? { kind: "video", videoId: videoId! } : null;
}

export function getExpectedMusicPosition(
  musicState: SharedMusicState,
  now = Date.now()
) {
  if (!musicState.playing) return Math.max(0, musicState.positionSeconds);
  return Math.max(
    0,
    musicState.positionSeconds + Math.max(0, now - musicState.updatedAt) / 1000
  );
}

export function musicSourceLabel(source: YouTubeMusicSourceInput) {
  return source.kind === "playlist"
    ? `Playlist · ${source.playlistId.slice(0, 12)}`
    : `Vídeo · ${source.videoId}`;
}

export function formatMusicTime(seconds: number) {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainder = safe % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}
