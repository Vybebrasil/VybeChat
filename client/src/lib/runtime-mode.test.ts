import { describe, expect, it } from "vitest";
import { isCloudflareRuntime } from "./runtime-mode";

describe("isCloudflareRuntime", () => {
  it("prioritizes the static Cloudflare shell on the deployed target", () => {
    expect(isCloudflareRuntime("cloudflare", "/")).toBe(true);
    expect(isCloudflareRuntime(undefined, "/cloudflare-preview")).toBe(true);
    expect(isCloudflareRuntime(undefined, "/")).toBe(false);
  });
});
