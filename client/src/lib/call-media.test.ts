import { describe, expect, it, vi } from "vitest";
import { getCallMedia, getCallMediaErrorMessage } from "./call-media";

describe("call media acquisition", () => {
  it("falls back to audio-only when camera and microphone together are unavailable", async () => {
    const audioStream = {} as MediaStream;
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("Camera busy", "NotReadableError"))
      .mockResolvedValueOnce(audioStream);

    await expect(getCallMedia({ getUserMedia })).resolves.toEqual({ stream: audioStream, mode: "audio-only" });
    expect(getUserMedia).toHaveBeenNthCalledWith(1, { video: true, audio: true });
    expect(getUserMedia).toHaveBeenNthCalledWith(2, { video: false, audio: true });
  });

  it("provides specific recovery guidance for common microphone failures", () => {
    expect(getCallMediaErrorMessage(new DOMException("Denied", "NotAllowedError"))).toContain("Permita o acesso ao microfone");
    expect(getCallMediaErrorMessage(new DOMException("Missing", "NotFoundError"))).toContain("Nenhum microfone");
  });
});
