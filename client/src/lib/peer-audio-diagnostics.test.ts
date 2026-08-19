import { describe, expect, it } from "vitest";
import { summarizePeerAudioStats } from "./peer-audio-diagnostics";

describe("diagnóstico de áudio do peer", () => {
  it("identifica pacotes enviados e recebidos de áudio", () => {
    const result = summarizePeerAudioStats([
      { type: "outbound-rtp", kind: "audio", bytesSent: 320 },
      { type: "inbound-rtp", kind: "audio", bytesReceived: 280 },
    ], "connected");
    expect(result).toEqual({ sending: true, receiving: true, connection: "connected" });
  });

  it("não confunde tráfego de vídeo com tráfego de áudio", () => {
    expect(summarizePeerAudioStats([{ type: "outbound-rtp", kind: "video", bytesSent: 800 }], "connecting")).toEqual({ sending: false, receiving: false, connection: "connecting" });
  });
});
