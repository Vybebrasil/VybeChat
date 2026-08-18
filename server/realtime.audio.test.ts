import { createServer, type Server as HttpServer } from "http";
import { io as createClient, type Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { attachRealtimeServer } from "./realtime";

type RoomMember = { socketId: string; isMuted: boolean; isSpeaking: boolean };
type RoomSnapshot = { channelId: number; members: RoomMember[] };

function waitForRoom(socket: Socket, channelId: number, predicate: (member: RoomMember) => boolean) {
  return new Promise<RoomSnapshot>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for voice room update")), 1500);
    socket.on("voice:rooms", (rooms: RoomSnapshot[]) => {
      const room = rooms.find(candidate => candidate.channelId === channelId);
      const member = room?.members[0];
      if (!room || !member || !predicate(member)) return;
      clearTimeout(timeout);
      socket.off("voice:rooms");
      resolve(room);
    });
  });
}

describe("realtime audio state", () => {
  let server: HttpServer;
  let client: Socket;

  beforeEach(async () => {
    server = createServer();
    attachRealtimeServer(server);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    client = createClient(`http://127.0.0.1:${port}`, { transports: ["websocket"], forceNew: true });
    await new Promise<void>(resolve => client.on("connect", () => resolve()));
  });

  afterEach(async () => {
    client.close();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it("broadcasts mute and speaking state changes to the room snapshot", async () => {
    client.emit("presence:join", { userId: "1", name: "Bia", status: "online" });
    const joined = waitForRoom(client, 99, member => member.isMuted === false && member.isSpeaking === false);
    client.emit("call:join", { channelId: 99 });
    await expect(joined).resolves.toMatchObject({ channelId: 99 });

    const muted = waitForRoom(client, 99, member => member.isMuted === true && member.isSpeaking === false);
    client.emit("call:audio-state", { channelId: 99, isMuted: true, isSpeaking: true });
    await expect(muted).resolves.toMatchObject({
      channelId: 99,
      members: [{ isMuted: true, isSpeaking: false }],
    });
  });
});
