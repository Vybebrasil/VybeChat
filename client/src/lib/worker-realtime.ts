export type RealtimeEventHandler = (...args: any[]) => void;

export function toWorkerWebSocketUrl(workerUrl: string, room = "vybe-os") {
  const url = new URL(workerUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `/room/${room}`;
  return url.toString();
}

export function parseWorkerRealtimeMessage(raw: string) {
  const message = JSON.parse(raw) as { type?: unknown; payload?: unknown };
  if (typeof message.type !== "string") throw new Error("Worker event type is missing");
  return { type: message.type, payload: message.payload };
}
