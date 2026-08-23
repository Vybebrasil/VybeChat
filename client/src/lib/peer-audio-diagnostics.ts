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
  packetsReceived?: number;
};

export type PeerAudioSnapshot = {
  bytesSent: number;
  bytesReceived: number;
  packetsLost: number;
  packetsReceived: number;
};

export function readPeerAudioSnapshot(stats: Iterable<AudioStat>): PeerAudioSnapshot {
  const snapshot = { bytesSent: 0, bytesReceived: 0, packetsLost: 0, packetsReceived: 0 };
  for (const report of Array.from(stats)) {
    const isAudio = report.kind === "audio" || report.mediaType === "audio";
    if (!isAudio) continue;
    if (report.type === "outbound-rtp") snapshot.bytesSent += report.bytesSent ?? 0;
    if (report.type === "inbound-rtp") {
      snapshot.bytesReceived += report.bytesReceived ?? 0;
      snapshot.packetsLost += report.packetsLost ?? 0;
      snapshot.packetsReceived += report.packetsReceived ?? 0;
    }
  }
  return snapshot;
}

export function summarizePeerAudioStats(stats: Iterable<AudioStat>, connection: PeerAudioDiagnostics["connection"], previous?: PeerAudioSnapshot): PeerAudioDiagnostics {
  const reports = Array.from(stats);
  const current = readPeerAudioSnapshot(reports);
  const sending = previous ? current.bytesSent > previous.bytesSent : current.bytesSent > 0;
  const receiving = previous ? current.bytesReceived > previous.bytesReceived : current.bytesReceived > 0;
  let roundTripTime = 0;
  for (const report of reports) {
    if (report.type === "candidate-pair") roundTripTime = Math.max(roundTripTime, report.currentRoundTripTime ?? 0);
  }
  const lost = Math.max(0, current.packetsLost - (previous?.packetsLost ?? 0));
  const received = Math.max(0, current.packetsReceived - (previous?.packetsReceived ?? 0));
  const lossRate = lost + received > 0 ? lost / (lost + received) : 0;
  // Silencio intencional (todos com microfone desligado) nao e falha. So
  // marcamos o fluxo como travado depois de ele ja ter transportado audio.
  const hadTraffic = Boolean(previous && (previous.bytesSent > 0 || previous.bytesReceived > 0));
  const quality = connection === "failed" || connection === "disconnected"
    ? "recovering"
    : connection !== "connected"
      ? "connecting"
      : roundTripTime > 0.35 || lossRate > 0.05 || (hadTraffic && !sending && !receiving)
        ? "degraded"
        : "stable";
  return { sending, receiving, connection, quality };
}
