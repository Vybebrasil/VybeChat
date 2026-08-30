import {
  canInvite,
  canManagePermissions,
  canModerate,
  canPost,
  normalizePermissions,
  normalizeRole,
} from "./policy.js";
import { loadRoster, MONDAY_PREFIX, parseIdList } from "./roster.js";
import {
  collectChannelIds,
  DEFAULT_WORKSPACE,
  loadWorkspace,
  sanitizeWorkspace,
  WORKSPACE_KEY,
} from "./workspace.js";

function json(type, payload) {
  return JSON.stringify({ type, payload });
}

// Antes qualquer id ate 99 era gravavel, mas a busca so varria uma faixa fixa:
// dava para escrever em canais fantasma que a interface nunca mostra. Agora os
// ids validos vem da estrutura de canais, que e editavel.

function validStatus(value) {
  return ["online", "away", "offline", "focus", "meeting"].includes(value);
}

function adminSlugs(env) {
  return String(env?.VYBECHAT_ADMIN_SLUGS ?? "")
    .split(",")
    .map(slug => slug.trim().toLocaleLowerCase())
    .filter(Boolean);
}

// O cliente monta o userId como `${slug-do-nome}-${timestamp}-${aleatorio}`.
// Comparar o id inteiro nunca casa, entao conferimos apenas o prefixo do slug.
function roleForUser(userId, env) {
  const raw = String(userId ?? "");
  // Quem entra pelo seletor do Monday tem id estavel: comparamos o id exato em
  // vez de adivinhar pelo nome digitado.
  if (raw.startsWith(MONDAY_PREFIX)) {
    const mondayId = raw.slice(MONDAY_PREFIX.length);
    return parseIdList(env?.VYBECHAT_ADMIN_MONDAY_IDS).includes(mondayId)
      ? "admin"
      : "member";
  }
  const id = raw.toLocaleLowerCase();
  return adminSlugs(env).some(slug => id === slug || id.startsWith(`${slug}-`))
    ? "admin"
    : "member";
}

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

const DECISIONS_KEY = "team:decisions";
const REALTIMEKIT_MEETING_PREFIX = "realtimekit:meeting:";
const MUSIC_KEY_PREFIX = "music:channel:";
const MUSIC_QUEUE_LIMIT = 50;

function musicKey(channelId) {
  return `${MUSIC_KEY_PREFIX}${channelId}`;
}

function validYouTubeId(value, minimumLength, maximumLength) {
  return (
    typeof value === "string" &&
    value.length >= minimumLength &&
    value.length <= maximumLength &&
    /^[a-zA-Z0-9_-]+$/.test(value)
  );
}

function sanitizeMusicSource(value, state) {
  if (!value || typeof value !== "object") return null;
  if (value.kind === "video" && validYouTubeId(value.videoId, 11, 11)) {
    return {
      id: crypto.randomUUID(),
      kind: "video",
      videoId: value.videoId,
      url: `https://www.youtube.com/watch?v=${value.videoId}`,
      addedBy: { userId: state.userId, name: state.name },
      addedAt: new Date().toISOString(),
    };
  }
  if (value.kind === "playlist" && validYouTubeId(value.playlistId, 10, 80)) {
    return {
      id: crypto.randomUUID(),
      kind: "playlist",
      playlistId: value.playlistId,
      url: `https://www.youtube.com/playlist?list=${value.playlistId}`,
      addedBy: { userId: state.userId, name: state.name },
      addedAt: new Date().toISOString(),
    };
  }
  return null;
}

function emptyMusicState(channelId) {
  return {
    channelId,
    queue: [],
    queueIndex: -1,
    playlistIndex: 0,
    playing: false,
    positionSeconds: 0,
    updatedAt: Date.now(),
    revision: 0,
    djUserId: null,
    djName: null,
    updatedBy: null,
  };
}

function normalizeMusicState(value, channelId) {
  if (!value || typeof value !== "object") return emptyMusicState(channelId);
  const queue = Array.isArray(value.queue)
    ? value.queue
        .filter(
          item =>
            item &&
            typeof item === "object" &&
            typeof item.id === "string" &&
            (item.kind === "video" || item.kind === "playlist")
        )
        .slice(0, MUSIC_QUEUE_LIMIT)
    : [];
  const queueIndex = queue.length
    ? Math.min(
        Math.max(Number.isInteger(value.queueIndex) ? value.queueIndex : 0, 0),
        queue.length - 1
      )
    : -1;
  return {
    channelId,
    queue,
    queueIndex,
    playlistIndex: Math.max(
      0,
      Number.isInteger(value.playlistIndex) ? value.playlistIndex : 0
    ),
    playing: Boolean(value.playing && queue.length),
    positionSeconds: Number.isFinite(value.positionSeconds)
      ? Math.min(Math.max(value.positionSeconds, 0), 86_400)
      : 0,
    updatedAt: Number.isFinite(value.updatedAt) ? value.updatedAt : Date.now(),
    revision: Math.max(
      0,
      Number.isInteger(value.revision) ? value.revision : 0
    ),
    djUserId: typeof value.djUserId === "string" ? value.djUserId : null,
    djName: typeof value.djName === "string" ? value.djName : null,
    updatedBy:
      value.updatedBy && typeof value.updatedBy === "object"
        ? value.updatedBy
        : null,
  };
}

function musicPosition(value) {
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 86_400) : 0;
}

function effectiveMusicPosition(musicState, now = Date.now()) {
  if (!musicState.playing) return musicPosition(musicState.positionSeconds);
  return musicPosition(
    musicState.positionSeconds + Math.max(0, now - musicState.updatedAt) / 1000
  );
}

class RealtimeKitApiError extends Error {
  constructor(message, status, code = "realtimekit_api_error") {
    super(message);
    this.name = "RealtimeKitApiError";
    this.status = status;
    this.code = code;
  }
}

