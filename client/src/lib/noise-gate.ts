import { getAudioLevel } from "./speaking-detector";
import { METER_FLOOR_DB, sensitivityToDb, toDbfs, toMeterPercent } from "./mic-preview";

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

/** Abaixo disto é silêncio, em dBFS. Mais alto = mais rígido (corta mais). */
export const DEFAULT_GATE_THRESHOLD_DB = -50;
/** Quanto tempo continua aberto depois da última fala, para não cortar sílabas. */
export const GATE_HOLD_MS = 900;
const SAMPLE_INTERVAL_MS = 80;

/** `level` e `threshold` em dBFS, a mesma escala mostrada na barra. */
export function shouldGateOpen(options: { level: number; threshold: number; lastVoiceAt: number; now: number }) {
  if (options.level >= options.threshold) return true;
  return options.now - options.lastVoiceAt < GATE_HOLD_MS;
}

/** 0 a 100 na interface vira o limiar em dB. 0 desliga o portão. */
export function sensitivityToThreshold(sensitivity: number) {
  return sensitivityToDb(sensitivity);
}

type GateOptions = {
  stream: MediaStream;
  getThreshold: () => number;
  /** Só age quando o microfone deveria estar ligado; respeita mute e push-to-talk. */
  isEnabled: () => boolean;
  onChange?: (open: boolean) => void;
  /** Nível atual em 0–100, para alimentar a barra durante a chamada. */
  onLevel?: (percent: number) => void;
};

export function createNoiseGate({ stream, getThreshold, isEnabled, onChange, onLevel }: GateOptions) {
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
    // No piso da escala o portão está desligado: nunca fecha o microfone, mas a
    // barra continua viva para a pessoa enxergar o próprio nível.
    if (threshold <= METER_FLOOR_DB) {
      analyser.getByteTimeDomainData(samples);
      onLevel?.(toMeterPercent(getAudioLevel(samples)));
      if (!open) { open = true; track.enabled = true; onChange?.(true); }
      return;
    }
    analyser.getByteTimeDomainData(samples);
    const rms = getAudioLevel(samples);
    onLevel?.(toMeterPercent(rms));
    const level = toDbfs(rms);
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
