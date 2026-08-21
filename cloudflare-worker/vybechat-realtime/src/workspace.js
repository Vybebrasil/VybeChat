/**
 * Estrutura de canais da equipe.
 *
 * Os canais estavam fixos no código do cliente. Criar, renomear ou remover um
 * exigia alterar o arquivo e publicar de novo — foi assim que a seção "PESSOAL"
 * acabou com gente que não é da equipe e sem gente que é.
 *
 * Agora a estrutura vive no Durable Object e qualquer administrador altera pelo
 * próprio VybeChat.
 */

export const WORKSPACE_KEY = "workspace:channels";
export const MAX_CHANNELS = 60;

/** O que existia fixo no código, usado enquanto ninguém tiver alterado nada. */
export const DEFAULT_WORKSPACE = [
  { name: "OPERAÇÃO", channels: [{ id: 1, name: "geral", type: "text" }, { id: 2, name: "entregas", type: "text" }] },
  { name: "CRIAÇÃO", channels: [{ id: 3, name: "direção-de-arte", type: "text" }, { id: 4, name: "conteúdo", type: "text" }] },
  { name: "ENCONTROS", channels: [{ id: 5, name: "sala-geral", type: "voice" }, { id: 6, name: "war-room", type: "voice" }] },
  {
    name: "PESSOAL",
    channels: ["paulo", "vinícius", "ewerton", "reriston", "deivid", "beatriz", "tainara", "breno", "eduardo", "jady", "mizinho"]
      .map((name, index) => ({ id: index + 7, name, type: "voice" })),
  },
];

function limparNome(value, tamanho) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, tamanho);
}

/**
 * Aceita só o que faz sentido guardar. Um nome vazio, um tipo desconhecido ou um
 * id repetido quebraria a navegação de todo mundo, então some aqui.
 */
export function sanitizeWorkspace(value) {
  if (!Array.isArray(value)) return null;
  const idsVistos = new Set();
  const categorias = [];

  for (const categoria of value) {
    const nome = limparNome(categoria?.name, 40);
    if (!nome || !Array.isArray(categoria?.channels)) continue;
    const canais = [];
    for (const canal of categoria.channels) {
      const id = Number(canal?.id);
      const nomeCanal = limparNome(canal?.name, 40);
      if (!Number.isInteger(id) || id < 1 || id > 999 || !nomeCanal) continue;
      // Dois canais com o mesmo id fariam mensagens de um aparecer no outro.
      if (idsVistos.has(id)) continue;
      idsVistos.add(id);
      canais.push({ id, name: nomeCanal, type: canal?.type === "voice" ? "voice" : "text" });
      if (idsVistos.size >= MAX_CHANNELS) break;
    }
    if (canais.length) categorias.push({ name: nome, channels: canais });
    if (idsVistos.size >= MAX_CHANNELS) break;
  }

  // Ficar sem canal nenhum deixaria o VybeChat inutilizável.
  return categorias.length ? categorias : null;
}

export function collectChannelIds(workspace) {
  return new Set((workspace ?? []).flatMap(categoria => categoria.channels.map(canal => canal.id)));
}

/** Próximo id livre, para quem cria um canal não precisar escolher número. */
export function nextChannelId(workspace) {
  const ids = collectChannelIds(workspace);
  let proximo = 1;
  while (ids.has(proximo)) proximo += 1;
  return proximo;
}

export async function loadWorkspace(storage) {
  const guardado = await storage.get(WORKSPACE_KEY);
  return sanitizeWorkspace(guardado) ?? DEFAULT_WORKSPACE;
}
