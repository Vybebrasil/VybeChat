import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommandNavigation } from "./CommandNavigation";

const onSelectText = vi.fn();
const onJoinVoice = vi.fn();

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("CommandNavigation", () => {
  it("navega por canal e exibe ocupação somente quando a sala tem participantes", () => {
    render(<CommandNavigation
      groups={[{ name: "Operação", channels: [{ id: 1, name: "geral", type: "text" }, { id: 2, name: "sala-geral", type: "voice" }, { id: 3, name: "war-room", type: "voice" }] }]}
      selectedChannelId={1}
      voiceRooms={{ 2: [{ socketId: "peer-1", name: "Paulo", isSpeaking: true }], 3: [] }}
      onSelectText={onSelectText}
      onJoinVoice={onJoinVoice}
    />);

    fireEvent.click(screen.getByRole("button", { name: /^geral$/ }));
    fireEvent.click(screen.getByRole("button", { name: /sala-geral/ }));
    expect(onSelectText).toHaveBeenCalledWith(1);
    expect(onJoinVoice).toHaveBeenCalledWith(2);
    expect(screen.getByText("01")).toBeTruthy();
    expect(screen.queryByText("00")).toBeNull();
    expect(screen.getByText("Paulo")).toBeTruthy();
  });
});
