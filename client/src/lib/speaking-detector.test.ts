import { describe, expect, it } from "vitest";
import { getAudioLevel, isSpeakingNow, SPEAKING_RELEASE_MS, SPEAKING_THRESHOLD } from "./speaking-detector";

function tom(amplitude: number, tamanho = 512) {
  const samples = new Uint8Array(tamanho);
  for (let index = 0; index < tamanho; index += 1) {
    samples[index] = Math.round(128 + Math.sin((index / tamanho) * Math.PI * 8) * amplitude * 127);
  }
  return samples;
}

describe("detecção de fala", () => {
  it("silêncio fica perto de zero", () => {
    expect(getAudioLevel(new Uint8Array(512).fill(128))).toBeCloseTo(0, 5);
  });

  it("voz em volume normal passa do limiar", () => {
    expect(getAudioLevel(tom(0.35))).toBeGreaterThan(SPEAKING_THRESHOLD);
  });

  it("ruído de fundo baixo não passa do limiar", () => {
    expect(getAudioLevel(tom(0.02))).toBeLessThan(SPEAKING_THRESHOLD);
  });

  it("array vazio não quebra", () => {
    expect(getAudioLevel(new Uint8Array(0))).toBe(0);
  });

  it("segura o estado entre sílabas para o indicador não piscar", () => {
    const agora = 10_000;
    expect(isSpeakingNow({ level: 0, wasSpeaking: true, lastAboveAt: agora - 200, now: agora })).toBe(true);
    expect(isSpeakingNow({ level: 0, wasSpeaking: true, lastAboveAt: agora - SPEAKING_RELEASE_MS - 1, now: agora })).toBe(false);
  });

  it("não acende sozinho a partir do silêncio", () => {
    expect(isSpeakingNow({ level: 0, wasSpeaking: false, lastAboveAt: 0, now: 10_000 })).toBe(false);
  });
});
