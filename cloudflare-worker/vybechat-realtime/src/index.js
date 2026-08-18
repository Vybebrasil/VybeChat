const json = (type, payload) => JSON.stringify({ type, payload });

function validChannelId(value) {
  return Number.isInteger(value) && value > 0;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ status: "ok", service: "vybechat-realtime" });
    }

    const match = url.pathname.match(/^\/room\/([a-z0-9-]{1,80})$/i);
    if (!match) return new Response("VybeChat realtime worker", { status: 200 });

    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    const room = env.VYBECHAT_ROOM.getByName(match[1]);
    return room.fetch(request);
  },
};

export class VybeChatRoom {
  constructor(ctx) {
    this.ctx = ctx;
  }

  async fetch() {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.serializeAttachment({
      socketId: crypto.randomUUID(),
      userId: null,
      name: "Visitante",
      status: "offline",
      callChannelId: null,
      isMuted: false,
      isSpeaking: false,
    });
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket, raw) {
    if (typeof raw !== "string") return;
    try {
      const event = JSON.parse(raw);
      if (!event || typeof event.type !== "string") return;
      await this.handleEvent(socket, event.type, event.payload ?? {});
    } catch {
      socket.send(json("realtime:error", { message: "Evento em formato inválido." }));
    }
  }

  webSocketClose(socket, code, reason) {
    this.leaveCall(socket);
    socket.close(code, reason);
    this.broadcastPresence();
  }

  getState(socket) {
    return socket.deserializeAttachment() ?? null;
  }

  setState(socket, patch) {
    const next = { ...this.getState(socket), ...patch };
    socket.serializeAttachment(next);
    return next;
  }

  sockets() {
    return this.ctx.getWebSockets();
  }

  findSocket(socketId) {
    return this.sockets().find(socket => this.getState(socket)?.socketId === socketId);
  }

  broadcast(type, payload, except) {
    const message = json(type, payload);
    for (const socket of this.sockets()) {
      if (socket !== except) socket.send(message);
    }
  }

  users() {
    const byUser = new Map();
    for (const socket of this.sockets()) {
      const state = this.getState(socket);
      if (state?.userId) byUser.set(state.userId, { userId: state.userId, name: state.name, status: state.status });
    }
    return Array.from(byUser.values());
  }

  voiceRooms() {
    const rooms = new Map();
    for (const socket of this.sockets()) {
      const state = this.getState(socket);
      if (!state?.callChannelId) continue;
      const members = rooms.get(state.callChannelId) ?? [];
      members.push({
        socketId: state.socketId,
        userId: state.userId,
        name: state.name,
        status: state.status,
        isMuted: state.isMuted,
        isSpeaking: state.isSpeaking,
      });
      rooms.set(state.callChannelId, members);
    }
    return Array.from(rooms.entries()).map(([channelId, members]) => ({ channelId, members }));
  }

  broadcastPresence() {
    this.broadcast("presence:update", this.users());
    this.broadcast("voice:rooms", this.voiceRooms());
  }

  peers(channelId, exceptSocketId) {
    return this.sockets()
      .map(socket => this.getState(socket))
      .filter(state => state?.callChannelId === channelId && state.socketId !== exceptSocketId)
      .map(state => ({
        socketId: state.socketId,
        userId: state.userId,
        name: state.name,
        status: state.status,
        isMuted: state.isMuted,
        isSpeaking: state.isSpeaking,
      }));
  }

  leaveCall(socket) {
    const state = this.getState(socket);
    if (!state?.callChannelId) return;
    const channelId = state.callChannelId;
    this.setState(socket, { callChannelId: null, isSpeaking: false });
    this.broadcast("call:peer-left", { channelId, socketId: state.socketId }, socket);
    this.broadcast("voice:rooms", this.voiceRooms());
  }

  async handleEvent(socket, type, payload) {
    const state = this.getState(socket);
    if (!state) return;

    if (type === "presence:join") {
      this.setState(socket, {
        userId: String(payload.userId ?? ""),
        name: String(payload.name ?? "Operador Vybe").slice(0, 80),
        status: ["online", "away", "offline"].includes(payload.status) ? payload.status : "online",
      });
      socket.send(json("voice:rooms", this.voiceRooms()));
      this.broadcastPresence();
      return;
    }

    if (type === "presence:status" && ["online", "away", "offline"].includes(payload)) {
      this.setState(socket, { status: payload });
      this.broadcastPresence();
      return;
    }

    if (type === "channel:join" && validChannelId(payload.channelId)) {
      const history = (await this.ctx.storage.get(`messages:${payload.channelId}`)) ?? [];
      socket.send(json("message:history", { channelId: payload.channelId, messages: history }));
      return;
    }

    if (type === "message:new") {
      if (!validChannelId(payload.channelId) || typeof payload.content !== "string" || !payload.content.trim() || !state.userId) return;
      const key = `messages:${payload.channelId}`;
      const history = (await this.ctx.storage.get(key)) ?? [];
      const message = {
        id: crypto.randomUUID(),
        channelId: payload.channelId,
        userId: state.userId,
        authorName: state.name,
        content: payload.content.trim().slice(0, 4000),
        createdAt: new Date().toISOString(),
      };
      const nextHistory = [...history, message].slice(-150);
      await this.ctx.storage.put(key, nextHistory);
      this.broadcast("message:new", { channelId: payload.channelId, message });
      return;
    }

    if (type === "typing") {
      if (validChannelId(payload.channelId)) this.broadcast("typing", { channelId: payload.channelId, name: String(payload.name ?? "").slice(0, 80), active: Boolean(payload.active) }, socket);
      return;
    }

    if (type === "call:join") {
      if (!validChannelId(payload.channelId)) return;
      this.leaveCall(socket);
      const next = this.setState(socket, { callChannelId: payload.channelId, isMuted: false, isSpeaking: false });
      socket.send(json("call:peers", { channelId: payload.channelId, peers: this.peers(payload.channelId, next.socketId) }));
      this.broadcast("call:peer-joined", { channelId: payload.channelId, peer: { socketId: next.socketId, userId: next.userId, name: next.name, status: next.status, isMuted: false, isSpeaking: false } }, socket);
      this.broadcast("voice:rooms", this.voiceRooms());
      return;
    }

    if (type === "call:leave") {
      this.leaveCall(socket);
      return;
    }

    if (type === "call:audio-state" && validChannelId(payload.channelId) && state.callChannelId === payload.channelId) {
      this.setState(socket, { isMuted: Boolean(payload.isMuted), isSpeaking: Boolean(payload.isMuted) ? false : Boolean(payload.isSpeaking) });
      this.broadcast("voice:rooms", this.voiceRooms());
      return;
    }

    if (type === "call:screen-share" && validChannelId(payload.channelId) && state.callChannelId === payload.channelId) {
      this.broadcast("call:screen-share", { channelId: payload.channelId, socketId: payload.active ? state.socketId : null, name: payload.active ? state.name : null });
      return;
    }

    if (["call:offer", "call:answer", "call:ice"].includes(type) && validChannelId(payload.channelId) && typeof payload.to === "string") {
      const target = this.findSocket(payload.to);
      if (!target) return;
      const body = { ...payload, from: state.socketId, user: { userId: state.userId, name: state.name, status: state.status } };
      delete body.to;
      target.send(json(type, body));
    }
  }
}
