export type RoomMusicItem = {
  id: string;
  kind: "video" | "playlist";
  videoId?: string;
  playlistId?: string;
  addedBy: { id: string; name: string };
  addedAt?: string;
};

export type RoomMusicState = {
  queue: RoomMusicItem[];
  queueIndex: number;
  playlistIndex: number;
  positionSeconds: number;
  playing: boolean;
  djUserId?: string | null;
};

export type MusicControlAction = "play" | "pause" | "next" | "previous" | "select" | "clear" | "sync";

export function parseYouTubeMusicSource(value: string): Pick<RoomMusicItem, "kind" | "videoId" | "playlistId"> | null {
  const raw = value.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    const playlistId = url.searchParams.get("list")?.trim();
    const videoId = host === "youtu.be"
      ? url.pathname.slice(1).split("/")[0]
      : url.searchParams.get("v")?.trim();

    if (playlistId) return { kind: "playlist", playlistId };
    if (host === "youtu.be" && videoId) return { kind: "video", videoId };
    if ((host === "youtube.com" || host === "m.youtube.com") && videoId) return { kind: "video", videoId };
    return null;
  } catch {
    return null;
  }
}

export function formatMusicTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function musicItemLabel(item: RoomMusicItem): string {
  if (item.kind === "playlist") return `Playlist · ${item.playlistId}`;
  return `Vídeo · ${item.videoId}`;
}
