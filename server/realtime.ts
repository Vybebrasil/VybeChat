import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { isPresenceStatus } from "./chat.utils";
import { buildVoiceRoomSnapshots, updateVoiceMemberAudio, type VoiceRoomMember } from "./voice-room.utils";

type PresenceStatus = "online" | "away" | "offline";

type PresenceUser = {
  userId: string;
  name: string;
  status: PresenceStatus;
};

type CallMember = VoiceRoomMember;

const socketPresence = new Map<string, PresenceUser>();
const callRooms = new Map<string, Map<string, CallMember>>();

function roomName(channelId: number) {
  return `channel:${channelId}`;
}

function callRoomName(channelId: number) {
  return `call:${channelId}`;
}

export function attachRealtimeServer(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: { origin: true, credentials: true },
  });

  const emitPresence = () => {
    const byUser = new Map<string, PresenceUser>();
    for (const presence of Array.from(socketPresence.values())) {
      byUser.set(presence.userId, presence);
    }
    io.emit("presence:update", Array.from(byUser.values()));
  };

  const emitVoiceRooms = () => {
    io.emit("voice:rooms", buildVoiceRoomSnapshots(Array.from(callRooms.entries())));
  };

  const leaveCall = (socketId: string, channelId: number) => {
    const members = callRooms.get(String(channelId));
    if (!members?.has(socketId)) return;

    members.delete(socketId);
    io.to(callRoomName(channelId)).emit("call:peer-left", { channelId, socketId });
    if (members.size === 0) callRooms.delete(String(channelId));
    emitVoiceRooms();
  };

  io.on("connection", socket => {
    socket.on("presence:join", (raw: Partial<PresenceUser>) => {
      if (!raw.userId || !raw.name) return;
      socketPresence.set(socket.id, {
        userId: String(raw.userId),
        name: String(raw.name).slice(0, 80),
        status: isPresenceStatus(raw.status) ? raw.status : "online",
      });
      emitPresence();
      socket.emit("voice:rooms", buildVoiceRoomSnapshots(Array.from(callRooms.entries())));
    });

    socket.on("presence:status", (status: unknown) => {
      const user = socketPresence.get(socket.id);
      if (!user || !isPresenceStatus(status)) return;
      socketPresence.set(socket.id, { ...user, status });
      emitPresence();
    });

    socket.on("channel:join", ({ channelId }: { channelId?: number }) => {
      if (!channelId) return;
      socket.join(roomName(channelId));
    });

    socket.on("message:new", ({ channelId }: { channelId?: number }) => {
      if (!channelId) return;
      io.to(roomName(channelId)).emit("message:new", { channelId });
    });

    socket.on("typing", ({ channelId, name, active }: { channelId?: number; name?: string; active?: boolean }) => {
      if (!channelId || !name) return;
      socket.to(roomName(channelId)).emit("typing", {
        channelId,
        name: String(name).slice(0, 80),
        active: Boolean(active),
      });
    });

    socket.on("call:join", ({ channelId }: { channelId?: number }) => {
      const user = socketPresence.get(socket.id);
      if (!channelId || !user) return;

      const key = String(channelId);
      const members = callRooms.get(key) ?? new Map<string, CallMember>();
      const peers = Array.from(members.values());
      members.set(socket.id, { ...user, socketId: socket.id, isMuted: false, isSpeaking: false });
      callRooms.set(key, members);
      socket.join(callRoomName(channelId));
      socket.emit("call:peers", { channelId, peers });
      socket.to(callRoomName(channelId)).emit("call:peer-joined", {
        channelId,
        peer: { ...user, socketId: socket.id },
      });
      emitVoiceRooms();
    });

    socket.on("call:offer", ({ to, channelId, offer }) => {
      const user = socketPresence.get(socket.id);
      if (!to || !channelId || !offer) return;
      io.to(to).emit("call:offer", { from: socket.id, channelId, offer, user });
    });

    socket.on("call:answer", ({ to, channelId, answer }) => {
      if (!to || !channelId || !answer) return;
      io.to(to).emit("call:answer", { from: socket.id, channelId, answer });
    });

    socket.on("call:ice", ({ to, channelId, candidate }) => {
      if (!to || !channelId || !candidate) return;
      io.to(to).emit("call:ice", { from: socket.id, channelId, candidate });
    });

    socket.on("call:screen-share", ({ channelId, active }: { channelId?: number; active?: boolean }) => {
      if (!channelId) return;
      const user = socketPresence.get(socket.id);
      io.to(callRoomName(channelId)).emit("call:screen-share", {
        channelId,
        socketId: active ? socket.id : null,
        name: active ? user?.name ?? "Participante" : null,
      });
    });

    socket.on("call:audio-state", ({ channelId, isMuted, isSpeaking }: { channelId?: number; isMuted?: boolean; isSpeaking?: boolean }) => {
      if (!channelId || typeof isMuted !== "boolean" || typeof isSpeaking !== "boolean") return;
      const members = callRooms.get(String(channelId));
      const member = members?.get(socket.id);
      if (!members || !member) return;
      members.set(socket.id, updateVoiceMemberAudio(member, isMuted, isSpeaking));
      emitVoiceRooms();
    });

    socket.on("call:leave", ({ channelId }: { channelId?: number }) => {
      if (!channelId) return;
      socket.leave(callRoomName(channelId));
      leaveCall(socket.id, channelId);
    });

    socket.on("disconnect", () => {
      socketPresence.delete(socket.id);
      emitPresence();
      for (const [channelId, members] of Array.from(callRooms.entries())) {
        if (!members.has(socket.id)) continue;
        leaveCall(socket.id, Number(channelId));
      }
    });
  });

  return io;
}
