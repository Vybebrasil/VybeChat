import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VoiceContextDock } from "./VoiceContextDock";

const props = { roomName: "Sala Geral", participantCount: 2, microphoneOn: true, cameraOn: true, screenSharing: false, audioInputs: [{ deviceId: "mic-1", label: "Microfone USB" }], selectedAudioInput: "", onAudioInputChange: vi.fn(), onToggleMic: vi.fn(), onToggleCamera: vi.fn(), onShareScreen: vi.fn(), onOpenFocus: vi.fn(), onLeave: vi.fn(), gateSensitivity: 18, onGateSensitivityChange: vi.fn() };

describe("VoiceContextDock", () => {
  it("mantém controles, foco e seleção de microfone no contexto da conversa", () => {
    render(<VoiceContextDock {...props} />);
    expect(screen.getByText("Sala Geral")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Abrir modo foco" }));
    expect(props.onOpenFocus).toHaveBeenCalledOnce();
    fireEvent.change(screen.getByLabelText("Microfone"), { target: { value: "mic-1" } });
    expect(props.onAudioInputChange).toHaveBeenCalledWith("mic-1");
  });
});

// Este projeto nao registra limpeza automatica do testing-library, entao as
// buscas ficam escopadas ao container de cada render.
describe("controle de som de fundo", () => {
  it("mostra o corte de som de fundo e reporta a mudança", () => {
    const onGateSensitivityChange = vi.fn();
    const { container } = render(<VoiceContextDock {...props} gateSensitivity={18} onGateSensitivityChange={onGateSensitivityChange} />);
    const slider = container.querySelector('input[type="range"][aria-label="Cortar som de fundo"]') as HTMLInputElement;
    expect(slider).toBeTruthy();
    expect(slider.value).toBe("18");
    fireEvent.change(slider, { target: { value: "40" } });
    expect(onGateSensitivityChange).toHaveBeenCalledWith(40);
  });

  it("deixa claro quando está desligado", () => {
    const { container } = render(<VoiceContextDock {...props} gateSensitivity={0} onGateSensitivityChange={vi.fn()} />);
    expect(container.textContent).toContain("desligado");
  });
});
