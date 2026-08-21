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

const WORKSPACE_CODE = "codigo-da-equipe";

function setup(env: Record<string, string> = { VYBECHAT_WORKSPACE_CODE: WORKSPACE_CODE }) {
  const storage = new MemoryStorage();
  const admin = new FakeSocket({ socketId: "admin-socket", userId: "gestaovybe@gmail.com", name: "Admin", status: "online", role: "admin", callChannelId: null });
  const member = new FakeSocket({ socketId: "member-socket", userId: "member@vybe.com", name: "Member", status: "online", role: "member", callChannelId: null });
  const sockets = [admin, member];
  const room = new VybeChatRoom({ storage, getWebSockets: () => sockets }, env);
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
    await room.handleEvent(reconnected, "presence:join", { userId: "lead@vybe.com", name: "Lead", status: "online", workspaceCode: WORKSPACE_CODE });
    expect(await storage.get("role:lead@vybe.com")).toBe("admin");
    expect(reconnected.deserializeAttachment().role).toBe("admin");
  });

  it("recusa presence:join quando o codigo de acesso nao confere", async () => {
    const { room, sockets } = setup();
    const visitante = new FakeSocket({ socketId: "visitante", userId: null, name: "Visitante", status: "offline", role: "member", callChannelId: null });
    sockets.push(visitante);
    await room.handleEvent(visitante, "presence:join", { userId: "invasor", name: "Invasor", workspaceCode: "errado" });
    expect(visitante.deserializeAttachment().userId).toBeNull();
    expect(packets(visitante).at(-1)).toMatchObject({ type: "realtime:error", payload: { code: "auth" } });
  });

  it("recusa presence:join quando o Worker nao tem codigo configurado", async () => {
    const { room, sockets } = setup({});
    const visitante = new FakeSocket({ socketId: "visitante", userId: null, name: "Visitante", status: "offline", role: "member", callChannelId: null });
    sockets.push(visitante);
    await room.handleEvent(visitante, "presence:join", { userId: "qualquer", name: "Qualquer", workspaceCode: "" });
    expect(visitante.deserializeAttachment().userId).toBeNull();
    expect(packets(visitante).at(-1)).toMatchObject({ type: "realtime:error", payload: { code: "auth" } });
  });

  it("nao entrega historico para conexao que ainda nao autenticou", async () => {
    const { room, sockets } = setup();
    const visitante = new FakeSocket({ socketId: "visitante", userId: null, name: "Visitante", status: "offline", role: "member", callChannelId: null });
    sockets.push(visitante);
    await room.handleEvent(visitante, "channel:join", { channelId: 1 });
    expect(packets(visitante).some(packet => packet.type === "message:history")).toBe(false);
    expect(packets(visitante).at(-1)).toMatchObject({ type: "realtime:error", payload: { code: "auth" } });
  });

  it("promove a admin pelo slug configurado em VYBECHAT_ADMIN_SLUGS", async () => {
    const { room, sockets } = setup({ VYBECHAT_WORKSPACE_CODE: WORKSPACE_CODE, VYBECHAT_ADMIN_SLUGS: "paulo, mizinho" });
    const chefe = new FakeSocket({ socketId: "chefe", userId: null, name: "Visitante", status: "offline", role: "member", callChannelId: null });
    sockets.push(chefe);
    await room.handleEvent(chefe, "presence:join", { userId: "paulo-m1abc-x9y2", name: "Paulo", workspaceCode: WORKSPACE_CODE });
    expect(chefe.deserializeAttachment().role).toBe("admin");
  });

  it("nao promove quem apenas comeca com um trecho do slug", async () => {
    const { room, sockets } = setup({ VYBECHAT_WORKSPACE_CODE: WORKSPACE_CODE, VYBECHAT_ADMIN_SLUGS: "paulo" });
    const outro = new FakeSocket({ socketId: "outro", userId: null, name: "Visitante", status: "offline", role: "member", callChannelId: null });
    sockets.push(outro);
    await room.handleEvent(outro, "presence:join", { userId: "paulozinho-m1abc-x9y2", name: "Paulozinho", workspaceCode: WORKSPACE_CODE });
    expect(outro.deserializeAttachment().role).toBe("member");
  });

  it("informa o proprio socketId no presence:join", async () => {
    const { room, sockets } = setup();
    const novo = new FakeSocket({ socketId: "socket-do-paulo", userId: null, name: "Visitante", status: "offline", role: "member", callChannelId: null });
    sockets.push(novo);
    await room.handleEvent(novo, "presence:join", { userId: "paulo-1", name: "Paulo", workspaceCode: WORKSPACE_CODE });
    // O cliente usa esse id para decidir quem cede numa colisao de ofertas.
    expect(packets(novo)[0]).toEqual({ type: "session:ready", payload: { socketId: "socket-do-paulo" } });
  });

  it("eventos de chamada so vao para quem esta na mesma sala de voz", async () => {
    const { room, sockets, admin, member } = setup();
    admin.attachment.callChannelId = 5;
    member.attachment.callChannelId = 6;
    const entrando = new FakeSocket({ socketId: "entrando", userId: "novo@vybe.com", name: "Novo", status: "online", role: "member", callChannelId: null });
    sockets.push(entrando);

    await room.handleEvent(entrando, "call:join", { channelId: 5 });

    const naSala5 = packets(admin).filter(packet => packet.type === "call:peer-joined");
    const naSala6 = packets(member).filter(packet => packet.type === "call:peer-joined");
    expect(naSala5).toHaveLength(1);
    // Antes o broadcast ia para todo mundo e o cliente descartava.
    expect(naSala6).toHaveLength(0);
  });

  it("o autor edita a própria mensagem e o texto novo chega a todos", async () => {
    const { room, storage, admin } = setup();
    await room.handleEvent(admin, "message:new", { channelId: 1, content: "versão errada" });
    const [msg] = (await storage.get("messages:1")) as Array<{ id: string }>;
    await room.handleEvent(admin, "message:edit", { channelId: 1, messageId: msg.id, content: "versão corrigida" });
    const historico = (await storage.get("messages:1")) as Array<{ content: string; editedAt?: string }>;
    expect(historico[0].content).toBe("versão corrigida");
    expect(historico[0].editedAt).toBeTruthy();
  });

  it("ninguém reescreve a fala de outra pessoa, nem moderador", async () => {
    const { room, storage, admin, member } = setup();
    await room.handleEvent(member, "message:new", { channelId: 1, content: "minha mensagem" });
    const [msg] = (await storage.get("messages:1")) as Array<{ id: string }>;
    // `admin` é administrador e ainda assim não pode: editar é só do autor.
    await room.handleEvent(admin, "message:edit", { channelId: 1, messageId: msg.id, content: "texto trocado" });
    expect(((await storage.get("messages:1")) as Array<{ content: string }>)[0].content).toBe("minha mensagem");
    expect(packets(admin).at(-1)).toMatchObject({ type: "realtime:error" });
  });

  it("apagar leva junto as respostas da thread", async () => {
    const { room, storage, admin, member } = setup();
    await room.handleEvent(admin, "message:new", { channelId: 1, content: "pergunta" });
    const [raiz] = (await storage.get("messages:1")) as Array<{ id: string }>;
    await room.handleEvent(member, "message:new", { channelId: 1, content: "resposta", parentId: raiz.id });
    await room.handleEvent(admin, "message:delete", { channelId: 1, messageId: raiz.id });
    // Sem isso a resposta ficaria órfã, visível e sem contexto nenhum.
    expect(await storage.get("messages:1")).toEqual([]);
    expect(packets(member).at(-1)).toMatchObject({ type: "message:removed" });
  });

  it("moderador apaga mensagem de outra pessoa", async () => {
    const { room, storage, admin, member } = setup();
    await room.handleEvent(member, "message:new", { channelId: 1, content: "fora de hora" });
    const [msg] = (await storage.get("messages:1")) as Array<{ id: string }>;
    await room.handleEvent(admin, "message:delete", { channelId: 1, messageId: msg.id });
    expect(await storage.get("messages:1")).toEqual([]);
  });

  it("quem não é autor nem moderador não apaga", async () => {
    const { room, storage, admin, member } = setup();
    await room.handleEvent(admin, "message:new", { channelId: 1, content: "do admin" });
    const [msg] = (await storage.get("messages:1")) as Array<{ id: string }>;
    await room.handleEvent(member, "message:delete", { channelId: 1, messageId: msg.id });
    expect((await storage.get("messages:1")) as unknown[]).toHaveLength(1);
  });

  it("apagar uma mensagem fixada tira ela dos fixados", async () => {
    const { room, storage, admin } = setup();
    await room.handleEvent(admin, "message:new", { channelId: 1, content: "decisão" });
    const [msg] = (await storage.get("messages:1")) as Array<{ id: string }>;
    await room.handleEvent(admin, "message:pin", { channelId: 1, messageId: msg.id });
    await room.handleEvent(admin, "message:delete", { channelId: 1, messageId: msg.id });
    // Um fixado apontando para mensagem inexistente ficaria preso na lateral.
    expect(await storage.get("pins:1")).toEqual([]);
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

  it("persiste decisões e permite que o responsável conclua a própria ação", async () => {
    const { room, storage, member } = setup();
    await room.handleEvent(member, "decision:create", { title: "Aprovar roteiro", ownerName: "Member", dueDate: "2026-08-22" });
    const [decision] = await storage.get("team:decisions") as Array<{ id: string; status: string; createdBy: string }>;
    await room.handleEvent(member, "decision:update", { id: decision.id, status: "done" });
    const [updated] = await storage.get("team:decisions") as Array<{ status: string; createdBy: string }>;
    expect(updated.createdBy).toBe("member@vybe.com");
    expect(updated.status).toBe("done");
    expect(packets(member).some(packet => packet.type === "decision:list" && packet.payload.decisions.length === 1)).toBe(true);
  });
});
