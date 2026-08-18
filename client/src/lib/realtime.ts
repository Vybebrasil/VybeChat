import { parseWorkerRealtimeMessage, toWorkerWebSocketUrl, type RealtimeEventHandler } from "./worker-realtime";

type EventRegistry = Map<string, Set<RealtimeEventHandler>>;

class WorkerRealtimeSocket {
  connected = false;
  private socket: WebSocket | null = null;
  private handlers: EventRegistry = new Map();
  private reconnectTimer: number | null = null;
  private shouldReconnect = false;

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

    this.socket = new WebSocket(toWorkerWebSocketUrl(workerUrl));
    this.socket.addEventListener("open", () => {
      this.connected = true;
      this.dispatch("connect");
    });
    this.socket.addEventListener("message", event => {
      try {
        const message = parseWorkerRealtimeMessage(String(event.data));
        this.dispatch(message.type, message.payload);
      } catch {
        this.dispatch("realtime:error", { message: "O serviço de tempo real enviou uma resposta inválida." });
      }
    });
    this.socket.addEventListener("close", () => {
      this.connected = false;
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
    this.socket?.close();
    this.socket = null;
    this.connected = false;
    return this;
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 1200);
  }

  private dispatch(event: string, payload?: unknown) {
    this.handlers.get(event)?.forEach(handler => handler(payload));
  }
}

let socket: WorkerRealtimeSocket | null = null;

export function getRealtimeSocket() {
  if (!socket) {
    socket = new WorkerRealtimeSocket();
  }
  return socket;
}
