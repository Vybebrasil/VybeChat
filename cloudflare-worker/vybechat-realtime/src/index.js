import { canInvite, canManagePermissions, canModerate, canPost, normalizePermissions, normalizeRole } from "./policy.js";

const CHANNEL_IDS = Array.from({ length: 17 }, (_, index) => index + 1);

function json(type, payload) {
  return JSON.stringify({ type, payload });
}

function validChannelId(value) {
  return Number.isInteger(value) && value > 0 && value <= 99;
}

function validStatus(value) {
  return ["online", "away", "offline", "focus", "meeting"].includes(value);
}

function roleForUser(userId) { return userId === "gestaovybe@gmail.com" ? "admin" : "member"; }

function messageKey(channelId) {
  return `messages:${channelId}`;
}

function directThreadId(firstUserId, secondUserId) {
  return `direct:${[firstUserId, secondUserId].sort().join("|")}`;
}

function directMessagesKey(threadId) {
  return `direct:messages:${threadId}`;
}

function directIndexKey(userId) {
  return `direct:index:${userId}`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") return Response.json({ status: "ok", service: "vybechat-realtime" });
    const match = url.pathname.match(/^\/room\/([a-z0-9-]{1,80})$/i);
    if (!match) return new Response("VybeChat realtime worker", { status: 200 });
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response("Expected WebSocket upgrade", { status: 426 });
    return env.VYBECHAT_ROOM.getByName(match[1]).fetch(request);
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
      socketId: crypto.randomUUID(), userId: null, name: "Visitante", status: "offline", statusMessage: "", role: "member",
      callChannelId: null, isMuted: false, isSpeaking: false, handRaised: false,
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

  getState(socket) { return socket.deserializeAttachment() ?? null; }
  setState(socket, patch) {
    const next = { ...this.getState(socket), ...patch };
    socket.serializeAttachment(next);
    return next;
  }
  sockets() { return this.ctx.getWebSockets(); }
  findSocket(socketId) { return this.sockets().find(socket => this.getState(socket)?.socketId === socketId); }
  findUserSocket(userId) { return this.sockets().find(socket => this.getState(socket)?.userId === userId); }

  broadcast(type, payload, except) {
    const message = json(type, payload);
    for (const socket of this.sockets()) if (socket !== except) socket.send(message);
  }

  users() {
    const byUser = new Map();
    for (const socket of this.sockets()) {
      const state = this.getState(socket);
      if (state?.userId) byUser.set(state.userId, { userId: state.userId, name: state.name, status: state.status, statusMessage: state.statusMessage, role: state.role });
    }
    return Array.from(byUser.values());
  }

  voiceRooms() {
    const rooms = new Map();
    for (const socket of this.sockets()) {
      const state = this.getState(socket);
      if (!state?.callChannelId) continue;
      const members = rooms.get(state.callChannelId) ?? [];
      members.push({ socketId: state.socketId, userId: state.userId, name: state.name, status: state.status, isMuted: state.isMuted, isSpeaking: state.isSpeaking, handRaised: Boolean(state.handRaised) });
      rooms.set(state.callChannelId, members);
    }
    return Array.from(rooms.entries()).map(([channelId, members]) => ({ channelId, members }));
  }

  broadcastPresence() {
    this.broadcast("presence:update", this.users());
    this.broadcast("voice:rooms", this.voiceRooms());
  }

  peers(channelId, exceptSocketId) {
    return this.sockets().map(socket => this.getState(socket)).filter(state => state?.callChannelId === channelId && state.socketId !== exceptSocketId)
      .map(state => ({ socketId: state.socketId, userId: state.userId, name: state.name, status: state.status, isMuted: state.isMuted, isSpeaking: state.isSpeaking }));
  }

  leaveCall(socket) {
    const state = this.getState(socket);
    if (!state?.callChannelId) return;
    const channelId = state.callChannelId;
    this.setState(socket, { callChannelId: null, isSpeaking: false });
    this.broadcast("call:peer-left", { channelId, socketId: state.socketId }, socket);
    this.broadcast("voice:rooms", this.voiceRooms());
  }

  async getHistory(channelId) {
    return (await this.ctx.storage.get(messageKey(channelId))) ?? [];
  }

  async putHistory(channelId, history) {
    await this.ctx.storage.put(messageKey(channelId), history.slice(-200));
  }

  async getDirectIndex(userId) {
    return (await this.ctx.storage.get(directIndexKey(userId))) ?? [];
  }

  async putDirectIndex(userId, threads) {
    await this.ctx.storage.put(directIndexKey(userId), threads.sort((first, second) => second.updatedAt.localeCompare(first.updatedAt)).slice(0, 80));
  }

  async handleEvent(socket, type, payload) {
    const state = this.getState(socket);
    if (!state) return;

    if (type === "presence:join") {
      const userId = String(payload.userId ?? "");
      const storedRole = await this.ctx.storage.get(`role:${userId}`);
      this.setState(socket, { userId, name: String(payload.name ?? "Operador Vybe").slice(0, 80), status: validStatus(payload.status) ? payload.status : "online", statusMessage: String(payload.statusMessage ?? "").slice(0, 120), role: userId === "gestaovybe@gmail.com" ? "admin" : normalizeRole(storedRole ?? roleForUser(userId)) });
      socket.send(json("voice:rooms", this.voiceRooms()));
      this.broadcastPresence();
      return;
    }

    if (type === "team:role:update" && typeof payload.userId === "string") {
      if (!canManagePermissions(state.role)) return socket.send(json("realtime:error", { message: "Apenas administradores podem alterar papéis." }));
      const role = normalizeRole(payload.role);
      await this.ctx.storage.put(`role:${payload.userId}`, role);
      const target = this.findUserSocket(payload.userId);
      if (target) this.setState(target, { role });
      this.broadcastPresence();
      return;
    }

    if (type === "presence:status" && validStatus(payload.status)) {
      this.setState(socket, { status: payload.status, statusMessage: String(payload.statusMessage ?? "").slice(0, 120) });
      this.broadcastPresence();
      return;
    }

    if (type === "channel:join" && validChannelId(payload.channelId)) {
      const history = await this.getHistory(payload.channelId);
      socket.send(json("message:history", { channelId: payload.channelId, messages: history }));
      socket.send(json("message:pins", { channelId: payload.channelId, pinnedIds: (await this.ctx.storage.get(`pins:${payload.channelId}`)) ?? [] }));
      socket.send(json("channel:permissions", { channelId: payload.channelId, permissions: normalizePermissions((await this.ctx.storage.get(`permissions:${payload.channelId}`)) ?? {}) }));
      return;
    }

    if (type === "channel:permissions:update" && validChannelId(payload.channelId)) {
      if (!canManagePermissions(state.role)) return socket.send(json("realtime:error", { message: "Apenas administradores podem alterar permissões da sala." }));
      const permissions = normalizePermissions(payload);
      await this.ctx.storage.put(`permissions:${payload.channelId}`, permissions);
      this.broadcast("channel:permissions", { channelId: payload.channelId, permissions });
      return;
    }

    if (type === "direct:list" && state.userId) {
      socket.send(json("direct:list", { threads: await this.getDirectIndex(state.userId) }));
      return;
    }

    if (type === "direct:history" && state.userId && typeof payload.peerUserId === "string" && payload.peerUserId) {
      const threadId = directThreadId(state.userId, payload.peerUserId);
      const messages = (await this.ctx.storage.get(directMessagesKey(threadId))) ?? [];
      socket.send(json("direct:history", { threadId, peerUserId: payload.peerUserId, messages }));
      return;
    }

    if (type === "direct:new" && state.userId && typeof payload.toUserId === "string" && typeof payload.content === "string") {
      const toUserId = payload.toUserId;
      const content = payload.content.trim().slice(0, 4000);
      if (!toUserId || toUserId === state.userId || !content) return;
      const target = this.findUserSocket(toUserId);
      const targetState = target ? this.getState(target) : null;
      const targetName = String(payload.toName ?? targetState?.name ?? "Integrante Vybe").slice(0, 80);
      const threadId = directThreadId(state.userId, toUserId);
      const history = (await this.ctx.storage.get(directMessagesKey(threadId))) ?? [];
      const message = { id: crypto.randomUUID(), threadId, userId: state.userId, authorName: state.name, toUserId, content, createdAt: new Date().toISOString(), readBy: [state.userId] };
      await this.ctx.storage.put(directMessagesKey(threadId), [...history, message].slice(-200));
      const senderThread = { id: threadId, peerUserId: toUserId, peerName: targetName, lastMessage: content, updatedAt: message.createdAt, unreadCount: 0 };
      const recipientThread = { id: threadId, peerUserId: state.userId, peerName: state.name, lastMessage: content, updatedAt: message.createdAt, unreadCount: 0 };
      const senderIndex = await this.getDirectIndex(state.userId);
      await this.putDirectIndex(state.userId, [...senderIndex.filter(item => item.id !== threadId), senderThread]);
      const recipientIndex = await this.getDirectIndex(toUserId);
      const previousRecipientThread = recipientIndex.find(item => item.id === threadId);
      const unreadCount = (previousRecipientThread?.unreadCount ?? 0) + 1;
      const recipientUpdate = { ...recipientThread, unreadCount };
      await this.putDirectIndex(toUserId, [...recipientIndex.filter(item => item.id !== threadId), recipientUpdate]);
      socket.send(json("direct:new", { thread: senderThread, message }));
      if (target) target.send(json("direct:new", { thread: recipientUpdate, message }));
      return;
    }

    if (type === "direct:read" && state.userId && typeof payload.peerUserId === "string" && payload.peerUserId) {
      const threadId = directThreadId(state.userId, payload.peerUserId);
      const index = await this.getDirectIndex(state.userId);
      const thread = index.find(item => item.id === threadId);
      if (!thread) return;
      const updated = { ...thread, unreadCount: 0 };
      await this.putDirectIndex(state.userId, [...index.filter(item => item.id !== threadId), updated]);
      socket.send(json("direct:read", { thread: updated }));
      return;
    }

    if (type === "message:new") {
      if (!validChannelId(payload.channelId) || typeof payload.content !== "string" || !payload.content.trim() || !state.userId) return;
      const channelId = payload.channelId;
      const permissions = normalizePermissions((await this.ctx.storage.get(`permissions:${channelId}`)) ?? {});
      if (!canPost(state.role, permissions)) return socket.send(json("realtime:error", { message: "Este canal está em modo somente leitura." }));
      const history = await this.getHistory(channelId);
      const parentId = typeof payload.parentId === "string" && history.some(message => message.id === payload.parentId) ? payload.parentId : null;
      const message = { id: crypto.randomUUID(), channelId, userId: state.userId, authorName: state.name, content: payload.content.trim().slice(0, 4000), createdAt: new Date().toISOString(), parentId, reactions: {} };
      await this.putHistory(channelId, [...history, message]);
      this.broadcast("message:new", { channelId, message });
      return;
    }

    if (type === "message:reaction") {
      if (!validChannelId(payload.channelId) || typeof payload.messageId !== "string" || typeof payload.emoji !== "string" || !state.userId) return;
      const emoji = payload.emoji.slice(0, 16);
      const history = await this.getHistory(payload.channelId);
      const message = history.find(item => item.id === payload.messageId);
      if (!message) return;
      const reactions = { ...(message.reactions ?? {}) };
      const users = new Set(reactions[emoji] ?? []);
      if (users.has(state.userId)) users.delete(state.userId); else users.add(state.userId);
      if (users.size) reactions[emoji] = Array.from(users); else delete reactions[emoji];
      message.reactions = reactions;
      await this.putHistory(payload.channelId, history);
      this.broadcast("message:update", { channelId: payload.channelId, message });
      return;
    }

    if (type === "message:pin") {
      if (!validChannelId(payload.channelId) || typeof payload.messageId !== "string") return;
      if (!canModerate(state.role)) return socket.send(json("realtime:error", { message: "Apenas moderadores podem fixar decisões." }));
      const history = await this.getHistory(payload.channelId);
      if (!history.some(message => message.id === payload.messageId)) return;
      const key = `pins:${payload.channelId}`;
      const pins = new Set((await this.ctx.storage.get(key)) ?? []);
      if (pins.has(payload.messageId)) pins.delete(payload.messageId); else pins.add(payload.messageId);
      const pinnedIds = Array.from(pins).slice(-25);
      await this.ctx.storage.put(key, pinnedIds);
      this.broadcast("message:pins", { channelId: payload.channelId, pinnedIds });
      return;
    }

    if (type === "message:search" && typeof payload.query === "string") {
      const query = payload.query.trim().toLocaleLowerCase();
      if (!query) return socket.send(json("message:search-results", { query: "", results: [] }));
      const channels = validChannelId(payload.channelId) ? [payload.channelId] : CHANNEL_IDS;
      const results = [];
      for (const channelId of channels) {
        const history = await this.getHistory(channelId);
        results.push(...history.filter(message => `${message.authorName} ${message.content}`.toLocaleLowerCase().includes(query)).slice(-20));
      }
      socket.send(json("message:search-results", { query, results: results.slice(-40).reverse() }));
      return;
    }

    if (type === "typing" && validChannelId(payload.channelId)) {
      this.broadcast("typing", { channelId: payload.channelId, name: state.name, active: Boolean(payload.active) }, socket);
      return;
    }

    if (type === "call:invite" && validChannelId(payload.channelId) && typeof payload.userId === "string") {
      const permissions = normalizePermissions((await this.ctx.storage.get(`permissions:${payload.channelId}`)) ?? {});
      if (!canInvite(state.role, permissions)) return socket.send(json("realtime:error", { message: "Apenas administradores podem convidar para esta sala." }));
      const target = this.findUserSocket(payload.userId);
      if (target) target.send(json("call:invite", { channelId: payload.channelId, from: { userId: state.userId, name: state.name } }));
      return;
    }

    if (type === "call:join") {
      if (!validChannelId(payload.channelId)) return;
      this.leaveCall(socket);
      const next = this.setState(socket, { callChannelId: payload.channelId, isMuted: false, isSpeaking: false, handRaised: false });
      socket.send(json("call:peers", { channelId: payload.channelId, peers: this.peers(payload.channelId, next.socketId) }));
      this.broadcast("call:peer-joined", { channelId: payload.channelId, peer: { socketId: next.socketId, userId: next.userId, name: next.name, status: next.status, isMuted: false, isSpeaking: false } }, socket);
      this.broadcast("voice:rooms", this.voiceRooms());
      return;
    }

    if (type === "call:leave") { this.leaveCall(socket); return; }
    if (type === "call:audio-state" && validChannelId(payload.channelId) && state.callChannelId === payload.channelId) {
      this.setState(socket, { isMuted: Boolean(payload.isMuted), isSpeaking: Boolean(payload.isMuted) ? false : Boolean(payload.isSpeaking) });
      this.broadcast("voice:rooms", this.voiceRooms());
      return;
    }
    if (type === "call:hand-raise" && validChannelId(payload.channelId) && state.callChannelId === payload.channelId) {
      this.setState(socket, { handRaised: Boolean(payload.active) });
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
