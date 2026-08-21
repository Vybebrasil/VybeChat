import { getAudioLevel } from "./speaking-detector";

/**
 * Portão de ruído: só deixa o microfone transmitir enquanto a pessoa fala.
 *
 * O cancelamento de eco do navegador só cancela o que o próprio navegador está
 * tocando — ele não conhece o áudio de um jogo ou de um vídeo em outro programa.
 * Quem usa caixa de som acaba mandando esse som de volta para a chamada como se
 * fosse ambiente. A supressão de ruído também não resolve: ela ataca ruído
 * constante (ventoinha, chiado), não música e voz.
 *
 * O portão não conserta o que passa enquanto a pessoa fala, mas elimina o fundo
 * contínuo nos silêncios — que é a maior parte do tempo numa reunião.
 */

/** Abaixo disto é silêncio. Mais alto = mais rígido (corta mais). */
export const DEFAULT_GATE_THRESHOLD = 0.02;
/** Quanto tempo continua aberto depois da última fala, para não cortar sílabas. */
export const GATE_HOLD_MS = 900;
const SAMPLE_INTERVAL_MS = 80;

export function shouldGateOpen(options: { level: number; threshold: number; lastVoiceAt: number; now: number }) {
  if (options.level >= options.threshold) return true;
  return options.now - options.lastVoiceAt < GATE_HOLD_MS;
}

/** 0 a 100 na interface vira um limiar utilizável. 0 desliga o portão. */
export function sensitivityToThreshold(sensitivity: number) {
  const clamped = Math.min(100, Math.max(0, sensitivity));
  return (clamped / 100) * 0.12;
}

type GateOptions = {
  stream: MediaStream;
  getThreshold: () => number;
  /** Só age quando o microfone deveria estar ligado; respeita mute e push-to-talk. */
  isEnabled: () => boolean;
  onChange?: (open: boolean) => void;
};

export function createNoiseGate({ stream, getThreshold, isEnabled, onChange }: GateOptions) {
  const AudioContextImpl = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  const track = stream.getAudioTracks()[0];
  if (!AudioContextImpl || !track) return null;

  // O portão fecha o microfone com `enabled = false`, e um track desligado entrega
  // silêncio para TODOS os consumidores — inclusive para o analisador. Medindo o
  // próprio track que fechamos, o portão ficava surdo e nunca mais reabria: a
  // pessoa emudecia no primeiro silêncio e assim continuava o resto da chamada.
  //
  // O clone tem `enabled` próprio: ele continua ouvindo o microfone enquanto o
  // track transmitido está fechado.
  const monitor = track.clone();
  const context = new AudioContextImpl();
  const source = context.createMediaStreamSource(new MediaStream([monitor]));
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);

  const samples = new Uint8Array(analyser.frequencyBinCount);
  let lastVoiceAt = 0;
  let open = true;

  const timer = window.setInterval(() => {
    if (!isEnabled()) return;
    const threshold = getThreshold();
    // Limiar zero significa portão desligado: nunca fecha o microfone.
    if (threshold <= 0) {
      if (!open) { open = true; track.enabled = true; onChange?.(true); }
      return;
    }
    analyser.getByteTimeDomainData(samples);
    const level = getAudioLevel(samples);
    const now = Date.now();
    if (level >= threshold) lastVoiceAt = now;
    const next = shouldGateOpen({ level, threshold, lastVoiceAt, now });
    if (next === open) return;
    open = next;
    track.enabled = next;
    onChange?.(next);
  }, SAMPLE_INTERVAL_MS);

  return () => {
    window.clearInterval(timer);
    source.disconnect();
    analyser.disconnect();
    monitor.stop();
    // Nunca deixar o microfone fechado ao desmontar.
    track.enabled = true;
    void context.close().catch(() => undefined);
  };
}
