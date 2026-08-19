import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CallStage } from "./CallStage";

const commonProps = {
  roomName: "sala-geral",
  microphoneOn: true,
  cameraOn: true,
  sharingScreen: false,
  onToggleMic: vi.fn(),
  onToggleCamera: vi.fn(),
  onShareScreen: vi.fn(),
  onLeave: vi.fn(),
  onMinimize: vi.fn(),
};

const participants = [
  { id: "local", label: "Paulo", stream: null, isLocal: true, microphoneOn: true },
  { id: "remote", label: "Vinícius", stream: null, microphoneOn: true },
];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });
});

describe("CallStage", () => {
  it("permite fixar e desafixar o participante exibido no palco", () => {
    render(<CallStage {...commonProps} participants={participants} />);
    fireEvent.click(screen.getByRole("button", { name: "Fixar" }));
    expect(screen.getByRole("button", { name: "Fixado" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Fixado" }));
    expect(screen.getByRole("button", { name: "Fixar" })).toBeTruthy();
  });

  it("alterna entre o palco e a grade de participantes", () => {
    render(<CallStage {...commonProps} participants={participants} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir grade de participantes" }));
    expect(screen.getByRole("button", { name: "Abrir palco principal" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Exibir Vinícius no palco" }));
    expect(screen.getByRole("button", { name: "Abrir grade de participantes" })).toBeTruthy();
  });

  it("abre o painel de participantes com o estado de áudio de cada pessoa", () => {
    render(<CallStage {...commonProps} participants={participants} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir participantes" }));
    expect(screen.getByText("Na chamada")).toBeTruthy();
    expect(screen.getAllByText("Paulo (você)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Microfone ativo").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Fechar participantes" }));
    expect(screen.queryByText("Status de áudio ao vivo")).toBeNull();
  });

  it("aciona a entrada e a saída de tela cheia pelos controles da interface", () => {
    const requestFullscreen = vi.fn();
    const exitFullscreen = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", { configurable: true, value: requestFullscreen });
    Object.defineProperty(document, "exitFullscreen", { configurable: true, value: exitFullscreen });
    render(<CallStage {...commonProps} participants={participants} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir em tela cheia" }));
    expect(requestFullscreen).toHaveBeenCalledOnce();
    cleanup();
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: document.body });
    render(<CallStage {...commonProps} participants={participants} />);
    fireEvent.click(screen.getByRole("button", { name: "Sair da tela cheia" }));
    expect(exitFullscreen).toHaveBeenCalledOnce();
  });
});
