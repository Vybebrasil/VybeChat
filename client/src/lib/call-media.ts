export type CallMediaMode = "camera-and-audio" | "audio-only";

export type CallMediaResult = {
  stream: MediaStream;
  mode: CallMediaMode;
};

type MediaDevicesLike = Pick<MediaDevices, "getUserMedia">;

export async function getCallMedia(mediaDevices: MediaDevicesLike): Promise<CallMediaResult> {
  try {
    const stream = await mediaDevices.getUserMedia({ video: true, audio: true });
    return { stream, mode: "camera-and-audio" };
  } catch {
    const stream = await mediaDevices.getUserMedia({ video: false, audio: true });
    return { stream, mode: "audio-only" };
  }
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
