export function normalizeParticipantVolume(value: number) {
  if (!Number.isFinite(value)) return 100;
  return Math.min(150, Math.max(0, Math.round(value)));
}

export function toMediaElementVolume(value: number) {
  return normalizeParticipantVolume(value) / 100;
}
