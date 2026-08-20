export type PeerAudioDiagnostics = {
  sending: boolean;
  receiving: boolean;
  connection: "new" | "connecting" | "connected" | "disconnected" | "failed" | "closed";
  quality: "connecting" | "stable" | "degraded" | "recovering";
};

type AudioStat = {
  type?: string;
  kind?: string;
  mediaType?: string;
  bytesSent?: number;
  bytesReceived?: number;
  currentRoundTripTime?: number;
  packetsLost?: number;
  packetsSent?: number;
};

export function summarizePeerAudioStats(stats: Iterable<AudioStat>, connection: PeerAudioDiagnostics["connection"]): PeerAudioDiagnostics {
  let sending = false;
  let receiving = false;
  let roundTripTime = 0;
  let packetsLost = 0;
  let packetsSent = 0;
  for (const report of Array.from(stats)) {
    if (report.type === "candidate-pair") roundTripTime = Math.max(roundTripTime, report.currentRoundTripTime ?? 0);
    const isAudio = report.kind === "audio" || report.mediaType === "audio";
    if (!isAudio) continue;
    if (report.type === "outbound-rtp" && (report.bytesSent ?? 0) > 0) sending = true;
    if (report.type === "inbound-rtp" && (report.bytesReceived ?? 0) > 0) receiving = true;
    packetsLost += report.packetsLost ?? 0;
    packetsSent += report.packetsSent ?? 0;
  }
  const lossRate = packetsSent > 0 ? packetsLost / packetsSent : 0;
  const quality = connection === "failed" || connection === "disconnected"
    ? "recovering"
    : connection !== "connected"
      ? "connecting"
      : roundTripTime > 0.35 || lossRate > 0.05
        ? "degraded"
        : "stable";
  return { sending, receiving, connection, quality };
}
