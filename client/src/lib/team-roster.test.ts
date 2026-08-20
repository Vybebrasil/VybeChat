import { describe, expect, it, vi } from "vitest";
import { fetchTeamRoster, filtrarEquipe, iniciais, primeiroNome, toProfileId, type TeamMember } from "./team-roster";

const EQUIPE: TeamMember[] = [
  { id: "68035537", name: "Paulo Martins", photo: "https://files.monday.com/p.png" },
  { id: "68035653", name: "Vinícius Damascena", photo: "" },
  { id: "78158742", name: "Ademir Dourado Santana", photo: "" },
  { id: "100482777", name: "Jady Amynne Oliveira Lima", photo: "" },
];

describe("seletor da equipe", () => {
  it("acha quem tem acento sem digitar acento", () => {
    expect(filtrarEquipe(EQUIPE, "vini").map(p => p.name)).toEqual(["Vinícius Damascena"]);
    expect(filtrarEquipe(EQUIPE, "vinícius").map(p => p.name)).toEqual(["Vinícius Damascena"]);
  });

  it("busca por qualquer parte do nome, não só pelo começo", () => {
    expect(filtrarEquipe(EQUIPE, "santana").map(p => p.name)).toEqual(["Ademir Dourado Santana"]);
  });

  it("ignora caixa alta e busca vazia devolve todo mundo", () => {
    expect(filtrarEquipe(EQUIPE, "JADY")).toHaveLength(1);
    expect(filtrarEquipe(EQUIPE, "   ")).toHaveLength(4);
  });

  it("marca o id como vindo do Monday", () => {
    expect(toProfileId("68035537")).toBe("monday-68035537");
  });

  it("usa primeiro nome e iniciais para quem não tem foto", () => {
    expect(primeiroNome("Jady Amynne Oliveira Lima")).toBe("Jady");
    expect(iniciais("Vinícius Damascena")).toBe("VD");
    expect(iniciais("Bia")).toBe("B");
  });
});

function resposta(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe("busca do roster no Worker", () => {
  it("devolve a equipe quando o código é aceito", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(resposta(200, { team: EQUIPE }));
    const resultado = await fetchTeamRoster("https://worker.exemplo.dev", "codigo", fetchImpl);
    expect(resultado).toEqual({ ok: true, team: EQUIPE, degraded: false });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://worker.exemplo.dev/roster");
    expect(JSON.parse(init.body)).toEqual({ workspaceCode: "codigo" });
  });

  it("explica que o código foi recusado em vez de mostrar erro genérico", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(resposta(401, { error: "não aceito" }));
    const resultado = await fetchTeamRoster("https://worker.exemplo.dev", "errado", fetchImpl);
    expect(resultado).toEqual({ ok: false, message: "O código de acesso da equipe não foi aceito." });
  });

  it("sinaliza modo degradado quando o Monday está fora", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(resposta(200, { team: [], degraded: true }));
    const resultado = await fetchTeamRoster("https://worker.exemplo.dev", "codigo", fetchImpl);
    expect(resultado).toEqual({ ok: true, team: [], degraded: true });
  });

  it("não quebra quando a rede cai", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("offline"));
    const resultado = await fetchTeamRoster("https://worker.exemplo.dev", "codigo", fetchImpl);
    expect(resultado.ok).toBe(false);
  });
});
