import { describe, expect, it } from "vitest";
import { createLocalProfile, normalizeUsername } from "./local-profile";

describe("perfil local por nome", () => {
  it("normaliza espaços e limita o nome do operador", () => {
    expect(normalizeUsername("  Ana   Souza  ")).toBe("Ana Souza");
    expect(normalizeUsername(" ")).toBe("");
  });

  it("gera uma identidade estável a partir do nome normalizado e de um token local", () => {
    expect(createLocalProfile("Jady Ávila", "teste")).toEqual({ id: "jady-avila-teste", name: "Jady Ávila" });
    expect(createLocalProfile("   ", "teste")).toBeNull();
  });
});
