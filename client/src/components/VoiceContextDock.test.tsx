import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VoiceContextDock } from "./VoiceContextDock";

const props = {
  roomName: "Sala Geral",
  participantCount: 2,
  microphoneOn: true,
  cameraOn: true,
  screenSharing: false,
  audioInputs: [{ deviceId: "mic-1", label: "Microfone USB" }],
  selectedAudioInput: "",
  onAudioInputChange: vi.fn(),
  onToggleMic: vi.fn(),
  onToggleCamera: vi.fn(),
  onShareScreen: vi.fn(),
  onOpenFocus: vi.fn(),
  onLeave: vi.fn(),
  gateSensitivity: 18,
  onGateSensitivityChange: vi.fn(),
  micLevel: 0,
};

describe("VoiceContextDock", () => {
  it("mantém controles, foco e seleção de microfone no contexto da conversa", () => {
    render(<VoiceContextDock {...props} />);
    expect(screen.getByText("Sala Geral")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Expandir chamada" }));
    expect(props.onOpenFocus).toHaveBeenCalledOnce();
    fireEvent.click(
      screen.getByRole("button", { name: "Configurações da chamada" })
    );
    fireEvent.change(screen.getByLabelText("Microfone"), {
      target: { value: "mic-1" },
    });
    expect(props.onAudioInputChange).toHaveBeenCalledWith("mic-1");
  });
});

// Este projeto nao registra limpeza automatica do testing-library, entao as
// buscas ficam escopadas ao container de cada render.
describe("sensibilidade do microfone", () => {
  it("mostra a barra com o corte e reporta a mudança", () => {
    const onGateSensitivityChange = vi.fn();
    const { container } = render(
      <VoiceContextDock
        {...props}
        gateSensitivity={18}
        micLevel={40}
        onGateSensitivityChange={onGateSensitivityChange}
      />
    );
    fireEvent.click(
      container.querySelector(
        '[aria-label="Configurações da chamada"]'
      ) as HTMLButtonElement
    );
    const slider = container.querySelector(
      'input[type="range"][aria-label="Sensibilidade do microfone"]'
    ) as HTMLInputElement;
    expect(slider).toBeTruthy();
    expect(slider.value).toBe("18");
    fireEvent.change(slider, { target: { value: "40" } });
    expect(onGateSensitivityChange).toHaveBeenCalledWith(40);
  });

  it("diz que está transmitindo quando a voz passa do corte", () => {
    const { container } = render(
      <VoiceContextDock
        {...props}
        gateSensitivity={18}
        micLevel={45}
        onGateSensitivityChange={vi.fn()}
      />
    );
    fireEvent.click(
      container.querySelector(
        '[aria-label="Configurações da chamada"]'
      ) as HTMLButtonElement
    );
    expect(container.textContent).toContain("transmitindo");
  });

  it("diz que está silenciado quando a voz fica abaixo", () => {
    const { container } = render(
      <VoiceContextDock
        {...props}
        gateSensitivity={40}
        micLevel={10}
        onGateSensitivityChange={vi.fn()}
      />
    );
    fireEvent.click(
      container.querySelector(
        '[aria-label="Configurações da chamada"]'
      ) as HTMLButtonElement
    );
    expect(container.textContent).toContain("silenciado");
  });

  it("com o corte no piso, avisa que tudo passa", () => {
    const { container } = render(
      <VoiceContextDock
        {...props}
        gateSensitivity={0}
        micLevel={5}
        onGateSensitivityChange={vi.fn()}
      />
    );
    fireEvent.click(
      container.querySelector(
        '[aria-label="Configurações da chamada"]'
      ) as HTMLButtonElement
    );
    expect(container.textContent).toContain("sempre aberto");
  });
});
