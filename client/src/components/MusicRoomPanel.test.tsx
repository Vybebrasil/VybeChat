import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MusicRoomPanel } from "./MusicRoomPanel";
import type { SharedMusicState } from "@/lib/youtube-music";

const emptyState: SharedMusicState = {
  channelId: 5,
  queue: [],
  queueIndex: -1,
  playlistIndex: 0,
  playing: false,
  positionSeconds: 0,
  updatedAt: 0,
  revision: 0,
  djUserId: null,
  djName: null,
  updatedBy: null,
};

afterEach(() => cleanup());

describe("MusicRoomPanel", () => {
  it("adiciona playlist do YouTube à fila compartilhada", () => {
    const onEnqueue = vi.fn();
    render(
      <MusicRoomPanel
        open
        channelId={5}
        roomName="sala-geral"
        userId="paulo"
        musicState={emptyState}
        onClose={vi.fn()}
        onRequestState={vi.fn()}
        onEnqueue={onEnqueue}
        onClaimDj={vi.fn()}
        onControl={vi.fn()}
      />
    );
    fireEvent.change(screen.getByLabelText("Adicionar vídeo ou playlist"), {
      target: {
        value: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL1234567890",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar à fila" }));
    expect(onEnqueue).toHaveBeenCalledWith(
      { kind: "playlist", playlistId: "PL1234567890" },
      true
    );
  });

  it("mantém o player visível e exige gesto para liberar o áudio", () => {
    render(
      <MusicRoomPanel
        open
        channelId={5}
        roomName="sala-geral"
        userId="paulo"
        musicState={emptyState}
        onClose={vi.fn()}
        onRequestState={vi.fn()}
        onEnqueue={vi.fn()}
        onClaimDj={vi.fn()}
        onControl={vi.fn()}
      />
    );
    expect(screen.getByText("Entrar na música")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ouvir junto" })).toBeTruthy();
  });

  it("deixa o DJ pausar a reprodução compartilhada", () => {
    const onControl = vi.fn();
    const playingState: SharedMusicState = {
      ...emptyState,
      playing: true,
      queueIndex: 0,
      djUserId: "paulo",
      djName: "Paulo",
      queue: [
        {
          id: "music-1",
          kind: "video",
          videoId: "dQw4w9WgXcQ",
          url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          addedBy: { userId: "paulo", name: "Paulo" },
          addedAt: "2026-08-21T00:00:00.000Z",
        },
      ],
    };
    render(
      <MusicRoomPanel
        open
        channelId={5}
        roomName="sala-geral"
        userId="paulo"
        musicState={playingState}
        onClose={vi.fn()}
        onRequestState={vi.fn()}
        onEnqueue={vi.fn()}
        onClaimDj={vi.fn()}
        onControl={onControl}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Pausar música" }));
    expect(onControl).toHaveBeenCalledWith("pause", { positionSeconds: 0 });
  });
});
