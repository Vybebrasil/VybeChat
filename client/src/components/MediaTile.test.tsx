import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MediaTile } from "./MediaTile";

describe("MediaTile", () => {
  it("mantém um elemento de áudio para participante remoto mesmo sem câmera", () => {
    const stream = { getVideoTracks: () => [], getAudioTracks: () => [] } as unknown as MediaStream;
    const { container } = render(<MediaTile stream={stream} label="Paulo" cameraOn={false} microphoneOn />);
    expect(container.querySelector("audio")).not.toBeNull();
    expect(container.querySelector("video")).toBeNull();
  });

  it("não reproduz o próprio stream local para evitar eco", () => {
    const stream = { getVideoTracks: () => [], getAudioTracks: () => [] } as unknown as MediaStream;
    const { container } = render(<MediaTile stream={stream} label="Você" isLocal cameraOn={false} microphoneOn />);
    expect(container.querySelector("audio")).toBeNull();
  });
});
