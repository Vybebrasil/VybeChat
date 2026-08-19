import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VoiceContextDock } from "./VoiceContextDock";

const props = { roomName: "Sala Geral", participantCount: 2, microphoneOn: true, cameraOn: true, screenSharing: false, audioInputs: [{ deviceId: "mic-1", label: "Microfone USB" }], selectedAudioInput: "", onAudioInputChange: vi.fn(), onToggleMic: vi.fn(), onToggleCamera: vi.fn(), onShareScreen: vi.fn(), onOpenFocus: vi.fn(), onLeave: vi.fn() };

describe("VoiceContextDock", () => {
  it("mantém controles, foco e seleção de microfone no contexto da conversa", () => {
    render(<VoiceContextDock {...props} />);
    expect(screen.getByText("Conectado em Sala Geral")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Abrir modo foco" }));
    expect(props.onOpenFocus).toHaveBeenCalledOnce();
    fireEvent.change(screen.getByLabelText("Microfone"), { target: { value: "mic-1" } });
    expect(props.onAudioInputChange).toHaveBeenCalledWith("mic-1");
  });
});
