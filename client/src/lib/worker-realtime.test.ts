import { describe, expect, it } from "vitest";
import { parseWorkerRealtimeMessage, toWorkerWebSocketUrl } from "./worker-realtime";

describe("worker realtime protocol", () => {
  it("converts the public worker URL into a room WebSocket URL", () => {
    expect(toWorkerWebSocketUrl("https://vybechat-realtime.gestaovybe.workers.dev")).toBe("wss://vybechat-realtime.gestaovybe.workers.dev/room/vybe-os");
  });

  it("accepts typed event envelopes from the Worker", () => {
    expect(parseWorkerRealtimeMessage('{"type":"voice:rooms","payload":[]}')).toEqual({ type: "voice:rooms", payload: [] });
    expect(() => parseWorkerRealtimeMessage('{"payload":[]}')).toThrow("Worker event type is missing");
  });

  it("keeps the room key within the worker URL path", () => {
    expect(toWorkerWebSocketUrl("https://vybechat-realtime.gestaovybe.workers.dev", "agencia-vybe")).toBe("wss://vybechat-realtime.gestaovybe.workers.dev/room/agencia-vybe");
  });
});
