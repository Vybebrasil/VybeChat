export type PendingIceCandidates = Map<string, RTCIceCandidateInit[]>;

export function queueIceCandidate(queue: PendingIceCandidates, peerId: string, candidate: RTCIceCandidateInit) {
  const current = queue.get(peerId) ?? [];
  queue.set(peerId, [...current, candidate]);
}

export function drainIceCandidates(queue: PendingIceCandidates, peerId: string) {
  const candidates = queue.get(peerId) ?? [];
  queue.delete(peerId);
  return candidates;
}
