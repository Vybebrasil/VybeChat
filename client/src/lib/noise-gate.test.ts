import { describe, expect, it } from "vitest";
import { DEFAULT_GATE_THRESHOLD, GATE_HOLD_MS, sensitivityToThreshold, shouldGateOpen } from "./noise-gate";

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
