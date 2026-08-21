/**
 * Prévia do microfone.
 *
 * O controle de corte mostrava só um número ("16%") sem nenhuma referência: não
 * dava para saber se a sua voz passa ou não desse valor, nem como você chega
 * para os outros. A saída é medir a voz **na mesma escala** do controle e
 * deixar a pessoa se ouvir antes de entrar.
 */

/** Topo da escala, igual ao usado por `sensitivityToThreshold`. */
export const METER_FULL_SCALE = 0.12;

/**
 * Converte o nível medido (RMS, 0 a 1) para a mesma escala 0–100 do controle de
 * sensibilidade. É isso que torna os dois comparáveis: se o medidor marca 30 e o
 * corte está em 16, sua voz passa.
 */
export function toMeterPercent(rms: number) {
  if (!Number.isFinite(rms) || rms <= 0) return 0;
  return Math.min(100, Math.round((rms / METER_FULL_SCALE) * 100));
}

/** A voz passa do corte? Mesma comparação que o portão faz na chamada. */
export function passesGate(meterPercent: number, sensitivity: number) {
  if (sensitivity <= 0) return true;
  return meterPercent >= sensitivity;
}

export type PreviewVerdict = "sem-som" | "baixo" | "bom" | "alto";

/**
 * Lê o pico da amostra e diz se o nível está utilizável. Serve para orientar
 * sem exigir que a pessoa interprete números.
 */
export function judgePeak(peakPercent: number): PreviewVerdict {
  if (peakPercent < 6) return "sem-som";
  if (peakPercent < 20) return "baixo";
  if (peakPercent > 92) return "alto";
  return "bom";
}

export const VERDICT_TEXT: Record<PreviewVerdict, string> = {
  "sem-som": "Não captei sua voz. Confira se o microfone certo está selecionado.",
  baixo: "Sua voz está baixa. Fale mais perto ou aumente o volume do microfone no sistema.",
  bom: "Nível bom. Deixe o corte logo abaixo do seu nível de voz.",
  alto: "Sua voz está estourando. Afaste-se um pouco do microfone.",
};

type RecordOptions = {
  stream: MediaStream;
  durationMs?: number;
};

/**
 * Grava alguns segundos do microfone **como ele sai para os outros** — com o
 * portão aplicado — e devolve um endereço para tocar de volta.
 */
export function recordMicSample({ stream, durationMs = 4000 }: RecordOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof MediaRecorder === "undefined") {
      reject(new Error("Este navegador não permite gravar a prévia."));
      return;
    }
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream);
    } catch (error) {
      reject(error);
      return;
    }
    const pedacos: Blob[] = [];
    recorder.ondataavailable = event => { if (event.data.size) pedacos.push(event.data); };
    recorder.onerror = () => reject(new Error("A gravação da prévia falhou."));
    recorder.onstop = () => {
      if (!pedacos.length) return reject(new Error("Nada foi gravado."));
      resolve(URL.createObjectURL(new Blob(pedacos, { type: pedacos[0].type })));
    };
    recorder.start();
    window.setTimeout(() => { if (recorder.state !== "inactive") recorder.stop(); }, durationMs);
  });
}
