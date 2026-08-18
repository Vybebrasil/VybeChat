import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  createChannelMessage: vi.fn(),
  createWorkspaceCategory: vi.fn(),
  createWorkspaceChannel: vi.fn(),
  ensureChannelMembership: vi.fn(),
  ensureWorkspaceMembership: vi.fn(),
  ensureWorkspaceSeed: vi.fn(),
  listChannelMessages: vi.fn(),
  listWorkspace: vi.fn(),
}));

vi.mock("./db", () => dbMocks);

import { appRouter } from "./routers";

function context(): TrpcContext {
  return {
    user: {
      id: 42,
      openId: "operator-vybe",
      name: "Operador Vybe",
      email: "operador@vybe.com.br",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("workspace and message procedures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("seeds and returns the workspace while associating the signed-in member", async () => {
    const workspace = [{ id: 1, name: "OPERAÇÃO", position: 1, createdAt: new Date(), channels: [] }];
    dbMocks.listWorkspace.mockResolvedValue(workspace);
    const caller = appRouter.createCaller(context());

    await expect(caller.workspace.list()).resolves.toEqual(workspace);
    expect(dbMocks.ensureWorkspaceSeed).toHaveBeenCalledOnce();
    expect(dbMocks.ensureWorkspaceMembership).toHaveBeenCalledWith(42);
  });

  it("normalizes and creates categories and channels", async () => {
    const caller = appRouter.createCaller(context());

    await caller.workspace.createCategory({ name: "  Direção   de Arte " });
    await caller.workspace.createChannel({ categoryId: 7, name: "Direção de Arte & Conteúdo", type: "text" });

    expect(dbMocks.createWorkspaceCategory).toHaveBeenCalledWith("Direção de Arte");
    expect(dbMocks.createWorkspaceChannel).toHaveBeenCalledWith({
      categoryId: 7,
      name: "direcao-de-arte-conteudo",
      type: "text",
    });
    expect(dbMocks.ensureWorkspaceMembership).toHaveBeenCalledWith(42);
  });

  it("associates a member before listing and persisting channel messages", async () => {
    const persistedMessages = [{ id: 4, channelId: 3, userId: 42, content: "**Pulso**", createdAt: new Date() }];
    dbMocks.listChannelMessages.mockResolvedValue(persistedMessages);
    const caller = appRouter.createCaller(context());

    await expect(caller.messages.list({ channelId: 3 })).resolves.toEqual(persistedMessages);
    await expect(caller.messages.create({ channelId: 3, content: "Mensagem de operação" })).resolves.toEqual({ success: true });

    expect(dbMocks.ensureChannelMembership).toHaveBeenCalledWith(3, 42);
    expect(dbMocks.createChannelMessage).toHaveBeenCalledWith({
      channelId: 3,
      userId: 42,
      content: "Mensagem de operação",
    });
  });
});
