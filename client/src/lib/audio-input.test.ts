import { describe, expect, it, vi } from "vitest";
import { getSelectedAudioTrack, listAudioInputs } from "./audio-input";

describe("entradas de áudio", () => {
  it("lista somente microfones e fornece nome de fallback", async () => {
    const inputs = await listAudioInputs({ enumerateDevices: vi.fn().mockResolvedValue([
      { kind: "videoinput", deviceId: "cam", label: "Câmera" },
      { kind: "audioinput", deviceId: "mic-1", label: "Microfone USB" },
      { kind: "audioinput", deviceId: "mic-2", label: "" },
    ]) } as unknown as Pick<MediaDevices, "enumerateDevices">);
    expect(inputs).toEqual([{ deviceId: "mic-1", label: "Microfone USB" }, { deviceId: "mic-2", label: "Microfone 2" }]);
  });

  it("solicita um microfone específico com tratamento de áudio", async () => {
    const track = { kind: "audio" } as MediaStreamTrack;
    const getUserMedia = vi.fn().mockResolvedValue({ getAudioTracks: () => [track] });
    await expect(getSelectedAudioTrack({ getUserMedia }, "mic-1")).resolves.toMatchObject({ track });
    expect(getUserMedia.mock.calls[0][0].audio).toMatchObject({ deviceId: { exact: "mic-1" }, echoCancellation: true, noiseSuppression: true, autoGainControl: true });
  });
});
