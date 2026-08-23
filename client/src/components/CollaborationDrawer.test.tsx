import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CollaborationDrawer } from "./CollaborationDrawer";

const onStatusChange = vi.fn();
const onSearch = vi.fn();
const onReact = vi.fn();
const onPin = vi.fn();
const onReply = vi.fn();
const onInvite = vi.fn();
const onTogglePushToTalk = vi.fn();
const onPushToTalkKeyChange = vi.fn();
const onToggleReadOnly = vi.fn();
const onSetRole = vi.fn();
const onToggleInvitePolicy = vi.fn();

const props = {
  messages: [{ id: "m1", channelId: 1, userId: "u1", authorName: "Paulo", content: "Decisão do dia", createdAt: "2026-08-19", reactions: {} }],
  pinnedIds: [], presence: [{ userId: "u2", name: "Vinícius", status: "online" }], profileId: "u1", profileName: "Paulo",
  status: "online", statusMessage: "", searchQuery: "", searchResults: [], activeCall: true, pushToTalkEnabled: false, pushToTalkKey: "Space" as const, isTransmitting: false, canManage: true, readOnly: false, invitePolicy: "member" as const,
  onStatusChange, onSearch, onReact, onPin, onReply, onInvite, onTogglePushToTalk, onPushToTalkKeyChange, onToggleReadOnly, onSetRole, onToggleInvitePolicy,
};

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("CollaborationDrawer", () => {
  it("abre a central e aciona busca, push-to-talk e convite", () => {
    render(<CollaborationDrawer {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Detalhes" }));
    fireEvent.change(screen.getByPlaceholderText("Buscar transmissões"), { target: { value: "decisão" } });
    fireEvent.click(screen.getByRole("button", { name: /Push-to-talk/ }));
    fireEvent.change(screen.getByDisplayValue("Espaço"), { target: { value: "KeyV" } });
    fireEvent.click(screen.getByRole("button", { name: /Vinícius/ }));
    expect(onSearch).toHaveBeenCalledWith("decisão");
    expect(onTogglePushToTalk).toHaveBeenCalledOnce();
    expect(onPushToTalkKeyChange).toHaveBeenCalledWith("KeyV");
    expect(onInvite).toHaveBeenCalledWith("u2");
  });

  it("aciona reações, pin e resposta de thread em mensagens recentes", () => {
    render(<CollaborationDrawer {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Detalhes" }));
    fireEvent.click(screen.getByRole("button", { name: /👍 0/ }));
    fireEvent.click(screen.getAllByRole("button").find(button => button.innerHTML.includes("pin"))!);
    expect(onReact).toHaveBeenCalledWith("m1", "👍");
    expect(onPin).toHaveBeenCalledWith("m1");
  });
});
