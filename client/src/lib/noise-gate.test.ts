// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createNoiseGate, DEFAULT_GATE_THRESHOLD, GATE_HOLD_MS, sensitivityToThreshold, shouldGateOpen } from "./noise-gate";

describe("portão de ruído", () => {
  const agora = 100_000;

  it("abre enquanto a pessoa fala acima do limiar", () => {
    expect(shouldGateOpen({ level: 0.08, threshold: DEFAULT_GATE_THRESHOLD, lastVoiceAt: 0, now: agora })).toBe(true);
  });

  it("fecha no silêncio, depois da janela de retenção", () => {
    expect(shouldGateOpen({ level: 0.001, threshold: DEFAULT_GATE_THRESHOLD, lastVoiceAt: agora - GATE_HOLD_MS - 1, now: agora })).toBe(false);
  });

  it("segura aberto entre frases para não cortar sílaba", () => {
    // Sem isto o microfone piscaria a cada pausa curta e cortaria o começo das palavras.
    expect(shouldGateOpen({ level: 0, threshold: DEFAULT_GATE_THRESHOLD, lastVoiceAt: agora - 300, now: agora })).toBe(true);
  });

  it("som de fundo baixo não abre o portão", () => {
    // O caso do jogo tocando na caixa de som durante o silêncio de quem fala.
    expect(shouldGateOpen({ level: 0.012, threshold: DEFAULT_GATE_THRESHOLD, lastVoiceAt: 0, now: agora })).toBe(false);
  });

  it("sensibilidade da interface vira limiar utilizável", () => {
    expect(sensitivityToThreshold(0)).toBe(0);
    expect(sensitivityToThreshold(100)).toBeCloseTo(0.12, 5);
    expect(sensitivityToThreshold(50)).toBeGreaterThan(sensitivityToThreshold(20));
  });

  it("valor fora da faixa não quebra o cálculo", () => {
    expect(sensitivityToThreshold(-40)).toBe(0);
    expect(sensitivityToThreshold(9999)).toBeCloseTo(0.12, 5);
  });

  it("limiar zero mantém o portão sempre aberto", () => {
    // É como a pessoa desliga o recurso sem precisar de outra opção.
    expect(shouldGateOpen({ level: 0, threshold: 0, lastVoiceAt: 0, now: agora })).toBe(true);
  });

  it("mais sensível corta mais som de fundo", () => {
    const fundo = 0.03;
    const brando = sensitivityToThreshold(10);
    const rigido = sensitivityToThreshold(40);
    expect(shouldGateOpen({ level: fundo, threshold: brando, lastVoiceAt: 0, now: agora })).toBe(true);
    expect(shouldGateOpen({ level: fundo, threshold: rigido, lastVoiceAt: 0, now: agora })).toBe(false);
  });
});

describe("o portão não pode ficar surdo ao fechar o microfone", () => {
  afterEach(() => vi.unstubAllGlobals());

  function ambiente() {
    const clonado = { kind: "audio", enabled: true, stop: vi.fn() };
    const track = { kind: "audio", enabled: true, clone: vi.fn(() => clonado), stop: vi.fn() };
    const stream = { getAudioTracks: () => [track] } as unknown as MediaStream;
    const source = { connect: vi.fn(), disconnect: vi.fn() };
    const analyser = { fftSize: 0, frequencyBinCount: 256, getByteTimeDomainData: vi.fn(), disconnect: vi.fn(), connect: vi.fn() };
    const criadoCom: MediaStream[] = [];

    vi.stubGlobal("MediaStream", class { constructor(public tracks: unknown[]) { criadoCom.push(this as unknown as MediaStream); } });
    vi.stubGlobal("AudioContext", class {
      createMediaStreamSource(input: unknown) { (source as unknown as { input: unknown }).input = input; return source; }
      createAnalyser() { return analyser; }
      close() { return Promise.resolve(); }
    });
    return { track, clonado, stream, source, criadoCom };
  }

  it("analisa um clone, não o track que ele mesmo desliga", () => {
    const { track, clonado, stream, source } = ambiente();
    const stop = createNoiseGate({ stream, getThreshold: () => DEFAULT_GATE_THRESHOLD, isEnabled: () => true });

    // Sem o clone, fechar o microfone silenciava também o analisador: o portão
    // nunca mais detectava fala e a pessoa ficava muda o resto da chamada.
    expect(track.clone).toHaveBeenCalledTimes(1);
    const entrada = (source as unknown as { input: { tracks: unknown[] } }).input;
    expect(entrada.tracks).toEqual([clonado]);
    stop?.();
  });

  it("solta o clone e devolve o microfone ao desmontar", () => {
    const { track, clonado, stream } = ambiente();
    const stop = createNoiseGate({ stream, getThreshold: () => DEFAULT_GATE_THRESHOLD, isEnabled: () => true });
    track.enabled = false;
    stop?.();
    expect(clonado.stop).toHaveBeenCalled();
    expect(track.enabled).toBe(true);
  });

  it("sem faixa de áudio não tenta nada", () => {
    const stream = { getAudioTracks: () => [] } as unknown as MediaStream;
    expect(createNoiseGate({ stream, getThreshold: () => 0.02, isEnabled: () => true })).toBeNull();
  });
});
