import { describe, expect, it } from "vitest";
import { collectChannelIds, DEFAULT_WORKSPACE, loadWorkspace, MAX_CHANNELS, nextChannelId, sanitizeWorkspace } from "../cloudflare-worker/vybechat-realtime/src/workspace.js";

class MemoryStorage {
  values = new Map<string, unknown>();
  async get(key: string) { return this.values.get(key); }
  async put(key: string, value: unknown) { this.values.set(key, structuredClone(value)); }
}

describe("estrutura de canais", () => {
  it("mantém a estrutura antiga enquanto ninguém alterar nada", async () => {
    const time = await loadWorkspace(new MemoryStorage());
    expect(time).toEqual(DEFAULT_WORKSPACE);
  });

  it("guarda e devolve a estrutura alterada", async () => {
    const storage = new MemoryStorage();
    const nova = [{ name: "TIME", channels: [{ id: 1, name: "geral", type: "text" }] }];
    await storage.put("workspace:channels", nova);
    expect(await loadWorkspace(storage)).toEqual(nova);
  });

  it("recusa ids repetidos: mensagens de um canal apareceriam no outro", () => {
    const limpo = sanitizeWorkspace([
      { name: "A", channels: [{ id: 1, name: "geral", type: "text" }, { id: 1, name: "outro", type: "text" }] },
    ]);
    expect(limpo?.[0].channels).toHaveLength(1);
  });

  it("descarta canal sem nome e categoria vazia", () => {
    const limpo = sanitizeWorkspace([
      { name: "A", channels: [{ id: 1, name: "   ", type: "text" }] },
      { name: "B", channels: [{ id: 2, name: "entregas", type: "text" }] },
    ]);
    expect(limpo).toHaveLength(1);
    expect(limpo?.[0].name).toBe("B");
  });

  it("tipo desconhecido vira canal de texto", () => {
    const limpo = sanitizeWorkspace([{ name: "A", channels: [{ id: 1, name: "x", type: "sei-la" }] }]);
    expect(limpo?.[0].channels[0].type).toBe("text");
  });

  it("estrutura vazia é recusada: ficar sem canal deixaria o app inutilizável", () => {
    expect(sanitizeWorkspace([])).toBeNull();
    expect(sanitizeWorkspace(null)).toBeNull();
    expect(sanitizeWorkspace([{ name: "", channels: [] }])).toBeNull();
  });

  it("limita a quantidade de canais", () => {
    const muitos = Array.from({ length: 200 }, (_, i) => ({ id: i + 1, name: `c${i}`, type: "text" }));
    const limpo = sanitizeWorkspace([{ name: "TUDO", channels: muitos }]);
    expect(collectChannelIds(limpo).size).toBeLessThanOrEqual(MAX_CHANNELS);
  });

  it("sugere o próximo id livre, reaproveitando buracos", () => {
    expect(nextChannelId([{ name: "A", channels: [{ id: 1, name: "a", type: "text" }, { id: 3, name: "c", type: "text" }] }])).toBe(2);
    expect(nextChannelId(DEFAULT_WORKSPACE)).toBe(18);
  });

  it("corta nomes exagerados em vez de recusar", () => {
    const limpo = sanitizeWorkspace([{ name: "X".repeat(200), channels: [{ id: 1, name: "y".repeat(200), type: "text" }] }]);
    expect(limpo?.[0].name.length).toBe(40);
    expect(limpo?.[0].channels[0].name.length).toBe(40);
  });
});
