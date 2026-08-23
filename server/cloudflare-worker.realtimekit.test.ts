import { afterEach, describe, expect, it, vi } from "vitest";
import { VybeChatRoom } from "../cloudflare-worker/vybechat-realtime/src/index.js";

class MemoryStorage {
  values = new Map<string, unknown>();
  async get(key: string) { return this.values.get(key); }
  async put(key: string, value: unknown) { this.values.set(key, structuredClone(value)); }
}

const baseEnv = {
  VYBECHAT_WORKSPACE_CODE: "codigo-da-equipe",
  CLOUDFLARE_ACCOUNT_ID: "account-1",
  REALTIMEKIT_APP_ID: "app-1",
  CLOUDFLARE_REALTIME_API_TOKEN: "api-token",
  REALTIMEKIT_PRESET_NAME: "group-call-host",
};

function request() {
  return new Request("https://worker.example/calls/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      channelId: 5,
      roomName: "Criação",
      workspaceCode: "codigo-da-equipe",
      userId: "monday-7",
      name: "Ana",
    }),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("RealtimeKit Worker session", () => {
  it("reports a controlled error while the account is not configured", async () => {
    const room = new VybeChatRoom({ storage: new MemoryStorage(), getWebSockets: () => [] }, { VYBECHAT_WORKSPACE_CODE: "codigo-da-equipe" });
    const response = await room.handleCallSession(request());
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ code: "realtimekit_unconfigured" });
  });

  it("reuses the meeting for the room and issues a fresh participant token on every join", async () => {
    const storage = new MemoryStorage();
    let participants = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/meetings")) {
        return Response.json({ success: true, data: { id: "meeting-5" } });
      }
      participants += 1;
      return Response.json({ success: true, data: { id: `participant-${participants}`, token: `token-${participants}` } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const room = new VybeChatRoom({ storage, getWebSockets: () => [] }, baseEnv);

    const first = await room.handleCallSession(request());
    const second = await room.handleCallSession(request());

    await expect(first.json()).resolves.toMatchObject({ meetingId: "meeting-5", participantId: "participant-1", authToken: "token-1" });
    await expect(second.json()).resolves.toMatchObject({ meetingId: "meeting-5", participantId: "participant-2", authToken: "token-2" });
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/meetings"))).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/participants"))).toHaveLength(2);
    expect(await storage.get("realtimekit:meeting:5")).toBe("meeting-5");
  });

  it("rejects an invalid workspace code before calling Cloudflare", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const room = new VybeChatRoom({ storage: new MemoryStorage(), getWebSockets: () => [] }, baseEnv);
    const invalid = new Request("https://worker.example/calls/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId: 5, workspaceCode: "errado", userId: "x", name: "X" }),
    });
    const response = await room.handleCallSession(invalid);
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
