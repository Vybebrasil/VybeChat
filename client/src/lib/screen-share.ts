/**
 * Qualidade do compartilhamento de tela.
 *
 * A captura era `getDisplayMedia({ video: true })`, sem nenhuma restrição: o
 * navegador escolhia sozinho e costuma entregar resolução alta com poucos
 * quadros. Bom para ler texto parado, ruim para mostrar vídeo ou qualquer coisa
 * em movimento, que fica travada.
 *
 * As duas escolhas cobrem o que uma agência de conteúdo faz na prática: mostrar
 * uma arte ou um documento, e mostrar um vídeo rodando.
 */

export type ScreenQuality = "nitida" | "fluida";

export const SCREEN_QUALITY_LABEL: Record<ScreenQuality, string> = {
  nitida: "Nítida",
  fluida: "Fluida",
};

export const SCREEN_QUALITY_HINT: Record<ScreenQuality, string> = {
  nitida: "Para arte, texto e código parados. Mais definição, menos quadros.",
  fluida: "Para vídeo e movimento. Mais quadros, um pouco menos de definição.",
};

export function getScreenConstraints(quality: ScreenQuality): DisplayMediaStreamOptions {
  const video: MediaTrackConstraints =
    quality === "fluida"
      ? { frameRate: { ideal: 60, max: 60 }, width: { ideal: 1280 }, height: { ideal: 720 } }
      : { frameRate: { ideal: 15, max: 30 }, width: { ideal: 1920 }, height: { ideal: 1080 } };
  // O áudio da aba vai junto: é o que faz um vídeo compartilhado chegar com som.
  return { video, audio: true };
}

/**
 * Quem deve ocupar o centro do palco.
 *
 * Antes o compartilhamento só ia para o centro se cada pessoa clicasse em
 * "Fixar" por conta própria — na prática ninguém clicava e a tela ficava numa
 * miniatura. Agora quem compartilha assume o palco sozinho, e ao parar o palco
 * volta para a escolha manual.
 */
export function resolveStageFocus(options: {
  /** Id de quem a pessoa fixou na mão, se fixou. */
  pinnedId: string | null;
  /** Id de quem está compartilhando a tela agora, se alguém está. */
  sharingId: string | null;
}) {
  // Fixar na mão vence: é uma escolha explícita de quem está assistindo.
  if (options.pinnedId) return options.pinnedId;
  return options.sharingId;
}

type Previa = { id: string; isLocal?: boolean; sharingScreen?: boolean };

/**
 * Quem aparece no painel reduzido da chamada.
 *
 * Ele mostrava sempre o primeiro participante, que é sempre você — e, com a
 * câmera desligada, só o seu avatar. Quem compartilhava a tela era recebido
 * corretamente, mas ninguém via nada sem abrir a tela cheia. Priorizar quem
 * compartilha, depois qualquer outra pessoa, e só então você.
 */
export function pickPreviewParticipant<T extends Previa>(participants: T[]): T | null {
  if (!participants.length) return null;
  return (
    participants.find(item => item.sharingScreen && !item.isLocal) ??
    participants.find(item => item.sharingScreen) ??
    participants.find(item => !item.isLocal) ??
    participants[0]
  );
}

/**
 * Ajuste do codificador para a tela compartilhada.
 *
 * Definir só as constraints da captura não basta: o navegador ainda decide
 * sozinho quanta banda usar e o que sacrificar quando aperta. O padrão é
 * conservador — costuma derrubar a resolução para segurar os quadros, e o
 * resultado é texto ilegível e arte borrada.
 *
 * `contentHint` diz ao codificador o que a imagem é, e `degradationPreference`
 * diz o que preservar quando a banda cai.
 */
export const SCREEN_ENCODING: Record<ScreenQuality, {
  maxBitrate: number;
  degradationPreference: RTCDegradationPreference;
  contentHint: "detail" | "motion";
}> = {
  // Texto e arte: preserva nitidez, aceita menos quadros.
  nitida: { maxBitrate: 3_000_000, degradationPreference: "maintain-resolution", contentHint: "detail" },
  // Vídeo: preserva fluidez, aceita menos definição.
  fluida: { maxBitrate: 4_000_000, degradationPreference: "maintain-framerate", contentHint: "motion" },
};

type SenderComParametros = {
  getParameters: () => RTCRtpSendParameters;
  setParameters: (p: RTCRtpSendParameters) => Promise<void>;
};

/** Monta os parâmetros do remetente sem perder o que já estava definido. */
export function buildScreenParameters(atual: RTCRtpSendParameters, quality: ScreenQuality): RTCRtpSendParameters {
  const cfg = SCREEN_ENCODING[quality];
  const encodings = atual.encodings?.length ? atual.encodings.map(e => ({ ...e })) : [{} as RTCRtpEncodingParameters];
  encodings[0].maxBitrate = cfg.maxBitrate;
  // Sem isto o navegador pode continuar reduzindo a imagem por conta própria.
  encodings[0].scaleResolutionDownBy = 1;
  return { ...atual, degradationPreference: cfg.degradationPreference, encodings };
}

export async function applyScreenEncoding(sender: SenderComParametros, quality: ScreenQuality) {
  try {
    await sender.setParameters(buildScreenParameters(sender.getParameters(), quality));
  } catch (error) {
    // Navegador que não aceita o ajuste continua funcionando com o padrão dele.
    console.warn("[VybeChat] nao foi possivel ajustar a qualidade da tela", error);
  }
}
