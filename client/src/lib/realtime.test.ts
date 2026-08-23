import { describe, expect, it } from "vitest";
import { reconnectDelay } from "./realtime";

describe("realtime reconnect", () => {
  it("uses bounded exponential backoff with jitter", () => {
    expect(reconnectDelay(0, 0)).toBe(800);
    expect(reconnectDelay(1, 0.5)).toBe(2000);
    expect(reconnectDelay(8, 1)).toBe(18_000);
  });
});
