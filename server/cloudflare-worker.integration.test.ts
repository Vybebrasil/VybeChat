import { describe, expect, it } from "vitest";
import { VybeChatRoom } from "../cloudflare-worker/vybechat-realtime/src/index.js";

class MemoryStorage {
  values = new Map<string, unknown>();
  async get(key: string) { return this.values.get(key); }
  async put(key: string, value: unknown) { this.values.set(key, structuredClone(value)); }
}

class FakeSocket {
  attachment: Record<string, unknown>;
  sent: string[] = [];
  constructor(attachment: Record<string, unknown>) { this.attachment = attachment; }
  deserializeAttachment() { return this.attachment; }
  serializeAttachment(value: Record<string, unknown>) { this.attachment = value; }
  send(value: string) { this.sent.push(value); }
}

function setup() {
  const storage = new MemoryStorage();
  const admin = new FakeSocket({ socketId: "admin-socket", userId: "gestaovybe@gmail.com", name: "Admin", status: "online", role: "admin", callChannelId: null });
  const member = new FakeSocket({ socketId: "member-socket", userId: "member@vybe.com", name: "Member", status: "online", role: "member", callChannelId: null });
  const sockets = [admin, member];
  const room = new VybeChatRoom({ storage, getWebSockets: () => sockets });
  return { room, storage, admin, member, sockets };
}

function packets(socket: FakeSocket) { return socket.sent.map(value => JSON.parse(value)); }

describe("VybeChatRoom collaboration integration", () => {
  it("persists a thread, broadcasts reactions and returns matching search results", async () => {
    const { room, storage, admin, member } = setup();
    await room.handleEvent(admin, "message:new", { channelId: 1, content: "Decisão principal" });
    const [root] = (await storage.get("messages:1")) as Array<{ id: string; reactions?: unknown }>;
    await room.handleEvent(member, "message:new", { channelId: 1, content: "Resposta de apoio", parentId: root.id });
    await room.handleEvent(member, "message:reaction", { channelId: 1, messageId: root.id, emoji: "👍" });
    await room.handleEvent(member, "message:search", { query: "decisão" });
    const history = (await storage.get("messages:1")) as Array<{ parentId?: string; reactions?: Record<string, string[]> }>;
    expect(history[1]?.parentId).toBe(root.id);
    expect(history[0]?.reactions?.["👍"]).toEqual(["member@vybe.com"]);
    expect(packets(member).some(packet => packet.type === "message:search-results" && packet.payload.results.length === 1)).toBe(true);
  });

  it("enforces pin, read-only and invitation policies by role", async () => {
    const { room, storage, admin, member } = setup();
    await storage.put("messages:1", [{ id: "m1", channelId: 1, userId: "admin", authorName: "Admin", content: "Fixar", createdAt: "now" }]);
    await room.handleEvent(member, "message:pin", { channelId: 1, messageId: "m1" });
    expect(packets(member).at(-1)?.payload.message).toContain("Apenas moderadores");
    await room.handleEvent(admin, "channel:permissions:update", { channelId: 1, readOnly: true, invitePolicy: "admin" });
    await room.handleEvent(member, "message:new", { channelId: 1, content: "bloqueado" });
    await room.handleEvent(member, "call:invite", { channelId: 1, userId: "gestaovybe@gmail.com" });
    expect(packets(member).filter(packet => packet.type === "realtime:error")).toHaveLength(3);
  });

  it("persists a promoted moderator role and permits that moderator to pin a decision", async () => {
    const { room, storage, admin, member } = setup();
    await storage.put("messages:1", [{ id: "m1", channelId: 1, userId: "admin", authorName: "Admin", content: "Fixar", createdAt: "now" }]);
    await room.handleEvent(admin, "team:role:update", { userId: "member@vybe.com", role: "moderator" });
    await room.handleEvent(member, "message:pin", { channelId: 1, messageId: "m1" });
    expect(await storage.get("role:member@vybe.com")).toBe("moderator");
    expect(await storage.get("pins:1")).toEqual(["m1"]);
  });

  it("persists an administrator promotion and restores it on a new presence join", async () => {
    const { room, storage, admin, sockets } = setup();
    await room.handleEvent(admin, "team:role:update", { userId: "lead@vybe.com", role: "admin" });
    const reconnected = new FakeSocket({ socketId: "lead-reconnected", userId: null, name: "Visitante", status: "offline", role: "member", callChannelId: null });
    sockets.push(reconnected);
    await room.handleEvent(reconnected, "presence:join", { userId: "lead@vybe.com", name: "Lead", status: "online" });
    expect(await storage.get("role:lead@vybe.com")).toBe("admin");
    expect(reconnected.deserializeAttachment().role).toBe("admin");
  });

  it("persists direct messages, emits them to the recipient and clears the local unread counter", async () => {
    const { room, storage, admin, member } = setup();
    await room.handleEvent(admin, "direct:new", { toUserId: "member@vybe.com", toName: "Member", content: "Pode revisar a entrega?" });
    await room.handleEvent(member, "direct:list", {});
    await room.handleEvent(member, "direct:history", { peerUserId: "gestaovybe@gmail.com" });
    await room.handleEvent(member, "direct:read", { peerUserId: "gestaovybe@gmail.com" });
    const index = await storage.get("direct:index:member@vybe.com") as Array<{ unreadCount: number }>;
    expect(index[0]?.unreadCount).toBe(0);
    expect(packets(member).some(packet => packet.type === "direct:new" && packet.payload.message.content === "Pode revisar a entrega?")).toBe(true);
    expect(packets(member).some(packet => packet.type === "direct:history" && packet.payload.messages.length === 1)).toBe(true);
  });

  it("sincroniza o pedido de fala de um participante da sala", async () => {
    const { room, member } = setup();
    await room.handleEvent(member, "call:join", { channelId: 5 });
    await room.handleEvent(member, "call:hand-raise", { channelId: 5, active: true });
    const rooms = packets(member).filter(packet => packet.type === "voice:rooms").at(-1)?.payload;
    expect(rooms[0]?.members[0]?.handRaised).toBe(true);
  });
});
