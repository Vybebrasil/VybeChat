import { describe, expect, it, vi } from "vitest";
import { loadRoster, parseIdList, ROSTER_TTL_MS, selectTeam, toRosterEntry } from "../cloudflare-worker/vybechat-realtime/src/roster.js";

// Formato conferido contra o schema real do Monday: photo_url + status/is_deleted.
const EQUIPE = [
  { id: 68035537, name: "Paulo Martins", status: "ACTIVE", is_deleted: false, photo_url: { small: "https://files.monday.com/p.png", thumb: "https://files.monday.com/p-t.png" }, email: "gestaovybe@gmail.com" },
  { id: 68036687, name: "Ewerton Luis Souza da Silva", status: "ACTIVE", is_deleted: false, photo_url: { small: "https://files.monday.com/e.png" } },
  { id: 78158742, name: "Ademir Dourado Santana", status: "ACTIVE", is_deleted: false, photo_url: { thumb: "https://files.monday.com/a.png" } },
  { id: 92791859, name: "Luara Carvalho", status: "ACTIVE", is_deleted: false, photo_url: null },
  { id: 98079733, name: "Ewerton Silva", status: "DEACTIVATED", is_deleted: false, photo_url: { small: "" } },
];

class MemoryStorage {
  values = new Map<string, unknown>();
  async get(key: string) { return this.values.get(key); }
  async put(key: string, value: unknown) { this.values.set(key, structuredClone(value)); }
}

describe("roster do Monday", () => {
  it("não expõe e-mail nem telefone para o cliente", () => {
    const entrada = toRosterEntry(EQUIPE[0]);
    expect(entrada).toEqual({ id: "68035537", name: "Paulo Martins", photo: "https://files.monday.com/p.png" });
    expect(JSON.stringify(entrada)).not.toContain("gestaovybe");
    expect(JSON.stringify(entrada)).not.toContain("@");
  });

  it("mantém a ordem da lista configurada e ignora quem está fora dela", () => {
    const time = selectTeam(EQUIPE, ["78158742", "68035537"]);
    expect(time.map(pessoa => pessoa.name)).toEqual(["Ademir Dourado Santana", "Paulo Martins"]);
  });

  it("cai para o thumb quando não há foto small", () => {
    expect(toRosterEntry(EQUIPE[2]).photo).toBe("https://files.monday.com/a.png");
  });

  it("aceita usuário sem foto nenhuma sem quebrar", () => {
    expect(toRosterEntry(EQUIPE[3]).photo).toBe("");
  });

  it("descarta usuário desativado no Monday", () => {
    const time = selectTeam(EQUIPE, ["98079733"]);
    expect(time).toHaveLength(0);
  });

  it("sem lista configurada devolve todo mundo ativo, em ordem alfabética", () => {
    const time = selectTeam(EQUIPE, []);
    expect(time.map(pessoa => pessoa.name)).toEqual([
      "Ademir Dourado Santana",
      "Ewerton Luis Souza da Silva",
      "Luara Carvalho",
      "Paulo Martins",
    ]);
  });

  it("lê a lista de ids tolerando espaços e vírgula sobrando", () => {
    expect(parseIdList(" 1, 2 ,,3 ")).toEqual(["1", "2", "3"]);
    expect(parseIdList(undefined)).toEqual([]);
  });

  it("usa o cache dentro da validade em vez de bater no Monday de novo", async () => {
    const storage = new MemoryStorage();
    const agora = 1_000_000;
    await storage.put("team:roster", { team: [{ id: "1", name: "Cache", photo: "" }], fetchedAt: agora });
    const fetchImpl = vi.fn();
    const resultado = await loadRoster({ storage, token: "t", allowedIds: [], now: agora + 1000, fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(resultado.source).toBe("cache");
  });

  it("se o Monday cair, serve o cache vencido em vez de quebrar a entrada", async () => {
    const storage = new MemoryStorage();
    const agora = 1_000_000;
    await storage.put("team:roster", { team: [{ id: "1", name: "Paulo", photo: "" }], fetchedAt: agora });
    const fetchImpl = vi.fn().mockRejectedValue(new Error("Monday fora do ar"));
    const resultado = await loadRoster({ storage, token: "t", allowedIds: [], now: agora + ROSTER_TTL_MS + 1, fetchImpl });
    expect(resultado.source).toBe("cache-expirado");
    expect(resultado.team[0].name).toBe("Paulo");
  });

  it("busca no Monday e grava o cache quando não há nada guardado", async () => {
    const storage = new MemoryStorage();
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { users: EQUIPE } }),
    });
    const resultado = await loadRoster({ storage, token: "token-secreto", allowedIds: ["68035537"], now: 5, fetchImpl });
    expect(resultado.source).toBe("monday");
    expect(resultado.team).toEqual([{ id: "68035537", name: "Paulo Martins", photo: "https://files.monday.com/p.png" }]);
    expect(await storage.get("team:roster")).toMatchObject({ fetchedAt: 5 });

    const [, init] = fetchImpl.mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBe("token-secreto");
  });

  it("propaga o erro quando o Monday falha e não existe cache nenhum", async () => {
    const storage = new MemoryStorage();
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    await expect(loadRoster({ storage, token: "t", allowedIds: [], now: 1, fetchImpl })).rejects.toThrow("401");
  });
});

