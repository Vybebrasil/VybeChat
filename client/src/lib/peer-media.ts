/**
 * Prepara as linhas de mídia de uma conexão com um participante.
 *
 * Compartilhar tela derrubava a voz. O código procurava o sender de vídeo por
 * `sender.track?.kind === "video"`, que só encontra quando já existe um track —
 * então quem entrava sem câmera, ou quem já tinha parado um compartilhamento
 * antes (o `replaceTrack(null)` zera o track), caía num caminho que adicionava o
 * track e criava uma oferta nova no meio da chamada.
 *
 * Essa renegociação manual ainda passava por fora do controle de colisão de
 * ofertas: se o outro lado ofertasse ao mesmo tempo, a exceção quebrava a
 * conexão inteira e o áudio ia junto.
 *
 * A saída é garantir uma linha de vídeo desde a criação da conexão. Assim
 * compartilhar tela é sempre `replaceTrack`, que não renegocia nada.
 */

type MinimalSender = { track: MediaStreamTrack | null };

/** Só o que esta função usa da RTCPeerConnection, para poder ser testada. */
type MinimalConnection = {
  addTrack: (track: MediaStreamTrack, stream: MediaStream) => unknown;
  getSenders: () => readonly MinimalSender[];
  addTransceiver: (kind: string, init?: RTCRtpTransceiverInit) => { sender: MinimalSender };
};

export function attachLocalMedia(connection: MinimalConnection, stream: MediaStream | null) {
  const localTracks = stream ? stream.getTracks() : [];
  for (const track of localTracks) connection.addTrack(track, stream as MediaStream);

  const videoTrack = localTracks.find(track => track.kind === "video");
  const videoSender = videoTrack
    ? connection.getSenders().find(sender => sender.track === videoTrack)
    : connection.addTransceiver("video", { direction: "sendrecv" as RTCRtpTransceiverDirection }).sender;

  // Sem microfone a linha de áudio ainda precisa existir para receber, senão a
  // oferta sai sem mídia e quem entrou só para ouvir não ouve ninguém.
  if (!localTracks.some(track => track.kind === "audio")) {
    connection.addTransceiver("audio", { direction: "recvonly" as RTCRtpTransceiverDirection });
  }

  return videoSender ?? null;
}
