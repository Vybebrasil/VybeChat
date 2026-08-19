import { describe, expect, it } from "vitest";
import { getEntrypointForTarget, shouldIncludeSafariFallback } from "./entrypoint";

describe("getEntrypointForTarget", () => {
  it("reserves the static shell for the Cloudflare build", () => {
    expect(getEntrypointForTarget("cloudflare")).toBe("/src/cloudflare-main.tsx");
    expect(getEntrypointForTarget(undefined)).toBe("/src/main.tsx");
    expect(shouldIncludeSafariFallback("cloudflare")).toBe(true);
    expect(shouldIncludeSafariFallback(undefined)).toBe(false);
  });
});
