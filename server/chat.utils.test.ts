import { describe, expect, it } from "vitest";
import { isPresenceStatus, normalizeChannelName, normalizeLabel } from "./chat.utils";

describe("chat utility functions", () => {
  it("normalizes labels without losing meaningful spacing", () => {
    expect(normalizeLabel("  Direção   de Arte ")).toBe("Direção de Arte");
  });

  it("creates predictable channel slugs", () => {
    expect(normalizeChannelName(" Direção de Arte & Conteúdo ")).toBe("direcao-de-arte-conteudo");
  });

  it("allows only supported presence values", () => {
    expect(isPresenceStatus("online")).toBe(true);
    expect(isPresenceStatus("away")).toBe(true);
    expect(isPresenceStatus("invisible")).toBe(false);
  });
});
