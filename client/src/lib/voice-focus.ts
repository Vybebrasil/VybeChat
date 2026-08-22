export type VoiceFocusMode = "balanced" | "strong";

const LOOPBACK_PATTERN = /stereo\s*mix|what\s*u\s*hear|loopback|system\s*audio|monitor\s*of|blackhole|soundflower|vb-?audio|virtual\s*cable|cable\s*output/i;

export function getLoopbackInputWarning(label: string) {
  if (!label || !LOOPBACK_PATTERN.test(label)) return null;
  return "Esta entrada parece capturar o áudio do sistema. Escolha um microfone físico ou use fones para não transmitir o jogo.";
}

export function getVoiceFocusThreshold(mode: VoiceFocusMode) {
  return mode === "strong" ? 12 : 7;
}

export function getVoiceFocusHoldMs(mode: VoiceFocusMode) {
  return mode === "strong" ? 260 : 430;
}

export function getAudioActivityLevel(samples: Uint8Array) {
  if (!samples.length) return 0;
  const average = samples.reduce((sum, value) => sum + Math.abs(value - 128), 0) / samples.length;
  return Math.min(100, Math.round(average * 4.5));
}

export function shouldKeepVoiceGateOpen(level: number, lastVoiceAt: number, now: number, mode: VoiceFocusMode) {
  return level >= getVoiceFocusThreshold(mode) || now - lastVoiceAt < getVoiceFocusHoldMs(mode);
}
