import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { CALL_AUDIO_CONSTRAINTS, CALL_VIDEO_CONSTRAINTS, getCallConstraints, getCallMedia, getCallMediaErrorMessage, isMissingDeviceError } from "./call-media";

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

  it("aplica os dispositivos escolhidos sem remover as proteções de áudio", () => {
    expect(getCallConstraints({ audioInputId: "microfone-vybe", videoInputId: "camera-vybe" })).toEqual({
      audio: expect.objectContaining({ deviceId: { exact: "microfone-vybe" }, echoCancellation: true }),
      video: expect.objectContaining({ deviceId: { exact: "camera-vybe" }, width: { ideal: 1280 } }),
    });
  });

  it("provides specific recovery guidance for common microphone failures", () => {
    expect(getCallMediaErrorMessage(new DOMException("Denied", "NotAllowedError"))).toContain("Permita o acesso ao microfone");
    expect(getCallMediaErrorMessage(new DOMException("Missing", "NotFoundError"))).toContain("Nenhum microfone");
  });
});

describe("entrar sem microfone", () => {
  const semDispositivo = () => new DOMException("Requested device not found", "NotFoundError");

  // O ambiente de teste nao tem MediaStream; o navegador sempre tem.
  beforeAll(() => {
    vi.stubGlobal("MediaStream", class {
      getTracks() { return []; }
      getAudioTracks() { return []; }
      getVideoTracks() { return []; }
    });
  });
  afterAll(() => vi.unstubAllGlobals());

  it("entra em modo de escuta quando não há microfone nenhum", async () => {
    const getUserMedia = vi.fn().mockRejectedValue(semDispositivo());
    const resultado = await getCallMedia({ getUserMedia } as unknown as MediaDevices);
    // Antes isto lançava e a pessoa simplesmente não conseguia entrar na sala.
    expect(resultado.mode).toBe("listen-only");
    expect(resultado.stream.getTracks()).toHaveLength(0);
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it("entra em modo de escuta quando a permissão foi negada", async () => {
    const getUserMedia = vi.fn().mockRejectedValue(new DOMException("Permission denied", "NotAllowedError"));
    expect((await getCallMedia({ getUserMedia } as unknown as MediaDevices)).mode).toBe("listen-only");
  });

  it("ainda prefere áudio quando o microfone existe e só a câmera falha", async () => {
    const comAudio = { getTracks: () => [{ kind: "audio" }], getAudioTracks: () => [{ kind: "audio" }] } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockRejectedValueOnce(semDispositivo()).mockResolvedValueOnce(comAudio);
    expect((await getCallMedia({ getUserMedia } as unknown as MediaDevices)).mode).toBe("audio-only");
  });

  it("propaga erro inesperado em vez de mascarar como modo de escuta", async () => {
    const getUserMedia = vi.fn().mockRejectedValue(new TypeError("constraints inválidas"));
    await expect(getCallMedia({ getUserMedia } as unknown as MediaDevices)).rejects.toThrow("constraints inválidas");
  });

  it("classifica os erros que justificam modo de escuta", () => {
    expect(isMissingDeviceError(semDispositivo())).toBe(true);
    expect(isMissingDeviceError(new DOMException("busy", "NotReadableError"))).toBe(true);
    expect(isMissingDeviceError(new TypeError("outro"))).toBe(false);
  });
});
