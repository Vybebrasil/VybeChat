import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workerSource = readFileSync(new URL("../cloudflare-worker/vybechat-realtime/src/index.js", import.meta.url), "utf8");

describe("cloudflare collaboration worker contract", () => {
  it("declares events for reactions, pins, threads, search and direct voice invites", () => {
    ["message:reaction", "message:pin", "message:search", "call:invite", "parentId", "message:search-results"].forEach(event => {
      expect(workerSource).toContain(event);
    });
  });

  it("enforces privileged moderation and channel permissions in the Durable Object", () => {
    expect(workerSource).toContain("channel:permissions:update");
    expect(workerSource).toContain("canManagePermissions(state.role)");
    expect(workerSource).toContain("modo somente leitura");
    expect(workerSource).toContain("Apenas moderadores podem fixar decisões");
  });
});
