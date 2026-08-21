/**
 * Não lidos e menções por canal.
 *
 * Só as conversas diretas tinham contador. Nos canais, mensagem nova não deixava
 * rastro nenhum: quem não estivesse com o canal aberto no momento simplesmente
 * não ficava sabendo — e um chat que não chama de volta deixa de ser usado.
 */

export type ChannelUnread = {
  /** Mensagens desde a última vez que a pessoa abriu o canal. */
  count: number;
  /** Alguma delas cita você. Menção pesa mais e aparece destacada. */
  mentioned: boolean;
};

export type UnreadMap = Record<number, ChannelUnread>;

const VAZIO: ChannelUnread = { count: 0, mentioned: false };

/** Trata "Paulo Martins" e "@paulo" como a mesma pessoa. */
export function mentionSlug(name: string) {
  return name
    .trim()
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Todos os apelidos que devem acender uma menção para esta pessoa. */
export function mentionAliases(fullName: string) {
  const inteiro = mentionSlug(fullName);
  const primeiro = mentionSlug(fullName.split(/\s+/)[0] ?? "");
  return Array.from(new Set([inteiro, primeiro].filter(Boolean)));
}

/** Extrai os @nomes citados num texto. */
export function extractMentions(content: string) {
  const encontrados = content.match(/@[a-zA-ZÀ-ɏ0-9._-]+/g) ?? [];
  return encontrados.map(item => mentionSlug(item.slice(1))).filter(Boolean);
}

export function mentionsSomeone(content: string, aliases: string[]) {
  if (!aliases.length) return false;
  if (/@(todos|everyone|geral)\b/i.test(content)) return true;
  const citados = extractMentions(content);
  return citados.some(citado => aliases.includes(citado));
}

type BumpOptions = {
  unread: UnreadMap;
  channelId: number;
  /** Canal aberto agora: mensagem chegando nele já nasce lida. */
  activeChannelId: number | null;
  /** Mensagem escrita pela própria pessoa não conta. */
  fromSelf: boolean;
  mentioned: boolean;
};

export function bumpUnread({ unread, channelId, activeChannelId, fromSelf, mentioned }: BumpOptions): UnreadMap {
  if (fromSelf || channelId === activeChannelId) return unread;
  const atual = unread[channelId] ?? VAZIO;
  return { ...unread, [channelId]: { count: atual.count + 1, mentioned: atual.mentioned || mentioned } };
}

export function clearUnread(unread: UnreadMap, channelId: number): UnreadMap {
  if (!unread[channelId]) return unread;
  const proximo = { ...unread };
  delete proximo[channelId];
  return proximo;
}

/** Passa de 99 vira "99+", como em qualquer app de mensagem. */
export function formatBadge(count: number) {
  if (count <= 0) return "";
  return count > 99 ? "99+" : String(count);
}

export function totalUnread(unread: UnreadMap) {
  return Object.values(unread).reduce((soma, item) => soma + item.count, 0);
}