function realtimeKitConfig(env) {
  const accountId = String(env?.CLOUDFLARE_ACCOUNT_ID ?? "").trim();
  const appId = String(env?.REALTIMEKIT_APP_ID ?? "").trim();
  const apiToken = String(env?.CLOUDFLARE_REALTIME_API_TOKEN ?? "").trim();
  const presetName = String(
    env?.REALTIMEKIT_PRESET_NAME ?? "group-call-host"
  ).trim();
  return {
    accountId,
    appId,
    apiToken,
    presetName,
    ready: Boolean(accountId && appId && apiToken && presetName),
  };
}

async function realtimeKitRequest(env, pathname, init = {}) {
  const config = realtimeKitConfig(env);
  if (!config.ready) {
    throw new RealtimeKitApiError(
      "O RealtimeKit ainda não foi configurado no Worker.",
      503,
      "realtimekit_unconfigured"
    );
  }
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId)}/realtime/kit/${encodeURIComponent(config.appId)}${pathname}`,
    {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiToken}`,
        ...(init.headers ?? {}),
      },
    }
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    const detail =
      payload?.errors?.[0]?.message ||
      payload?.messages?.[0]?.message ||
      "A Cloudflare não conseguiu preparar a chamada.";
    throw new RealtimeKitApiError(detail, response.status || 502);
  }
  if (!payload?.data)
    throw new RealtimeKitApiError(
      "A Cloudflare devolveu uma resposta de chamada inválida.",
      502
    );
  return payload.data;
}

// O /roster e chamado pelo navegador de outra origem (Pages -> workers.dev),
// entao precisa de CORS. Sem isso a tela de entrada nem consegue perguntar.
function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  const configuradas = String(env?.VYBECHAT_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
  if (configuradas.length) return configuradas.includes(origin) ? origin : null;
  try {
    const { hostname, protocol } = new URL(origin);
    if (hostname === "localhost" || hostname === "127.0.0.1") return origin;
    if (protocol === "https:" && hostname.endsWith(".pages.dev")) return origin;
  } catch {
    return null;
  }
  return null;
}

function withCors(response, origin) {
  if (!origin) return response;
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Vary", "Origin");
  return new Response(response.body, { status: response.status, headers });
}

// Comparacao de tempo constante: evita descobrir o codigo medindo o tempo de resposta.
function timingSafeEqual(candidate, expected) {
  const a = String(candidate);
  const b = String(expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1)
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}
// Deployment marker: workspace access validation is enabled in the current realtime revision.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health")
      return Response.json({
        status: "ok",
        service: "vybechat-realtime",
        callEngine: realtimeKitConfig(env).ready ? "realtimekit" : "legacy",
      });
    if (url.pathname === "/calls/session") {
      const origin = allowedOrigin(request, env);
      if (request.method === "OPTIONS") {
        if (!origin) return new Response(null, { status: 403 });
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Max-Age": "86400",
            Vary: "Origin",
          },
        });
      }
      if (request.method !== "POST")
        return withCors(
          new Response("Method not allowed", { status: 405 }),
          origin
        );
      const response =
        await env.VYBECHAT_ROOM.getByName(url.searchParams.get("room") || "vybe-os").fetch(request);
      return withCors(response, origin);
    }
    if (url.pathname === "/roster") {
      const origin = allowedOrigin(request, env);
      if (request.method === "OPTIONS") {
        if (!origin) return new Response(null, { status: 403 });
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Max-Age": "86400",
            Vary: "Origin",
          },
        });
      }
      if (request.method !== "POST")
        return withCors(
          new Response("Method not allowed", { status: 405 }),
          origin
        );
      const response =
        await env.VYBECHAT_ROOM.getByName(url.searchParams.get("room") || "vybe-os").fetch(request);
      return withCors(response, origin);
    }
    const match = url.pathname.match(/^\/room\/([a-z0-9-]{1,80})$/i);
    if (!match)
      return new Response("VybeChat realtime worker", { status: 200 });
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket")
      return new Response("Expected WebSocket upgrade", { status: 426 });
    return env.VYBECHAT_ROOM.getByName(match[1]).fetch(request);
  },
};

