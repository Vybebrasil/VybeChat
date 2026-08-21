export type CallMediaMode = "camera-and-audio" | "audio-only" | "listen-only";

export type CallMediaResult = {
  stream: MediaStream;
  mode: CallMediaMode;
};

type MediaDevicesLike = Pick<MediaDevices, "getUserMedia">;

export type CallDeviceSelection = {
  audioInputId?: string;
  videoInputId?: string;
};

export const CALL_AUDIO_CONSTRAINTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
  // Isolamento de voz do Chrome: separa a voz de quem esta perto do microfone do
  // resto — musica, jogo, TV, gente falando ao fundo. E o unico recurso do
  // navegador que ataca o caso de alguem com caixa de som, porque o cancelamento
  // de eco so cancela o que o proprio navegador toca, nao o audio de outro
  // programa. Navegador que nao conhece a propriedade simplesmente a ignora.
  voiceIsolation: true,
  // Nomes antigos, ainda respeitados por versoes do Chromium em uso.
  googEchoCancellation: true,
  googNoiseSuppression: true,
  googAutoGainControl: true,
  googHighpassFilter: true,
} as MediaTrackConstraints;

export const CALL_VIDEO_CONSTRAINTS = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 30, max: 30 },
  facingMode: "user",
};

export function getCallConstraints(selection: CallDeviceSelection = {}) {
  const audio = selection.audioInputId
    ? { ...CALL_AUDIO_CONSTRAINTS, deviceId: { exact: selection.audioInputId } }
    : CALL_AUDIO_CONSTRAINTS;
  const video = selection.videoInputId
    ? { ...CALL_VIDEO_CONSTRAINTS, deviceId: { exact: selection.videoInputId } }
    : CALL_VIDEO_CONSTRAINTS;
  return { audio, video };
}

/** Falta de microfone nao deve impedir de entrar: da para so ouvir. */
export function isMissingDeviceError(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  return name === "NotFoundError" || name === "NotAllowedError" || name === "NotReadableError" || name === "OverconstrainedError";
}

/**
 * Ao entrar numa sala pedimos so o microfone. Antes a camera era ligada e logo
 * silenciada: a luz acendia, o navegador pedia permissao de video e a pessoa
 * entrava com a camera engatada sem precisar. A camera passa a ser ligada apenas
 * quando alguem clica em "Ligar camera".
 */
export async function getCallMedia(
  mediaDevices: MediaDevicesLike,
  selection: CallDeviceSelection = {},
  { includeVideo = false }: { includeVideo?: boolean } = {},
): Promise<CallMediaResult> {
  const constraints = getCallConstraints(selection);
  try {
    if (!includeVideo) throw new Error("entrada somente com microfone");
    const stream = await mediaDevices.getUserMedia({ video: constraints.video, audio: constraints.audio });
    return { stream, mode: "camera-and-audio" };
  } catch {
    try {
      const stream = await mediaDevices.getUserMedia({ video: false, audio: constraints.audio });
      return { stream, mode: "audio-only" };
    } catch (error) {
      // Antes isso derrubava a entrada inteira: quem nao tinha microfone clicava
      // na sala e nada acontecia, so um aviso solto no rodape. Agora entra em
      // modo de escuta, ouvindo todo mundo sem transmitir.
      if (!isMissingDeviceError(error)) throw error;
      return { stream: new MediaStream(), mode: "listen-only" };
    }
  }
}

/** Liga a camera durante a chamada, sem renegociar: o sender de video ja existe. */
export async function getCameraTrack(mediaDevices: MediaDevicesLike, selection: CallDeviceSelection = {}) {
  const { video } = getCallConstraints(selection);
  const stream = await mediaDevices.getUserMedia({ video, audio: false });
  const track = stream.getVideoTracks()[0];
  if (!track) throw new DOMException("Nenhuma câmera foi retornada pelo dispositivo.", "NotFoundError");
  return { stream, track };
}

export function getCallMediaErrorMessage(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "O navegador bloqueou o microfone. Permita o acesso ao microfone nas configurações do site e tente novamente.";
  }
  if (name === "NotFoundError") {
    return "Nenhum microfone foi encontrado. Conecte um dispositivo de áudio e tente novamente.";
  }
  if (name === "NotReadableError") {
    return "O microfone está sendo usado por outro aplicativo. Feche o outro aplicativo e tente novamente.";
  }
  return "Não foi possível iniciar o áudio. Confira o microfone, as permissões do navegador e tente novamente.";
}
