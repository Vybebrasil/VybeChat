import { describe, expect, it } from "vitest";
import { readPeerAudioSnapshot, summarizePeerAudioStats } from "./peer-audio-diagnostics";

describe("diagnóstico de áudio do peer", () => {
  it("identifica pacotes enviados e recebidos de áudio", () => {
    const result = summarizePeerAudioStats([
      { type: "outbound-rtp", kind: "audio", bytesSent: 320 },
      { type: "inbound-rtp", kind: "audio", bytesReceived: 280 },
    ], "connected");
    expect(result).toEqual({ sending: true, receiving: true, connection: "connected", quality: "stable" });
  });

  it("não confunde tráfego de vídeo com tráfego de áudio", () => {
    expect(summarizePeerAudioStats([{ type: "outbound-rtp", kind: "video", bytesSent: 800 }], "connecting")).toEqual({ sending: false, receiving: false, connection: "connecting", quality: "connecting" });
  });

  it("indica degradação por perda de pacotes ou latência alta", () => {
    expect(summarizePeerAudioStats([
      { type: "inbound-rtp", kind: "audio", bytesReceived: 220, packetsReceived: 20, packetsLost: 3 },
      { type: "candidate-pair", currentRoundTripTime: 0.42 },
    ], "connected").quality).toBe("degraded");
  });

  it("detecta uma mídia que parou usando deltas, mesmo com contadores acumulados positivos", () => {
    const first = [
      { type: "outbound-rtp", kind: "audio", bytesSent: 320 },
      { type: "inbound-rtp", kind: "audio", bytesReceived: 280, packetsReceived: 20 },
    ];
    const previous = readPeerAudioSnapshot(first);
    const stalled = summarizePeerAudioStats(first, "connected", previous);
    expect(stalled).toMatchObject({ sending: false, receiving: false, quality: "degraded" });
  });
});
