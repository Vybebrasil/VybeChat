export type PeerAudioDiagnostics = {
  sending: boolean;
  receiving: boolean;
  connection: "new" | "connecting" | "connected" | "disconnected" | "failed" | "closed";
};

type AudioStat = {
  type?: string;
  kind?: string;
  mediaType?: string;
  bytesSent?: number;
  bytesReceived?: number;
};

export function summarizePeerAudioStats(stats: Iterable<AudioStat>, connection: PeerAudioDiagnostics["connection"]): PeerAudioDiagnostics {
  let sending = false;
  let receiving = false;
  for (const report of Array.from(stats)) {
    const isAudio = report.kind === "audio" || report.mediaType === "audio";
    if (!isAudio) continue;
    if (report.type === "outbound-rtp" && (report.bytesSent ?? 0) > 0) sending = true;
    if (report.type === "inbound-rtp" && (report.bytesReceived ?? 0) > 0) receiving = true;
  }
  return { sending, receiving, connection };
}
