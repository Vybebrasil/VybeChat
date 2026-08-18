import { describe, expect, it } from "vitest";

describe("Cloudflare realtime worker endpoint", () => {
  it("responds on the configured public URL", async () => {
    const workerUrl = process.env.VITE_REALTIME_WORKER_URL;
    expect(workerUrl).toMatch(/^https:\/\/.+\.workers\.dev$/);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(workerUrl!, { signal: controller.signal });
    clearTimeout(timeout);
    expect(response.ok).toBe(true);
  }, 20000);
});
