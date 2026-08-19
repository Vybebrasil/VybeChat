import { describe, expect, it } from "vitest";
import { normalizeExternalMessage } from "./cloudflare-safe-message";

describe("normalizeExternalMessage", () => {
  it("preserva texto e quebras de linha para o renderizador nativo", () => {
    expect(normalizeExternalMessage("Linha 1\nLinha 2")).toBe("Linha 1\nLinha 2");
  });

  it("evita que valores inesperados interrompam a renderização do canal", () => {
    expect(normalizeExternalMessage(null)).toBe("");
    expect(normalizeExternalMessage({ content: "texto" })).toBe("");
  });
});
