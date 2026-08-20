/**
 * Detecção de fala por nível de áudio.
 *
 * O indicador "Falando" só acendia quando o push-to-talk estava ligado, porque
 * `isSpeaking` era preenchido exclusivamente pela tecla. Com push-to-talk
 * desligado — o padrão — ninguém nunca aparecia falando.
 */

export const SPEAKING_THRESHOLD = 0.045;
/** Segura o estado ligado por um instante para não piscar entre sílabas. */
export const SPEAKING_RELEASE_MS = 600;

export function getAudioLevel(samples: Uint8Array) {
  if (!samples.length) return 0;
  let sum = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const centered = (samples[index] - 128) / 128;
    sum += centered * centered;
  }
  return Math.sqrt(sum / samples.length);
}

export function isSpeakingNow(options: { level: number; wasSpeaking: boolean; lastAboveAt: number; now: number }) {
  if (options.level >= SPEAKING_THRESHOLD) return true;
  if (!options.wasSpeaking) return false;
  return options.now - options.lastAboveAt < SPEAKING_RELEASE_MS;
}

type DetectorOptions = {
  stream: MediaStream;
  onChange: (speaking: boolean) => void;
  intervalMs?: number;
};

/** Retorna a função de parada; devolve null se o navegador não tiver AudioContext. */
export function createSpeakingDetector({ stream, onChange, intervalMs = 220 }: DetectorOptions) {
  const AudioContextImpl = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextImpl || !stream.getAudioTracks().length) return null;

  const context = new AudioContextImpl();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);

  const samples = new Uint8Array(analyser.frequencyBinCount);
  let speaking = false;
  let lastAboveAt = 0;

  const timer = window.setInterval(() => {
    analyser.getByteTimeDomainData(samples);
    const level = getAudioLevel(samples);
    const now = Date.now();
    if (level >= SPEAKING_THRESHOLD) lastAboveAt = now;
    const next = isSpeakingNow({ level, wasSpeaking: speaking, lastAboveAt, now });
    if (next !== speaking) {
      speaking = next;
      onChange(next);
    }
  }, intervalMs);

  return () => {
    window.clearInterval(timer);
    source.disconnect();
    analyser.disconnect();
    void context.close().catch(() => undefined);
  };
}
