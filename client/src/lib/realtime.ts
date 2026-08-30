import { parseWorkerRealtimeMessage, toWorkerWebSocketUrl, type RealtimeEventHandler } from "./worker-realtime";

type EventRegistry = Map<string, Set<RealtimeEventHandler>>;

class WorkerRealtimeSocket {
  connected = false;
  private socket: WebSocket | null = null;
  private handlers: EventRegistry = new Map();
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private reconnectAttempt = 0;
  private lastMessageAt = 0;
  private shouldReconnect = false;
  private room: string;

  constructor(room = "vybe-os") {
    this.room = room;
  }

  on(event: string, handler: RealtimeEventHandler) {
    const handlers = this.handlers.get(event) ?? new Set();
    handlers.add(handler);
    this.handlers.set(event, handlers);
    return this;
  }

  off(event: string, handler?: RealtimeEventHandler) {
    if (!handler) {
      this.handlers.delete(event);
      return this;
    }
    this.handlers.get(event)?.delete(handler);
    return this;
  }

  emit(event: string, payload?: unknown) {
    if (this.socket?.readyState !== WebSocket.OPEN) return this;
    this.socket.send(JSON.stringify({ type: event, payload }));
    return this;
  }

  connect() {
    this.shouldReconnect = true;
    if (this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) return this;
    const workerUrl = import.meta.env.VITE_REALTIME_WORKER_URL;
    if (!workerUrl) {
      this.dispatch("realtime:error", { message: "A URL do serviço de tempo real não está configurada." });
      return this;
    }

    this.socket = new WebSocket(toWorkerWebSocketUrl(workerUrl, this.room));
    this.socket.addEventListener("open", () => {
      this.connected = true;
      this.reconnectAttempt = 0;
      this.lastMessageAt = Date.now();
      this.startHeartbeat();
      this.dispatch("connect");
    });
    this.socket.addEventListener("message", event => {
      this.lastMessageAt = Date.now();
      try {
        const message = parseWorkerRealtimeMessage(String(event.data));
        this.dispatch(message.type, message.payload);
      } catch {
        this.dispatch("realtime:error", { message: "O serviço de tempo real enviou uma resposta inválida." });
      }
    });
    this.socket.addEventListener("close", () => {
      this.connected = false;
      this.stopHeartbeat();
      this.dispatch("disconnect");
      if (this.shouldReconnect) this.scheduleReconnect();
    });
    this.socket.addEventListener("error", () => {
      this.dispatch("realtime:error", { message: "A conexão com as salas foi interrompida. Tentando reconectar..." });
    });
    return this;
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.stopHeartbeat();
    this.socket?.close();
    this.socket = null;
    this.connected = false;
    return this;
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = reconnectDelay(this.reconnectAttempt);
    this.reconnectAttempt += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = window.setInterval(() => {
      const socket = this.socket;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      // Um Wi-Fi que morre sem FIN deixa o browser acreditando que o WebSocket
      // segue aberto. O ping detecta essa meia-conexão e força o fluxo normal de
      // reconexão, que reentra na sala e recria os pares legados.
      if (Date.now() - this.lastMessageAt > 45_000) {
        socket.close(4000, "heartbeat timeout");
        return;
      }
      socket.send(JSON.stringify({ type: "system:ping", payload: { at: Date.now() } }));
    }, 15_000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) window.clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private dispatch(event: string, payload?: unknown) {
    this.handlers.get(event)?.forEach(handler => handler(payload));
  }
}

export function reconnectDelay(attempt: number, random = Math.random()) {
  const base = Math.min(1000 * (2 ** Math.max(0, attempt)), 15_000);
  return Math.round(base * (0.8 + Math.max(0, Math.min(1, random)) * 0.4));
}

let socket: WorkerRealtimeSocket | null = null;
let currentRoom: string | null = null;

export function getRealtimeSocket(room = "vybe-os") {
  if (!socket || currentRoom !== room) {
    if (socket) socket.disconnect();
    socket = new WorkerRealtimeSocket(room);
    currentRoom = room;
  }
  return socket;
}
