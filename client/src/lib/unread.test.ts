import { describe, expect, it } from "vitest";
import { bumpUnread, clearUnread, extractMentions, formatBadge, mentionAliases, mentionsSomeone, totalUnread, type UnreadMap } from "./unread";

describe("menções", () => {
  it("reconhece primeiro nome e nome completo da pessoa", () => {
    const apelidos = mentionAliases("Jady Amynne Oliveira Lima");
    expect(apelidos).toContain("jady");
    expect(apelidos).toContain("jady-amynne-oliveira-lima");
  });

  it("acha a menção mesmo sem acento", () => {
    const apelidos = mentionAliases("Vinícius Damascena");
    expect(mentionsSomeone("bom dia @vinicius", apelidos)).toBe(true);
  });

  it("não confunde com nome parecido", () => {
    expect(mentionsSomeone("@paulinho vê isso", mentionAliases("Paulo Martins"))).toBe(false);
  });

  it("@todos acende para qualquer um", () => {
    expect(mentionsSomeone("@todos reunião agora", mentionAliases("Breno Fernandes"))).toBe(true);
  });

  it("extrai vários citados de uma vez", () => {
    expect(extractMentions("@paulo e @bia revisam")).toEqual(["paulo", "bia"]);
  });

  it("texto sem citação não gera menção", () => {
    expect(mentionsSomeone("email é paulo@vybe.com", mentionAliases("Paulo Martins"))).toBe(false);
  });
});

describe("não lidos por canal", () => {
  const vazio: UnreadMap = {};

  it("conta mensagem de outra pessoa em canal fechado", () => {
    const depois = bumpUnread({ unread: vazio, channelId: 2, activeChannelId: 1, fromSelf: false, mentioned: false });
    expect(depois[2]).toEqual({ count: 1, mentioned: false });
  });

  it("não conta no canal que está aberto", () => {
    expect(bumpUnread({ unread: vazio, channelId: 1, activeChannelId: 1, fromSelf: false, mentioned: false })).toBe(vazio);
  });

  it("não conta a própria mensagem", () => {
    expect(bumpUnread({ unread: vazio, channelId: 2, activeChannelId: 1, fromSelf: true, mentioned: false })).toBe(vazio);
  });

  it("acumula e mantém a menção acesa", () => {
    let mapa = bumpUnread({ unread: vazio, channelId: 3, activeChannelId: 1, fromSelf: false, mentioned: true });
    mapa = bumpUnread({ unread: mapa, channelId: 3, activeChannelId: 1, fromSelf: false, mentioned: false });
    expect(mapa[3]).toEqual({ count: 2, mentioned: true });
  });

  it("abrir o canal zera o contador", () => {
    const mapa = bumpUnread({ unread: vazio, channelId: 4, activeChannelId: 1, fromSelf: false, mentioned: true });
    expect(clearUnread(mapa, 4)[4]).toBeUndefined();
  });

  it("soma o total para o título da aba", () => {
    let mapa = bumpUnread({ unread: vazio, channelId: 1, activeChannelId: 9, fromSelf: false, mentioned: false });
    mapa = bumpUnread({ unread: mapa, channelId: 2, activeChannelId: 9, fromSelf: false, mentioned: false });
    expect(totalUnread(mapa)).toBe(2);
  });

  it("passa de 99 vira 99+", () => {
    expect(formatBadge(0)).toBe("");
    expect(formatBadge(7)).toBe("7");
    expect(formatBadge(153)).toBe("99+");
  });
});