export class VybeChatRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    // Por instancia, e nao no modulo: um mesmo isolate pode atender salas
    // diferentes, e um teste contaminava o seguinte.
    this.channelIds = collectChannelIds(DEFAULT_WORKSPACE);
    this.meetingCreationPromises = new Map();
  }

  validChannelId(value) {
    return Number.isInteger(value) && this.channelIds.has(value);
  }

  async fetch(request) {
    if (request) {
      const url = new URL(request.url);
      const pathname = url.pathname;
      this.isGaming = pathname.includes("gaming") || (url.searchParams.get("room") || "").includes("gaming");
      if (pathname === "/roster") return this.handleRoster(request);
      if (pathname === "/calls/session") return this.handleCallSession(request);
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.serializeAttachment({
      socketId: crypto.randomUUID(),
      userId: null,
      name: "Visitante",
      status: "offline",
      statusMessage: "",
      role: "member",
      callChannelId: null,
      callEngine: null,
      isMuted: false,
      isSpeaking: false,
      handRaised: false,
    });
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Entrega a equipe para a tela de entrada. Exige o codigo de acesso: sem ele
   * a lista com nomes e fotos ficaria aberta para qualquer um com a URL.
   */
  async handleRoster(request) {
    const expected = this.env?.VYBECHAT_WORKSPACE_CODE;
    let body = {};
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Requisicao invalida." }, { status: 400 });
    }
    if (
      !this.isGaming && (!expected ||
      !(timingSafeEqual(String(body.workspaceCode ?? ""), expected) || timingSafeEqual(String(body.workspaceCode ?? ""), expected + "-gaming")))
    ) {
      return Response.json(
        { error: "O código de acesso da equipe não foi aceito.", code: "auth" },
        { status: 401 }
      );
    }
    try {
      const { team } = await loadRoster({
        storage: this.ctx.storage,
        token: this.env?.MONDAY_API_TOKEN,
        allowedIds: parseIdList(this.env?.VYBECHAT_TEAM_MONDAY_IDS),
        ...(this.env?.MONDAY_API_VERSION
          ? { apiVersion: this.env.MONDAY_API_VERSION }
          : {}),
      });
      return Response.json({ team });
    } catch (error) {
      // O codigo ja foi aceito: devolvemos lista vazia para a tela cair no
      // campo de nome em vez de barrar quem tem acesso legitimo.
      console.warn("[VybeChat] roster indisponivel", error);
      return Response.json({ team: [], degraded: true });
    }
  }

  async getOrCreateRealtimeKitMeeting(channelId, roomName) {
    const key = `${REALTIMEKIT_MEETING_PREFIX}${channelId}`;
    const stored = await this.ctx.storage.get(key);
    if (typeof stored === "string" && stored) return stored;

    const inFlight = this.meetingCreationPromises.get(channelId);
    if (inFlight) return inFlight;

    const creation = (async () => {
      const meeting = await realtimeKitRequest(this.env, "/meetings", {
        method: "POST",
        body: JSON.stringify({
          title: `VybeChat — ${String(roomName || `Sala ${channelId}`).slice(0, 180)}`,
          persist_chat: false,
          record_on_start: false,
        }),
      });
      if (typeof meeting.id !== "string" || !meeting.id)
        throw new RealtimeKitApiError(
          "A reunião foi criada sem identificador.",
          502
        );
      await this.ctx.storage.put(key, meeting.id);
      return meeting.id;
    })();
    this.meetingCreationPromises.set(channelId, creation);
    try {
      return await creation;
    } finally {
      this.meetingCreationPromises.delete(channelId);
    }
  }

  async handleCallSession(request) {
    let body = {};
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: "Requisição de chamada inválida.", code: "invalid_request" },
        { status: 400 }
      );
    }

    const expected = this.env?.VYBECHAT_WORKSPACE_CODE;
    if (
      !this.isGaming && (!expected ||
      !(timingSafeEqual(String(body.workspaceCode ?? ""), expected) || timingSafeEqual(String(body.workspaceCode ?? ""), expected + "-gaming")))
    ) {
      return Response.json(
        { error: "O código de acesso da equipe não foi aceito.", code: "auth" },
        { status: 401 }
      );
    }

    const workspace = await loadWorkspace(this.ctx.storage, this.isGaming);
    this.channelIds = collectChannelIds(workspace);
    const channelId = Number(body.channelId);
    const userId = String(body.userId ?? "").slice(0, 120);
    const name = String(body.name ?? "")
      .trim()
      .slice(0, 80);
    const photo = String(body.photo ?? "")
      .trim()
      .slice(0, 400);
    if (!this.validChannelId(channelId) || !userId || !name) {
      return Response.json(
        { error: "Sala ou participante inválido.", code: "invalid_request" },
        { status: 400 }
      );
    }

    try {
      const meetingId = await this.getOrCreateRealtimeKitMeeting(
        channelId,
        body.roomName
      );
      const participant = await realtimeKitRequest(
        this.env,
        `/meetings/${encodeURIComponent(meetingId)}/participants`,
        {
          method: "POST",
          body: JSON.stringify({
            name,
            preset_name: realtimeKitConfig(this.env).presetName,
            custom_participant_id: `${userId}:${crypto.randomUUID()}`,
            ...(photo.startsWith("https://") ? { picture: photo } : {}),
          }),
        }
      );
      if (
        typeof participant.id !== "string" ||
        typeof participant.token !== "string" ||
        !participant.id ||
        !participant.token
      ) {
        throw new RealtimeKitApiError(
          "A Cloudflare criou um participante sem token de chamada.",
          502
        );
      }
      return Response.json({
        engine: "realtimekit",
        meetingId,
        participantId: participant.id,
        authToken: participant.token,
      });
    } catch (error) {
      const status = error instanceof RealtimeKitApiError ? error.status : 502;
      const code =
        error instanceof RealtimeKitApiError
          ? error.code
          : "realtimekit_api_error";
      if (code !== "realtimekit_unconfigured") {
        console.error("[VybeChat] falha ao preparar sessão RealtimeKit", {
          channelId,
          error: String(error?.message ?? error),
        });
      }
      return Response.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Não foi possível preparar a chamada.",
          code,
        },
        { status }
      );
    }
  }

  async webSocketMessage(socket, raw) {
    if (typeof raw !== "string") return;
    try {
      const event = JSON.parse(raw);
      if (!event || typeof event.type !== "string") return;
      await this.handleEvent(socket, event.type, event.payload ?? {});
    } catch {
      socket.send(
        json("realtime:error", { message: "Evento em formato inválido." })
      );
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
    return this.sockets().find(
      socket => this.getState(socket)?.socketId === socketId
    );
  }
  findUserSocket(userId) {
    return this.sockets().find(
      socket => this.getState(socket)?.userId === userId
    );
  }

  broadcast(type, payload, except) {
    const message = json(type, payload);
    for (const socket of this.sockets())
      if (socket !== except) socket.send(message);
  }

  // Eventos de chamada so interessam a quem esta na mesma sala de voz. Antes iam
  // para todo mundo e o cliente descartava; com a equipe inteira online isso e
  // trafego inutil multiplicado por participante.
  broadcastToCall(channelId, type, payload, except, callEngine = null) {
    const message = json(type, payload);
    for (const socket of this.sockets()) {
      if (socket === except) continue;
      const state = this.getState(socket);
      if (state?.callChannelId !== channelId) continue;
      if (callEngine && (state.callEngine ?? "legacy") !== callEngine) continue;
      socket.send(message);
    }
  }

  isUserInCall(userId, channelId) {
    return this.sockets().some(socket => {
      const state = this.getState(socket);
      return state?.userId === userId && state.callChannelId === channelId;
    });
  }

  async getMusicState(channelId) {
    return normalizeMusicState(
      await this.ctx.storage.get(musicKey(channelId)),
      channelId
    );
  }

  async putMusicState(channelId, musicState) {
    await this.ctx.storage.put(musicKey(channelId), musicState);
  }

  sendMusicState(socket, channelId, musicState) {
    socket.send(json("music:state", { channelId, state: musicState }));
  }

  broadcastMusicState(channelId, musicState) {
    this.broadcastToCall(channelId, "music:state", {
      channelId,
      state: musicState,
    });
  }

  users() {
    const byUser = new Map();
    for (const socket of this.sockets()) {
      const state = this.getState(socket);
      if (state?.userId)
        byUser.set(state.userId, {
          userId: state.userId,
          name: state.name,
          photo: state.photo ?? "",
          status: state.status,
          statusMessage: state.statusMessage,
          role: state.role,
        });
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
        photo: state.photo ?? "",
        status: state.status,
        isMuted: state.isMuted,
        isSpeaking: state.isSpeaking,
        handRaised: Boolean(state.handRaised),
        callEngine: state.callEngine ?? "legacy",
      });
      rooms.set(state.callChannelId, members);
    }
    return Array.from(rooms.entries()).map(([channelId, members]) => ({
      channelId,
      members,
    }));
  }

  broadcastPresence() {
    this.broadcast("presence:update", this.users());
    this.broadcast("voice:rooms", this.voiceRooms());
  }

  peers(channelId, exceptSocketId, callEngine = "legacy") {
    return this.sockets()
      .map(socket => this.getState(socket))
      .filter(
        state =>
          state?.callChannelId === channelId &&
          state.socketId !== exceptSocketId &&
          (state.callEngine ?? "legacy") === callEngine
      )
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
    const callEngine = state.callEngine ?? "legacy";
    this.setState(socket, {
      callChannelId: null,
      callEngine: null,
      isSpeaking: false,
    });
    if (callEngine === "legacy")
      this.broadcastToCall(
        channelId,
        "call:peer-left",
        { channelId, socketId: state.socketId },
        socket,
        callEngine
      );
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
    await this.ctx.storage.put(
      directIndexKey(userId),
      threads
        .sort((first, second) =>
          second.updatedAt.localeCompare(first.updatedAt)
        )
        .slice(0, 80)
    );
  }

  async getDecisions() {
    return (await this.ctx.storage.get(DECISIONS_KEY)) ?? [];
  }

  async putDecisions(decisions) {
    await this.ctx.storage.put(DECISIONS_KEY, decisions.slice(0, 100));
  }

  async handleEvent(socket, type, payload) {
    const state = this.getState(socket);
    if (!state) return;

    // Portao de autenticacao. Antes de um presence:join valido a conexao nao le
    // nem escreve nada: sem historico, sem presenca, sem sinalizacao de chamada.
    if (type !== "presence:join" && !state.userId) {
      socket.send(
        json("realtime:error", {
          code: "auth",
          message: "Sessão não autenticada. Entre novamente no VybeChat.",
        })
      );
      return;
    }

    if (type === "system:ping") {
      socket.send(json("system:pong", { at: Date.now() }));
      return;
    }

    if (type === "presence:join") {
      const userId = String(payload.userId ?? "").slice(0, 120);
      const workspaceCode = this.env?.VYBECHAT_WORKSPACE_CODE;
      // Fail-closed: sem o secret configurado ninguem entra, em vez de liberar a sala inteira.
      if (!workspaceCode) {
        socket.send(
          json("realtime:error", {
            code: "auth",
            message:
              "O VybeChat ainda não foi liberado. Configure o código de acesso da equipe no Worker.",
          })
        );
        return;
      }
      if (
        !this.isGaming &&
        !(timingSafeEqual(String(payload.workspaceCode ?? ""), workspaceCode) || timingSafeEqual(String(payload.workspaceCode ?? ""), workspaceCode + "-gaming"))
      ) {
        socket.send(
          json("realtime:error", {
            code: "auth",
            message: "O código de acesso da equipe não foi aceito.",
          })
        );
        return;
      }
      if (!userId) {
        socket.send(
          json("realtime:error", {
            code: "auth",
            message:
              "Não foi possível identificar o seu perfil. Entre novamente.",
          })
        );
        return;
      }
      const storedRole = await this.ctx.storage.get(`role:${userId}`);
      this.setState(socket, {
        userId,
        name: String(payload.name ?? "Operador Vybe").slice(0, 80),
        photo: String(payload.photo ?? "").slice(0, 400),
        status: validStatus(payload.status) ? payload.status : "online",
        statusMessage: String(payload.statusMessage ?? "").slice(0, 120),
        role: normalizeRole(storedRole ?? roleForUser(userId, this.env)),
      });
      // O cliente precisa do proprio socketId para resolver colisao de ofertas
      // na chamada sem trocar mensagem extra entre os pares.
      this.channelIds = collectChannelIds(
        await loadWorkspace(this.ctx.storage, this.isGaming)
      );
      socket.send(json("session:ready", { socketId: state.socketId }));
      socket.send(json("voice:rooms", this.voiceRooms()));
      this.broadcastPresence();
      return;
    }

    if (type === "team:role:update" && typeof payload.userId === "string") {
      if (!canManagePermissions(state.role))
        return socket.send(
          json("realtime:error", {
            message: "Apenas administradores podem alterar papéis.",
          })
        );
      const role = normalizeRole(payload.role);
      await this.ctx.storage.put(`role:${payload.userId}`, role);
      const target = this.findUserSocket(payload.userId);
      if (target) this.setState(target, { role });
      this.broadcastPresence();
      return;
    }

    if (type === "presence:status" && validStatus(payload.status)) {
      this.setState(socket, {
        status: payload.status,
        statusMessage: String(payload.statusMessage ?? "").slice(0, 120),
      });
      this.broadcastPresence();
      return;
    }

    if (type === "channel:join" && this.validChannelId(payload.channelId)) {
      const history = await this.getHistory(payload.channelId);
      socket.send(
        json("message:history", {
          channelId: payload.channelId,
          messages: history,
        })
      );
      socket.send(
        json("message:pins", {
          channelId: payload.channelId,
          pinnedIds:
            (await this.ctx.storage.get(`pins:${payload.channelId}`)) ?? [],
        })
      );
      socket.send(
        json("channel:permissions", {
          channelId: payload.channelId,
          permissions: normalizePermissions(
            (await this.ctx.storage.get(`permissions:${payload.channelId}`)) ??
              {}
          ),
        })
      );
      return;
    }

    if (
      type === "channel:permissions:update" &&
      this.validChannelId(payload.channelId)
    ) {
      if (!canManagePermissions(state.role))
        return socket.send(
          json("realtime:error", {
            message: "Apenas administradores podem alterar permissões da sala.",
          })
        );
      const permissions = normalizePermissions(payload);
      await this.ctx.storage.put(
        `permissions:${payload.channelId}`,
        permissions
      );
      this.broadcast("channel:permissions", {
        channelId: payload.channelId,
        permissions,
      });
      return;
    }

    if (type === "direct:list" && state.userId) {
      socket.send(
        json("direct:list", {
          threads: await this.getDirectIndex(state.userId),
        })
      );
      return;
    }

    if (
      type === "direct:history" &&
      state.userId &&
      typeof payload.peerUserId === "string" &&
      payload.peerUserId
    ) {
      const threadId = directThreadId(state.userId, payload.peerUserId);
      const messages =
        (await this.ctx.storage.get(directMessagesKey(threadId))) ?? [];
      socket.send(
        json("direct:history", {
          threadId,
          peerUserId: payload.peerUserId,
          messages,
        })
      );
      return;
    }

    if (
      type === "direct:new" &&
      state.userId &&
      typeof payload.toUserId === "string" &&
      typeof payload.content === "string"
    ) {
      const toUserId = payload.toUserId;
      const content = payload.content.trim().slice(0, 4000);
      if (!toUserId || toUserId === state.userId || !content) return;
      const target = this.findUserSocket(toUserId);
      const targetState = target ? this.getState(target) : null;
      const targetName = String(
        payload.toName ?? targetState?.name ?? "Integrante Vybe"
      ).slice(0, 80);
      const threadId = directThreadId(state.userId, toUserId);
      const history =
        (await this.ctx.storage.get(directMessagesKey(threadId))) ?? [];
      const message = {
        id: crypto.randomUUID(),
        threadId,
        userId: state.userId,
        authorName: state.name,
        toUserId,
        content,
        createdAt: new Date().toISOString(),
        readBy: [state.userId],
      };
      await this.ctx.storage.put(
        directMessagesKey(threadId),
        [...history, message].slice(-200)
      );
      const senderThread = {
        id: threadId,
        peerUserId: toUserId,
        peerName: targetName,
        lastMessage: content,
        updatedAt: message.createdAt,
        unreadCount: 0,
      };
      const recipientThread = {
        id: threadId,
        peerUserId: state.userId,
        peerName: state.name,
        lastMessage: content,
        updatedAt: message.createdAt,
        unreadCount: 0,
      };
      const senderIndex = await this.getDirectIndex(state.userId);
      await this.putDirectIndex(state.userId, [
        ...senderIndex.filter(item => item.id !== threadId),
        senderThread,
      ]);
      const recipientIndex = await this.getDirectIndex(toUserId);
      const previousRecipientThread = recipientIndex.find(
        item => item.id === threadId
      );
      const unreadCount = (previousRecipientThread?.unreadCount ?? 0) + 1;
      const recipientUpdate = { ...recipientThread, unreadCount };
      await this.putDirectIndex(toUserId, [
        ...recipientIndex.filter(item => item.id !== threadId),
        recipientUpdate,
      ]);
      socket.send(json("direct:new", { thread: senderThread, message }));
      if (target)
        target.send(json("direct:new", { thread: recipientUpdate, message }));
      return;
    }

    if (
      type === "direct:read" &&
      state.userId &&
      typeof payload.peerUserId === "string" &&
      payload.peerUserId
    ) {
      const threadId = directThreadId(state.userId, payload.peerUserId);
      const index = await this.getDirectIndex(state.userId);
      const thread = index.find(item => item.id === threadId);
      if (!thread) return;
      const updated = { ...thread, unreadCount: 0 };
      await this.putDirectIndex(state.userId, [
        ...index.filter(item => item.id !== threadId),
        updated,
      ]);
      socket.send(json("direct:read", { thread: updated }));
      return;
    }

    if (type === "workspace:list") {
      const workspace = await loadWorkspace(this.ctx.storage, this.isGaming);
      this.channelIds = collectChannelIds(workspace);
      socket.send(json("workspace:list", { workspace }));
      return;
    }

    if (type === "workspace:update") {
      if (!canManagePermissions(state.role)) {
        return socket.send(
          json("realtime:error", {
            message: "Apenas administradores podem alterar os canais.",
          })
        );
      }
      const workspace = sanitizeWorkspace(payload.workspace);
      if (!workspace) {
        return socket.send(
          json("realtime:error", { message: "Estrutura de canais inválida." })
        );
      }
      await this.ctx.storage.put(WORKSPACE_KEY, workspace);
      this.channelIds = collectChannelIds(workspace);
      // Todo mundo recebe na hora: sem isso metade da equipe ficaria vendo
      // canais que nao existem mais.
      this.broadcast("workspace:list", { workspace });
      return;
    }

    if (type === "decision:list") {
      socket.send(
        json("decision:list", { decisions: await this.getDecisions() })
      );
      return;
    }

    if (
      type === "decision:create" &&
      state.userId &&
      typeof payload.title === "string"
    ) {
      const title = payload.title.trim().slice(0, 240);
      if (!title) return;
      const decision = {
        id: crypto.randomUUID(),
        title,
        ownerName: String(payload.ownerName ?? state.name).slice(0, 80),
        dueDate:
          typeof payload.dueDate === "string"
            ? payload.dueDate.slice(0, 10)
            : "",
        status: "open",
        createdAt: new Date().toISOString(),
        createdBy: state.userId,
      };
      const decisions = await this.getDecisions();
      await this.putDecisions([decision, ...decisions]);
      this.broadcast("decision:list", { decisions: [decision, ...decisions] });
      return;
    }

    if (
      type === "decision:update" &&
      state.userId &&
      typeof payload.id === "string" &&
      ["open", "done"].includes(payload.status)
    ) {
      const decisions = await this.getDecisions();
      const current = decisions.find(decision => decision.id === payload.id);
      if (
        !current ||
        (current.createdBy !== state.userId && !canModerate(state.role))
      )
        return;
      const updated = decisions.map(decision =>
        decision.id === payload.id
          ? { ...decision, status: payload.status }
          : decision
      );
      await this.putDecisions(updated);
      this.broadcast("decision:list", { decisions: updated });
      return;
    }

    if (type === "message:new") {
      if (
        !this.validChannelId(payload.channelId) ||
        typeof payload.content !== "string" ||
        !payload.content.trim() ||
        !state.userId
      )
        return;
      const channelId = payload.channelId;
      const permissions = normalizePermissions(
        (await this.ctx.storage.get(`permissions:${channelId}`)) ?? {}
      );
      if (!canPost(state.role, permissions))
        return socket.send(
          json("realtime:error", {
            message: "Este canal está em modo somente leitura.",
          })
        );
      const history = await this.getHistory(channelId);
      const parentId =
        typeof payload.parentId === "string" &&
        history.some(message => message.id === payload.parentId)
          ? payload.parentId
          : null;
      const message = {
        id: crypto.randomUUID(),
        channelId,
        userId: state.userId,
        authorName: state.name,
        content: payload.content.trim().slice(0, 4000),
        createdAt: new Date().toISOString(),
        parentId,
        reactions: {},
      };
      await this.putHistory(channelId, [...history, message]);
      this.broadcast("message:new", { channelId, message });
      return;
    }

    if (type === "message:edit") {
      if (
        !this.validChannelId(payload.channelId) ||
        typeof payload.messageId !== "string" ||
        typeof payload.content !== "string"
      )
        return;
      const content = payload.content.trim().slice(0, 4000);
      if (!content) return;
      const history = await this.getHistory(payload.channelId);
      const message = history.find(item => item.id === payload.messageId);
      if (!message) return;
      // So o autor edita. Nem moderador reescreve a fala de outra pessoa.
      if (message.userId !== state.userId) {
        return socket.send(
          json("realtime:error", {
            message: "Você só pode editar as suas mensagens.",
          })
        );
      }
      message.content = content;
      message.editedAt = new Date().toISOString();
      await this.putHistory(payload.channelId, history);
      this.broadcast("message:update", {
        channelId: payload.channelId,
        message,
      });
      return;
    }

    if (type === "message:delete") {
      if (
        !this.validChannelId(payload.channelId) ||
        typeof payload.messageId !== "string"
      )
        return;
      const history = await this.getHistory(payload.channelId);
      const message = history.find(item => item.id === payload.messageId);
      if (!message) return;
      // O autor apaga a propria; moderador apaga qualquer uma.
      if (message.userId !== state.userId && !canModerate(state.role)) {
        return socket.send(
          json("realtime:error", {
            message:
              "Apenas o autor ou um moderador pode apagar esta mensagem.",
          })
        );
      }
      // As respostas da thread perderiam o pai e sumiriam da conversa.
      const removidos = new Set([
        message.id,
        ...history
          .filter(item => item.parentId === message.id)
          .map(item => item.id),
      ]);
      await this.putHistory(
        payload.channelId,
        history.filter(item => !removidos.has(item.id))
      );
      const pins = new Set(
        (await this.ctx.storage.get(`pins:${payload.channelId}`)) ?? []
      );
      if (Array.from(removidos).some(id => pins.has(id))) {
        const pinnedIds = Array.from(pins).filter(id => !removidos.has(id));
        await this.ctx.storage.put(`pins:${payload.channelId}`, pinnedIds);
        this.broadcast("message:pins", {
          channelId: payload.channelId,
          pinnedIds,
        });
      }
      this.broadcast("message:removed", {
        channelId: payload.channelId,
        messageIds: Array.from(removidos),
      });
      return;
    }

    if (type === "message:reaction") {
      if (
        !this.validChannelId(payload.channelId) ||
        typeof payload.messageId !== "string" ||
        typeof payload.emoji !== "string" ||
        !state.userId
      )
        return;
      const emoji = payload.emoji.slice(0, 16);
      const history = await this.getHistory(payload.channelId);
      const message = history.find(item => item.id === payload.messageId);
      if (!message) return;
      const reactions = { ...(message.reactions ?? {}) };
      const users = new Set(reactions[emoji] ?? []);
      if (users.has(state.userId)) users.delete(state.userId);
      else users.add(state.userId);
      if (users.size) reactions[emoji] = Array.from(users);
      else delete reactions[emoji];
      message.reactions = reactions;
      await this.putHistory(payload.channelId, history);
      this.broadcast("message:update", {
        channelId: payload.channelId,
        message,
      });
      return;
    }

    if (type === "message:pin") {
      if (
        !this.validChannelId(payload.channelId) ||
        typeof payload.messageId !== "string"
      )
        return;
      if (!canModerate(state.role))
        return socket.send(
          json("realtime:error", {
            message: "Apenas moderadores podem fixar decisões.",
          })
        );
      const history = await this.getHistory(payload.channelId);
      if (!history.some(message => message.id === payload.messageId)) return;
      const key = `pins:${payload.channelId}`;
      const pins = new Set((await this.ctx.storage.get(key)) ?? []);
      if (pins.has(payload.messageId)) pins.delete(payload.messageId);
      else pins.add(payload.messageId);
      const pinnedIds = Array.from(pins).slice(-25);
      await this.ctx.storage.put(key, pinnedIds);
      this.broadcast("message:pins", {
        channelId: payload.channelId,
        pinnedIds,
      });
      return;
    }

    if (type === "message:search" && typeof payload.query === "string") {
      const query = payload.query.trim().toLocaleLowerCase();
      if (!query)
        return socket.send(
          json("message:search-results", { query: "", results: [] })
        );
      // A busca varria uma faixa fixa de ids. Com canais editaveis, qualquer
      // canal criado depois ficaria invisivel para a busca.
      const channels = this.validChannelId(payload.channelId)
        ? [payload.channelId]
        : Array.from(this.channelIds);
      const results = [];
      for (const channelId of channels) {
        const history = await this.getHistory(channelId);
        results.push(
          ...history
            .filter(message =>
              `${message.authorName} ${message.content}`
                .toLocaleLowerCase()
                .includes(query)
            )
            .slice(-20)
        );
      }
      socket.send(
        json("message:search-results", {
          query,
          results: results.slice(-40).reverse(),
        })
      );
      return;
    }

    if (type === "typing" && this.validChannelId(payload.channelId)) {
      this.broadcast(
        "typing",
        {
          channelId: payload.channelId,
          name: state.name,
          active: Boolean(payload.active),
        },
        socket
      );
      return;
    }

    if (
      type === "call:invite" &&
      this.validChannelId(payload.channelId) &&
      typeof payload.userId === "string"
    ) {
      const permissions = normalizePermissions(
        (await this.ctx.storage.get(`permissions:${payload.channelId}`)) ?? {}
      );
      if (!canInvite(state.role, permissions))
        return socket.send(
          json("realtime:error", {
            message: "Apenas administradores podem convidar para esta sala.",
          })
        );
      const target = this.findUserSocket(payload.userId);
      if (target)
        target.send(
          json("call:invite", {
            channelId: payload.channelId,
            from: { userId: state.userId, name: state.name },
          })
        );
      return;
    }

    if (
      type === "music:get" &&
      this.validChannelId(payload.channelId) &&
      state.callChannelId === payload.channelId
    ) {
      this.sendMusicState(
        socket,
        payload.channelId,
        await this.getMusicState(payload.channelId)
      );
      return;
    }

    if (
      type === "music:enqueue" &&
      this.validChannelId(payload.channelId) &&
      state.callChannelId === payload.channelId
    ) {
      const source = sanitizeMusicSource(payload.source, state);
      if (!source)
        return socket.send(
          json("realtime:error", {
            message: "Use um link válido de vídeo ou playlist do YouTube.",
          })
        );
      const current = await this.getMusicState(payload.channelId);
      if (current.queue.length >= MUSIC_QUEUE_LIMIT) {
        return socket.send(
          json("realtime:error", {
            message: `A fila de música atingiu ${MUSIC_QUEUE_LIMIT} itens.`,
          })
        );
      }
      const wasEmpty = current.queue.length === 0;
      const isController =
        current.djUserId === state.userId || canModerate(state.role);
      const queue = [...current.queue, source];
      const switchesSource =
        wasEmpty || Boolean(payload.playNow && isController);
      const musicState = {
        ...current,
        queue,
        queueIndex: wasEmpty
          ? 0
          : payload.playNow && isController
            ? queue.length - 1
            : current.queueIndex,
        playlistIndex: switchesSource ? 0 : current.playlistIndex,
        positionSeconds: switchesSource ? 0 : effectiveMusicPosition(current),
        playing: wasEmpty
          ? true
          : payload.playNow && isController
            ? true
            : current.playing,
        updatedAt: Date.now(),
        revision: current.revision + 1,
        djUserId: current.djUserId ?? state.userId,
        djName: current.djName ?? state.name,
        updatedBy: { userId: state.userId, name: state.name },
      };
      // O estado crítico entra no Durable Object antes do broadcast. Quem
      // reconectar no meio da atualização nunca recebe uma fila que não existe.
      await this.putMusicState(payload.channelId, musicState);
      this.broadcastMusicState(payload.channelId, musicState);
      return;
    }

    if (
      type === "music:claim-dj" &&
      this.validChannelId(payload.channelId) &&
      state.callChannelId === payload.channelId
    ) {
      const current = await this.getMusicState(payload.channelId);
      const djStillPresent =
        current.djUserId &&
        this.isUserInCall(current.djUserId, payload.channelId);
      if (
        djStillPresent &&
        current.djUserId !== state.userId &&
        !canModerate(state.role)
      ) {
        return socket.send(
          json("realtime:error", {
            message: `${current.djName ?? "O DJ atual"} ainda controla a música desta sala.`,
          })
        );
      }
      const musicState = {
        ...current,
        positionSeconds: effectiveMusicPosition(current),
        djUserId: state.userId,
        djName: state.name,
        updatedAt: Date.now(),
        revision: current.revision + 1,
        updatedBy: { userId: state.userId, name: state.name },
      };
      await this.putMusicState(payload.channelId, musicState);
      this.broadcastMusicState(payload.channelId, musicState);
      return;
    }

    if (
      type === "music:control" &&
      this.validChannelId(payload.channelId) &&
      state.callChannelId === payload.channelId
    ) {
      const current = await this.getMusicState(payload.channelId);
      if (current.djUserId !== state.userId && !canModerate(state.role)) {
        return socket.send(
          json("realtime:error", {
            message: "Só o DJ ou um moderador pode controlar a reprodução.",
          })
        );
      }
      const action = String(payload.action ?? "");
      let musicState = {
        ...current,
        positionSeconds: effectiveMusicPosition(current),
      };
      if (action === "clear") {
        musicState = emptyMusicState(payload.channelId);
      } else if (action === "play" && current.queue.length) {
        musicState.playing = true;
        musicState.positionSeconds = musicPosition(
          payload.positionSeconds ?? current.positionSeconds
        );
      } else if (action === "pause" && current.queue.length) {
        musicState.playing = false;
        musicState.positionSeconds = musicPosition(
          payload.positionSeconds ?? current.positionSeconds
        );
      } else if (action === "seek" && current.queue.length) {
        musicState.positionSeconds = musicPosition(payload.positionSeconds);
      } else if (
        action === "select" &&
        Number.isInteger(payload.queueIndex) &&
        current.queue[payload.queueIndex]
      ) {
        musicState.queueIndex = payload.queueIndex;
        musicState.playlistIndex = Math.max(
          0,
          Number.isInteger(payload.playlistIndex) ? payload.playlistIndex : 0
        );
        musicState.positionSeconds = musicPosition(payload.positionSeconds);
        musicState.playing = payload.playing !== false;
      } else if (action === "sync" && current.queue.length) {
        if (
          Number.isInteger(payload.queueIndex) &&
          current.queue[payload.queueIndex]
        )
          musicState.queueIndex = payload.queueIndex;
        if (Number.isInteger(payload.playlistIndex))
          musicState.playlistIndex = Math.max(0, payload.playlistIndex);
        musicState.positionSeconds = musicPosition(payload.positionSeconds);
        if (typeof payload.playing === "boolean")
          musicState.playing = payload.playing;
      } else if (
        action === "remove" &&
        Number.isInteger(payload.queueIndex) &&
        current.queue[payload.queueIndex]
      ) {
        const queue = current.queue.filter(
          (_, index) => index !== payload.queueIndex
        );
        musicState.queue = queue;
        if (!queue.length) {
          musicState = emptyMusicState(payload.channelId);
        } else if (payload.queueIndex < current.queueIndex) {
          musicState.queueIndex = current.queueIndex - 1;
        } else if (payload.queueIndex === current.queueIndex) {
          musicState.queueIndex = Math.min(
            current.queueIndex,
            queue.length - 1
          );
          musicState.playlistIndex = 0;
          musicState.positionSeconds = 0;
        }
      } else {
        return socket.send(
          json("realtime:error", { message: "Controle de música inválido." })
        );
      }
      musicState.updatedAt = Date.now();
      musicState.revision = current.revision + 1;
      musicState.updatedBy = { userId: state.userId, name: state.name };
      await this.putMusicState(payload.channelId, musicState);
      this.broadcastMusicState(payload.channelId, musicState);
      return;
    }

    if (type === "call:join") {
      if (!this.validChannelId(payload.channelId)) return;
      this.leaveCall(socket);
      const callEngine =
        payload.mediaEngine === "realtimekit" ? "realtimekit" : "legacy";
      const next = this.setState(socket, {
        callChannelId: payload.channelId,
        callEngine,
        isMuted: false,
        isSpeaking: false,
        handRaised: false,
      });
      if (callEngine === "legacy") {
        socket.send(
          json("call:peers", {
            channelId: payload.channelId,
            peers: this.peers(payload.channelId, next.socketId, callEngine),
          })
        );
        this.broadcastToCall(
          payload.channelId,
          "call:peer-joined",
          {
            channelId: payload.channelId,
            peer: {
              socketId: next.socketId,
              userId: next.userId,
              name: next.name,
              status: next.status,
              isMuted: false,
              isSpeaking: false,
            },
          },
          socket,
          callEngine
        );
      }
      this.sendMusicState(
        socket,
        payload.channelId,
        await this.getMusicState(payload.channelId)
      );
      this.broadcast("voice:rooms", this.voiceRooms());
      return;
    }

    if (type === "call:mute" && typeof payload.socketId === "string") {
      // Quando o microfone de alguem esta estourando a reuniao, baixar o volume
      // no proprio ouvido nao resolve para o resto da sala.
      if (!canModerate(state.role)) {
        return socket.send(
          json("realtime:error", {
            message: "Apenas moderadores podem silenciar alguém.",
          })
        );
      }
      const alvo = this.findSocket(payload.socketId);
      if (!alvo) return;
      const alvoState = this.getState(alvo);
      if (
        !alvoState?.callChannelId ||
        alvoState.callChannelId !== state.callChannelId
      )
        return;
      this.setState(alvo, { isMuted: true, isSpeaking: false });
      // O aviso vai para a pessoa: o microfone dela fecha de verdade, em vez de
      // so aparecer mudo para os outros enquanto ela segue falando.
      alvo.send(
        json("call:force-mute", {
          channelId: alvoState.callChannelId,
          by: state.name,
        })
      );
      this.broadcast("voice:rooms", this.voiceRooms());
      return;
    }

    if (type === "call:leave") {
      this.leaveCall(socket);
      return;
    }
    if (
      type === "call:audio-state" &&
      this.validChannelId(payload.channelId) &&
      state.callChannelId === payload.channelId
    ) {
      this.setState(socket, {
        isMuted: Boolean(payload.isMuted),
        isSpeaking: Boolean(payload.isMuted)
          ? false
          : Boolean(payload.isSpeaking),
      });
      this.broadcast("voice:rooms", this.voiceRooms());
      return;
    }
    if (
      type === "call:hand-raise" &&
      this.validChannelId(payload.channelId) &&
      state.callChannelId === payload.channelId
    ) {
      this.setState(socket, { handRaised: Boolean(payload.active) });
      this.broadcast("voice:rooms", this.voiceRooms());
      return;
    }
    if (
      type === "call:screen-share" &&
      this.validChannelId(payload.channelId) &&
      state.callChannelId === payload.channelId
    ) {
      this.broadcastToCall(payload.channelId, "call:screen-share", {
        channelId: payload.channelId,
        socketId: payload.active ? state.socketId : null,
        name: payload.active ? state.name : null,
      });
      return;
    }
    if (
      ["call:offer", "call:answer", "call:ice"].includes(type) &&
      this.validChannelId(payload.channelId) &&
      typeof payload.to === "string"
    ) {
      if (state.callEngine && state.callEngine !== "legacy") return;
      const target = this.findSocket(payload.to);
      if (!target) return;
      const targetState = this.getState(target);
      if (
        targetState?.callChannelId !== state.callChannelId ||
        (targetState.callEngine ?? "legacy") !== "legacy"
      )
        return;
      const body = {
        ...payload,
        from: state.socketId,
        user: { userId: state.userId, name: state.name, status: state.status },
      };
      delete body.to;
      target.send(json(type, body));
    }
  }
}