// Resposta real da conta gestaovybes-team, capturada da API do Monday.
const RESPOSTA_REAL = [
  { id: "68035537", name: "Paulo Martins", status: "ACTIVE", is_deleted: false, photo_url: { small: "https://files.monday.com/p.png" } },
  { id: "68035653", name: "Vinícius Damascena", status: "ACTIVE", is_deleted: false, photo_url: { small: "https://files.monday.com/v.png" } },
  { id: "68036687", name: "Ewerton Luis Souza da Silva", status: "ACTIVE", is_deleted: false, photo_url: { small: "https://files.monday.com/e.png" } },
  { id: "68036697", name: "Reriston Souza Silva", status: "ACTIVE", is_deleted: false, photo_url: { small: "https://files.monday.com/r.png" } },
  { id: "68997024", name: "Deivid Oliveira Ribeiro", status: "ACTIVE", is_deleted: false, photo_url: { small: "https://files.monday.com/d.png" } },
  { id: "71130408", name: "Beatriz Rocha Cardoso", status: "ACTIVE", is_deleted: false, photo_url: { small: "https://files.monday.com/b.png" } },
  { id: "78158742", name: "Ademir Dourado Santana", status: "ACTIVE", is_deleted: false, photo_url: { small: "https://files.monday.com/ad.png" } },
  { id: "80146924", name: "Tainara Sodré", status: "ACTIVE", is_deleted: false, photo_url: { small: "https://files.monday.com/t.png" } },
  { id: "92791859", name: "Luara Carvalho", status: "ACTIVE", is_deleted: false, photo_url: { small: "https://files.monday.com/lu.png" } },
  { id: "98079733", name: "Ewerton Silva", status: "ACTIVE", is_deleted: false, photo_url: { small: "https://files.monday.com/e2.png" } },
  { id: "99331644", name: "Breno Fernandes", status: "ACTIVE", is_deleted: false, photo_url: { small: "https://files.monday.com/br.png" } },
  { id: "99331648", name: "Eduardo Pereira Teixeira", status: "ACTIVE", is_deleted: false, photo_url: { small: "https://files.monday.com/ed.png" } },
  { id: "100482777", name: "Jady Amynne Oliveira Lima", status: "ACTIVE", is_deleted: false, photo_url: { small: "https://files.monday.com/j.png" } },
  { id: "104320606", name: "Aquilane Gonçalves Ribeiro", status: "ACTIVE", is_deleted: false, photo_url: { small: "https://files.monday.com/aq.png" } },
];

const IDS_DA_EQUIPE = "68035537,68036687,68035653,71130408,68997024,100482777,78158742,80146924,99331648,99331644";

describe("equipe configurada da Vybe", () => {
  it("monta exatamente as 10 pessoas, na ordem definida", () => {
    const time = selectTeam(RESPOSTA_REAL, parseIdList(IDS_DA_EQUIPE));
    expect(time.map(pessoa => pessoa.name)).toEqual([
      "Paulo Martins",
      "Ewerton Luis Souza da Silva",
      "Vinícius Damascena",
      "Beatriz Rocha Cardoso",
      "Deivid Oliveira Ribeiro",
      "Jady Amynne Oliveira Lima",
      "Ademir Dourado Santana",
      "Tainara Sodré",
      "Eduardo Pereira Teixeira",
      "Breno Fernandes",
    ]);
  });

  it("deixa de fora quem não é da equipe, inclusive o Ewerton duplicado", () => {
    const time = selectTeam(RESPOSTA_REAL, parseIdList(IDS_DA_EQUIPE));
    const ids = time.map(pessoa => pessoa.id);
    expect(ids).not.toContain("68036697"); // Reriston
    expect(ids).not.toContain("92791859"); // Luara
    expect(ids).not.toContain("104320606"); // Aquilane
    expect(ids).not.toContain("98079733"); // Ewerton Silva, cadastro duplicado
    expect(time).toHaveLength(10);
  });
});
