/**
 * Servidores ICE da chamada.
 *
 * Só havia um STUN público. STUN apenas descobre o endereço externo: quando os
 * dois lados estão atrás de NAT simétrico, firewall corporativo ou 4G restrito,
 * a mídia não tem por onde passar e a chamada nunca conecta — o sintoma é entrar
 * na sala e ninguém se ouvir, sem erro nenhum.
 *
 * TURN resolve isso retransmitindo a mídia. Como exige credencial, ele fica em
 * variáveis de ambiente: sem elas o comportamento é o de antes (só STUN), com
 * elas a taxa de conexão sobe para perto de 100%.
 *
 * Para ligar, defina no projeto do Cloudflare Pages:
 *   VITE_TURN_URLS       ex.: turn:turn.cloudflare.com:3478,turns:turn.cloudflare.com:5349
 *   VITE_TURN_USERNAME
 *   VITE_TURN_CREDENTIAL
 */

const DEFAULT_STUN = "stun:stun.l.google.com:19302";

function splitUrls(value: string | undefined) {
  return String(value ?? "")
    .split(",")
    .map(url => url.trim())
    .filter(Boolean);
}

export function buildIceServers(env: Record<string, string | undefined> = {}): RTCIceServer[] {
  const stunUrls = splitUrls(env.VITE_STUN_URLS);
  const servers: RTCIceServer[] = [{ urls: stunUrls.length ? stunUrls : [DEFAULT_STUN] }];

  const turnUrls = splitUrls(env.VITE_TURN_URLS);
  const username = env.VITE_TURN_USERNAME;
  const credential = env.VITE_TURN_CREDENTIAL;
  if (turnUrls.length && username && credential) {
    servers.push({ urls: turnUrls, username, credential });
  }
  return servers;
}

export function hasTurn(servers: RTCIceServer[]) {
  return servers.some(server => {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    return urls.some(url => String(url).startsWith("turn:") || String(url).startsWith("turns:"));
  });
}

export function getIceServers(): RTCIceServer[] {
  return buildIceServers(import.meta.env as unknown as Record<string, string | undefined>);
}
