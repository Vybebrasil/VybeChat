import { describe, expect, it, vi } from "vitest";
import { CALL_AUDIO_CONSTRAINTS, CALL_VIDEO_CONSTRAINTS, getCallMedia, getCallMediaErrorMessage } from "./call-media";

describe("call media acquisition", () => {
  it("falls back to audio-only when camera and microphone together are unavailable", async () => {
    const audioStream = {} as MediaStream;
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("Camera busy", "NotReadableError"))
      .mockResolvedValueOnce(audioStream);

    await expect(getCallMedia({ getUserMedia })).resolves.toEqual({ stream: audioStream, mode: "audio-only" });
    expect(getUserMedia).toHaveBeenNthCalledWith(1, { video: CALL_VIDEO_CONSTRAINTS, audio: CALL_AUDIO_CONSTRAINTS });
    expect(getUserMedia).toHaveBeenNthCalledWith(2, { video: false, audio: CALL_AUDIO_CONSTRAINTS });
  });

  it("solicita cancelamento de eco, supressão de ruído e ganho automático", () => {
    expect(CALL_AUDIO_CONSTRAINTS).toMatchObject({ echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 });
  });

  it("provides specific recovery guidance for common microphone failures", () => {
    expect(getCallMediaErrorMessage(new DOMException("Denied", "NotAllowedError"))).toContain("Permita o acesso ao microfone");
    expect(getCallMediaErrorMessage(new DOMException("Missing", "NotFoundError"))).toContain("Nenhum microfone");
  });
});
