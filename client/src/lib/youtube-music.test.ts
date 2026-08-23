import { describe, expect, it } from "vitest";
import {
  formatMusicTime,
  getExpectedMusicPosition,
  parseYouTubeMusicSource,
  type SharedMusicState,
} from "./youtube-music";

describe("parseYouTubeMusicSource", () => {
  it("aceita vídeos em links watch, curtos e shorts", () => {
    expect(
      parseYouTubeMusicSource("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    ).toEqual({ kind: "video", videoId: "dQw4w9WgXcQ" });
    expect(
      parseYouTubeMusicSource("https://youtu.be/M7lc1UVf-VE?t=10")
    ).toEqual({ kind: "video", videoId: "M7lc1UVf-VE" });
    expect(
      parseYouTubeMusicSource("https://youtube.com/shorts/dQw4w9WgXcQ")
    ).toEqual({ kind: "video", videoId: "dQw4w9WgXcQ" });
  });

  it("prioriza a playlist quando o link tem vídeo e lista", () => {
    expect(
      parseYouTubeMusicSource(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL1234567890"
      )
    ).toEqual({ kind: "playlist", playlistId: "PL1234567890" });
  });

  it("recusa domínios parecidos e ids inválidos", () => {
    expect(
      parseYouTubeMusicSource("https://youtube.example/watch?v=dQw4w9WgXcQ")
    ).toBeNull();
    expect(parseYouTubeMusicSource("javascript:alert(1)")).toBeNull();
  });
});

it("calcula o ponto esperado apenas enquanto a sala está tocando", () => {
  const state = {
    playing: true,
    positionSeconds: 12,
    updatedAt: 1_000,
  } as SharedMusicState;
  expect(getExpectedMusicPosition(state, 4_500)).toBe(15.5);
  expect(getExpectedMusicPosition({ ...state, playing: false }, 4_500)).toBe(
    12
  );
  expect(formatMusicTime(65)).toBe("1:05");
});
