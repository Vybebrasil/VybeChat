import { describe, expect, it, vi } from "vitest";
import {
  getCallEnginePreference,
  RealtimeKitSessionError,
  requestRealtimeKitSession,
  shouldFallbackToLegacy,
} from "./realtimekit-session";

describe("RealtimeKit session", () => {
  it("defaults to automatic migration and only falls back when the Worker is unconfigured", () => {
    expect(getCallEnginePreference(undefined)).toBe("auto");
    expect(getCallEnginePreference("realtimekit")).toBe("realtimekit");
    expect(shouldFallbackToLegacy("auto", new RealtimeKitSessionError("missing", "realtimekit_unconfigured", 503))).toBe(true);
    expect(shouldFallbackToLegacy("realtimekit", new RealtimeKitSessionError("missing", "realtimekit_unconfigured", 503))).toBe(false);
    expect(shouldFallbackToLegacy("auto", new RealtimeKitSessionError("offline", "network", 0))).toBe(false);
  });

  it("requests a fresh participant token from the Worker", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      engine: "realtimekit",
      meetingId: "meeting-1",
      participantId: "participant-1",
      authToken: "token-1",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const session = await requestRealtimeKitSession({
      workerUrl: "https://realtime.example.workers.dev/health",
      channelId: 5,
      roomName: "Criação",
      workspaceCode: "equipe",
      user: { id: "monday-7", name: "Ana" },
      fetcher: fetcher as typeof fetch,
    });

    expect(session.authToken).toBe("token-1");
    expect(fetcher).toHaveBeenCalledWith(
      new URL("https://realtime.example.workers.dev/calls/session"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toMatchObject({ channelId: 5, userId: "monday-7" });
  });

  it("preserves the Worker error code for a controlled fallback", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      code: "realtimekit_unconfigured",
      error: "Configure o RealtimeKit.",
    }), { status: 503, headers: { "Content-Type": "application/json" } }));

    await expect(requestRealtimeKitSession({
      workerUrl: "https://realtime.example.workers.dev",
      channelId: 5,
      roomName: "Criação",
      workspaceCode: "equipe",
      user: { id: "monday-7", name: "Ana" },
      fetcher: fetcher as typeof fetch,
    })).rejects.toMatchObject({ code: "realtimekit_unconfigured", status: 503 });
  });
});
