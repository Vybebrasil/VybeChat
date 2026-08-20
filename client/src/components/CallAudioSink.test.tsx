import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CallAudioSink } from "./CallAudioSink";

function fakeStream(): MediaStream {
  return {
    getVideoTracks: () => [],
    getAudioTracks: () => [{ kind: "audio" }],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaStream;
}

describe("CallAudioSink", () => {
  it("reproduz um elemento de áudio por participante remoto", () => {
    const { container } = render(
      <CallAudioSink
        streams={[
          { socketId: "a", stream: fakeStream() },
          { socketId: "b", stream: fakeStream() },
          { socketId: "c", stream: fakeStream() },
        ]}
        volumes={{}}
      />,
    );
    // O bug original: com a tela cheia fechada, nenhum áudio existia. O sink não
    // depende de layout nenhum, então os três tocam com o palco aberto ou fechado.
    expect(container.querySelectorAll("audio")).toHaveLength(3);
  });

  it("aplica o volume individual de cada participante", () => {
    const { container } = render(
      <CallAudioSink
        streams={[
          { socketId: "a", stream: fakeStream() },
          { socketId: "b", stream: fakeStream() },
        ]}
        volumes={{ a: 50 }}
      />,
    );
    const elementos = container.querySelectorAll("audio");
    expect(elementos[0].volume).toBeCloseTo(0.5, 5);
    // Sem volume definido vale 100%, não zero.
    expect(elementos[1].volume).toBeCloseTo(1, 5);
  });

  it("não renderiza nada quando ninguém mais está na chamada", () => {
    const { container } = render(<CallAudioSink streams={[]} volumes={{}} />);
    expect(container.querySelectorAll("audio")).toHaveLength(0);
  });

  it("avisa quando o navegador bloqueia o autoplay em vez de falhar calado", async () => {
    const onBlocked = vi.fn();
    const play = vi.spyOn(window.HTMLMediaElement.prototype, "play").mockRejectedValue(new Error("NotAllowedError"));
    render(<CallAudioSink streams={[{ socketId: "a", stream: fakeStream() }]} volumes={{}} onBlocked={onBlocked} />);
    await vi.waitFor(() => expect(onBlocked).toHaveBeenCalledWith(true));
    play.mockRestore();
  });
});
