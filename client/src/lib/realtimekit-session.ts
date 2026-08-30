export type CallEngine = "legacy" | "realtimekit";
export type CallEnginePreference = CallEngine | "auto";

export type RealtimeKitSession = {
  engine: "realtimekit";
  meetingId: string;
  participantId: string;
  authToken: string;
};

type SessionRequest = {
  workerUrl: string;
  channelId: number;
  roomName: string;
  workspaceCode: string;
  room?: string;
  user: { id: string; name: string; photo?: string };
  fetcher?: typeof fetch;
};

export class RealtimeKitSessionError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RealtimeKitSessionError";
  }
}

export function getCallEnginePreference(value: unknown): CallEnginePreference {
  return value === "legacy" || value === "realtimekit" ? value : "auto";
}

export function shouldFallbackToLegacy(preference: CallEnginePreference, error: unknown) {
  return preference === "auto" && error instanceof RealtimeKitSessionError && error.code === "realtimekit_unconfigured";
}

export async function requestRealtimeKitSession({
  workerUrl,
  channelId,
  roomName,
  room,
  workspaceCode,
  user,
  fetcher = fetch,
}: SessionRequest): Promise<RealtimeKitSession> {
  if (!workerUrl) throw new RealtimeKitSessionError("O serviço de chamadas não está configurado.", "worker_unconfigured", 503);

  const endpoint = new URL(workerUrl);
  endpoint.pathname = "/calls/session";
  endpoint.search = "";
  if (room) endpoint.searchParams.set("room", room);
  endpoint.hash = "";

  let response: Response;
  try {
    response = await fetcher(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channelId,
        roomName,
        workspaceCode,
        userId: user.id,
        name: user.name,
        photo: user.photo ?? "",
      }),
    });
  } catch {
    throw new RealtimeKitSessionError("Não foi possível alcançar o serviço de chamadas.", "network", 0);
  }

  const payload = await response.json().catch(() => ({})) as Partial<RealtimeKitSession> & { error?: string; code?: string };
  if (!response.ok) {
    throw new RealtimeKitSessionError(
      payload.error || "Não foi possível preparar a chamada.",
      payload.code || "session_failed",
      response.status,
    );
  }

  if (payload.engine !== "realtimekit" || !payload.authToken || !payload.meetingId || !payload.participantId) {
    throw new RealtimeKitSessionError("O serviço de chamadas devolveu uma sessão inválida.", "invalid_session", 502);
  }

  return payload as RealtimeKitSession;
}
