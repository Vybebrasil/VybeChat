import { describe, expect, it } from "vitest";
import { formatMusicTime, musicItemLabel, parseYouTubeMusicSource } from "./room-music";

describe("parseYouTubeMusicSource", () => {
  it("reconhece vídeo do YouTube", () => {
    expect(parseYouTubeMusicSource("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
      kind: "video",
      videoId: "dQw4w9WgXcQ",
    });
  });

  it("reconhece URL curta de vídeo", () => {
    expect(parseYouTubeMusicSource("https://youtu.be/dQw4w9WgXcQ?t=10")).toEqual({
      kind: "video",
      videoId: "dQw4w9WgXcQ",
    });
  });

  it("prioriza playlist quando a URL contém list", () => {
    expect(parseYouTubeMusicSource("https://www.youtube.com/watch?v=abc&list=PL123")).toEqual({
      kind: "playlist",
      playlistId: "PL123",
    });
  });

  it("recusa URL que não é uma fonte do YouTube", () => {
    expect(parseYouTubeMusicSource("https://example.com/music")).toBeNull();
  });
});

describe("room music presentation", () => {
  it("formata o tempo de reprodução", () => {
    expect(formatMusicTime(69)).toBe("1:09");
  });

  it("diferencia vídeo e playlist", () => {
    expect(musicItemLabel({ id: "1", kind: "playlist", playlistId: "PL1", addedBy: { id: "u", name: "Paulo" } })).toBe("Playlist · PL1");
  });
});
