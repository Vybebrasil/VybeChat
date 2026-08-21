import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { CALL_AUDIO_CONSTRAINTS, CALL_VIDEO_CONSTRAINTS, getCallConstraints, getCallMedia, getCallMediaErrorMessage, getCameraTrack, isMissingDeviceError } from "./call-media";

// O ambiente de teste nao tem MediaStream; o navegador sempre tem.
beforeAll(() => {
  vi.stubGlobal("MediaStream", class {
    getTracks() { return []; }
    getAudioTracks() { return []; }
    getVideoTracks() { return []; }
  });
});
afterAll(() => vi.unstubAllGlobals());

describe("call media acquisition", () => {
  it("cai para somente áudio quando a câmera é pedida e falha", async () => {
    const audioStream = {} as MediaStream;
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("Camera busy", "NotReadableError"))
      .mockResolvedValueOnce(audioStream);

    // `includeVideo` explícito: a entrada normal não pede vídeo nenhum.
    await expect(getCallMedia({ getUserMedia }, {}, { includeVideo: true })).resolves.toEqual({ stream: audioStream, mode: "audio-only" });
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


  it("entra em modo de escuta quando não há microfone nenhum", async () => {
    const getUserMedia = vi.fn().mockRejectedValue(semDispositivo());
    const resultado = await getCallMedia({ getUserMedia } as unknown as MediaDevices);
    // Antes isto lançava e a pessoa simplesmente não conseguia entrar na sala.
    expect(resultado.mode).toBe("listen-only");
    expect(resultado.stream.getTracks()).toHaveLength(0);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it("entra em modo de escuta quando a permissão foi negada", async () => {
    const getUserMedia = vi.fn().mockRejectedValue(new DOMException("Permission denied", "NotAllowedError"));
    expect((await getCallMedia({ getUserMedia } as unknown as MediaDevices)).mode).toBe("listen-only");
  });

  it("ainda prefere áudio quando o microfone existe e só a câmera falha", async () => {
    const comAudio = { getTracks: () => [{ kind: "audio" }], getAudioTracks: () => [{ kind: "audio" }] } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockRejectedValueOnce(semDispositivo()).mockResolvedValueOnce(comAudio);
    expect((await getCallMedia({ getUserMedia } as unknown as MediaDevices, {}, { includeVideo: true })).mode).toBe("audio-only");
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

describe("entrar sempre com a câmera desligada", () => {
  it("não pede vídeo ao entrar: só o microfone", async () => {
    const comAudio = { getTracks: () => [{ kind: "audio" }], getAudioTracks: () => [{ kind: "audio" }] } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(comAudio);
    const resultado = await getCallMedia({ getUserMedia } as unknown as MediaDevices);
    expect(resultado.mode).toBe("audio-only");
    // A luz da câmera não deve acender ao entrar numa sala.
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(getUserMedia.mock.calls[0][0]).toMatchObject({ video: false });
  });

  it("ainda permite pedir câmera junto quando explicitamente solicitado", async () => {
    const completo = { getTracks: () => [{ kind: "audio" }, { kind: "video" }] } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(completo);
    const resultado = await getCallMedia({ getUserMedia } as unknown as MediaDevices, {}, { includeVideo: true });
    expect(resultado.mode).toBe("camera-and-audio");
    expect(getUserMedia.mock.calls[0][0].video).not.toBe(false);
  });

  it("liga a câmera sob demanda pedindo só vídeo", async () => {
    const track = { kind: "video", id: "cam" };
    const stream = { getVideoTracks: () => [track] } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const resultado = await getCameraTrack({ getUserMedia } as unknown as MediaDevices);
    expect(resultado.track).toBe(track);
    expect(getUserMedia.mock.calls[0][0]).toMatchObject({ audio: false });
  });

  it("avisa quando o dispositivo não devolve câmera nenhuma", async () => {
    const getUserMedia = vi.fn().mockResolvedValue({ getVideoTracks: () => [] } as unknown as MediaStream);
    await expect(getCameraTrack({ getUserMedia } as unknown as MediaDevices)).rejects.toThrow(/câmera/i);
  });
});
