import { describe, expect, it } from "vitest";
import { buildIceServers, hasTurn } from "./ice-config";

describe("servidores ICE", () => {
  it("sem configuração mantém o STUN público de antes", () => {
    const servers = buildIceServers({});
    expect(servers).toHaveLength(1);
    expect(servers[0].urls).toEqual(["stun:stun.l.google.com:19302"]);
    expect(hasTurn(servers)).toBe(false);
  });

  it("adiciona TURN quando url, usuário e credencial estão presentes", () => {
    const servers = buildIceServers({
      VITE_TURN_URLS: "turn:turn.exemplo.com:3478, turns:turn.exemplo.com:5349",
      VITE_TURN_USERNAME: "vybe",
      VITE_TURN_CREDENTIAL: "segredo",
    });
    expect(hasTurn(servers)).toBe(true);
    expect(servers[1]).toEqual({
      urls: ["turn:turn.exemplo.com:3478", "turns:turn.exemplo.com:5349"],
      username: "vybe",
      credential: "segredo",
    });
  });

  it("ignora TURN incompleto em vez de gerar configuração inválida", () => {
    const semCredencial = buildIceServers({ VITE_TURN_URLS: "turn:turn.exemplo.com:3478", VITE_TURN_USERNAME: "vybe" });
    expect(hasTurn(semCredencial)).toBe(false);

    const semUrl = buildIceServers({ VITE_TURN_USERNAME: "vybe", VITE_TURN_CREDENTIAL: "segredo" });
    expect(hasTurn(semUrl)).toBe(false);
  });
});
