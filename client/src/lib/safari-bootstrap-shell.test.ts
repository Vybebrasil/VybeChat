import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const clientRoot = fileURLToPath(new URL("../..", import.meta.url));

describe("shell público compatível com Safari", () => {
  it("mantém a sobreposição de diagnóstico até receber a confirmação de montagem", () => {
    const html = readFileSync(`${clientRoot}/index.html`, "utf8");

    expect(html).toContain("window.__vybechatBootstrap");
    expect(html).toContain("VYBE-SAFARI-JS");
    expect(html).toContain("safari-diagnostic.html");
    expect(html).not.toContain("window.setTimeout(dismiss,1600)");
  });

  it("oferece uma rota estática sem React para diagnóstico", () => {
    const diagnostic = readFileSync(`${clientRoot}/public/safari-diagnostic.html`, "utf8");

    expect(diagnostic).toContain("Esta página não usa React");
    expect(diagnostic).toContain("HTML estático: OK");
  });
});
