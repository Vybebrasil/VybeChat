/**
 * Lista da equipe puxada do Monday.
 *
 * Antes a pessoa digitava o proprio nome na entrada, o que gerava um id novo a
 * cada dispositivo (`paulo-mt1y4b23-13ttv`) e nao dava nenhuma identidade real.
 * Agora o VybeChat pergunta quem esta entrando e mostra a equipe com foto, e o
 * id passa a ser o do Monday: estavel, unico e igual em qualquer aparelho.
 *
 * O token do Monday fica em segredo no Worker; o cliente nunca fala com a API
 * do Monday e nunca recebe e-mail nem telefone de ninguem.
 */

export const MONDAY_PREFIX = "monday-";

const MONDAY_ENDPOINT = "https://api.monday.com/v2";
// Versao atual estavel do Monday. A 2024-10 que estava aqui nem consta mais na
// lista de suportadas (a mais antiga e 2025-04), e os campos photo_url e
// is_deleted so existem nas versoes novas — a consulta era recusada e a tela de
// entrada caia no campo de nome livre.
const MONDAY_API_VERSION = "2026-07";
const ROSTER_CACHE_KEY = "team:roster";
export const ROSTER_TTL_MS = 6 * 60 * 60 * 1000;

// Campos validados contra o schema real: `photo_thumb` e `enabled` nao existem
// no tipo User — a foto vem de photo_url e a atividade de status/is_deleted.
const ROSTER_QUERY = "query { users (limit: 200) { id name status is_deleted photo_url { small thumb } } }";

export function parseIdList(value) {
  return String(value ?? "")
    .split(",")
    .map(id => id.trim())
    .filter(Boolean);
}

/** O cliente so precisa de id, nome e foto — o resto do Monday nao sai daqui. */
export function toRosterEntry(user) {
  const foto = user?.photo_url ?? {};
  return {
    id: String(user.id),
    name: String(user.name ?? "").slice(0, 80),
    // `small` (150px) rende melhor que `thumb` (100px) em tela retina.
    photo: String(foto.small ?? foto.thumb ?? ""),
  };
}

export function selectTeam(users, allowedIds) {
  const active = (Array.isArray(users) ? users : []).filter(user => user && user.status === "ACTIVE" && !user.is_deleted);
  const entries = active.map(toRosterEntry).filter(entry => entry.id && entry.name);
  if (!allowedIds.length) return entries.sort(byName);
  // A ordem da lista manda: assim a equipe aparece na ordem que voces definiram,
  // e quem sair do Monday simplesmente some da tela de entrada.
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  return allowedIds.map(id => byId.get(id)).filter(Boolean);
}

function byName(first, second) {
  return first.name.localeCompare(second.name, "pt-BR");
}

export async function fetchMondayUsers(token, fetchImpl = fetch, apiVersion = MONDAY_API_VERSION) {
  const response = await fetchImpl(MONDAY_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
      "API-Version": apiVersion,
    },
    body: JSON.stringify({ query: ROSTER_QUERY }),
  });
  if (!response.ok) throw new Error(`Monday respondeu ${response.status}`);
  const body = await response.json();
  if (body.errors?.length) throw new Error(String(body.errors[0]?.message ?? "Monday recusou a consulta"));
  return body.data?.users ?? [];
}

/**
 * Devolve a equipe, usando o cache do Durable Object. Se o Monday falhar e
 * houver cache — mesmo vencido — ele vale: melhor uma foto velha do que uma
 * tela de entrada quebrada.
 */
export async function loadRoster({ storage, token, allowedIds, now = Date.now(), fetchImpl = fetch, apiVersion = MONDAY_API_VERSION }) {
  const cached = await storage.get(ROSTER_CACHE_KEY);
  if (cached && now - cached.fetchedAt < ROSTER_TTL_MS) return { team: cached.team, source: "cache" };
  if (!token) return { team: cached?.team ?? [], source: cached ? "cache-sem-token" : "vazio" };

  try {
    const users = await fetchMondayUsers(token, fetchImpl, apiVersion);
    const team = selectTeam(users, allowedIds);
    await storage.put(ROSTER_CACHE_KEY, { team, fetchedAt: now });
    return { team, source: "monday" };
  } catch (error) {
    if (cached) return { team: cached.team, source: "cache-expirado" };
    throw error;
  }
}
