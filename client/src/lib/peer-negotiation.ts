/**
 * Regras de negociação WebRTC em malha (perfect negotiation).
 *
 * Sem isso, quando a conexão de um par caía, os dois lados disparavam uma oferta
 * de reinício ao mesmo tempo. Quem recebia a oferta já tendo a sua pendente
 * lançava InvalidStateError, ninguém tratava, e aquele par ficava surdo em um
 * sentido só — um ouvia, o outro não.
 *
 * A saída padrão é eleger um lado "educado": ele desfaz a própria oferta e aceita
 * a do outro. O outro ignora a oferta que chegou e mantém a sua. Como os dois
 * lados conhecem os dois socketIds, a comparação de strings decide sem precisar
 * de nenhuma mensagem extra.
 */

export function isPolitePeer(localSocketId: string, remoteSocketId: string) {
  return localSocketId < remoteSocketId;
}

export type NegotiationState = {
  makingOffer: boolean;
  ignoreOffer: boolean;
};

/**
 * Houve colisão quando chega uma oferta enquanto já temos uma em voo (ou a
 * conexão não está estável). O lado educado cede; o impaciente ignora.
 */
export function shouldIgnoreOffer(options: {
  polite: boolean;
  makingOffer: boolean;
  signalingState: RTCSignalingState;
}) {
  const collision = options.makingOffer || options.signalingState !== "stable";
  return collision && !options.polite;
}

export function hasCollision(options: { makingOffer: boolean; signalingState: RTCSignalingState }) {
  return options.makingOffer || options.signalingState !== "stable";
}

/**
 * `disconnected` costuma se resolver sozinho em poucos segundos; `failed` não.
 * Antes só `failed` disparava recuperação, então uma queda que parava em
 * `disconnected` ficava muda para sempre.
 */
export function shouldRestartIce(state: RTCPeerConnectionState) {
  return state === "failed";
}

export function shouldScheduleRestart(state: RTCPeerConnectionState) {
  return state === "disconnected";
}

export const DISCONNECTED_GRACE_MS = 4000;
