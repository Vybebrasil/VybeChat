import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MediaTile } from "./MediaTile";

// O áudio remoto saiu daqui para o CallAudioSink: preso ao tile, ele só existia
// enquanto a tela cheia da chamada estava aberta. A garantia de que participante
// remoto é audível continua testada, agora em CallAudioSink.test.tsx.
describe("MediaTile", () => {
  it("não carrega áudio: quem reproduz é o CallAudioSink", () => {
    const stream = { getVideoTracks: () => [], getAudioTracks: () => [] } as unknown as MediaStream;
    const { container } = render(<MediaTile stream={stream} label="Paulo" cameraOn={false} microphoneOn />);
    expect(container.querySelector("audio")).toBeNull();
    expect(container.querySelector("video")).toBeNull();
  });

  it("mostra o vídeo do participante quando há câmera, sempre mudo", () => {
    const stream = { getVideoTracks: () => [], getAudioTracks: () => [] } as unknown as MediaStream;
    const { container } = render(<MediaTile stream={stream} label="Paulo" cameraOn microphoneOn />);
    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    // Mudo mesmo para remoto: o som vem do sink, e sem isso a pessoa ouviria dobrado.
    expect(video?.muted).toBe(true);
  });

  it("cai para o avatar quando não há câmera", () => {
    const stream = { getVideoTracks: () => [], getAudioTracks: () => [] } as unknown as MediaStream;
    const { container } = render(<MediaTile stream={stream} label="Você" isLocal cameraOn={false} microphoneOn />);
    expect(container.querySelector("video")).toBeNull();
  });
});
