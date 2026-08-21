import { describe, expect, it } from "vitest";
import { judgePeak, METER_FLOOR_DB, passesGate, sensitivityToDb, toDbfs, toMeterPercent, VERDICT_TEXT } from "./mic-preview";


describe("medidor em decibéis, na mesma escala do controle", () => {
  it("nível máximo enche a barra e silêncio fica no zero", () => {
    expect(toMeterPercent(1)).toBe(100);
    expect(toMeterPercent(0)).toBe(0);
  });

  it("um mesmo ponto vira o mesmo número nos dois lados", () => {
    // É isto que dá sentido ao número: 40 no controle é 40 na barra.
    for (const posicao of [10, 25, 40, 70]) {
      const db = sensitivityToDb(posicao);
      const rms = Math.pow(10, db / 20);
      expect(toMeterPercent(rms)).toBe(posicao);
    }
  });

  it("fala normal ocupa um pedaço visível da barra", () => {
    // Em escala linear a fala mal saía do canto e a barra parecia morta.
    // Voz de conversa fica por volta de -30 dBFS.
    const falaNormal = Math.pow(10, -30 / 20);
    expect(toMeterPercent(falaNormal)).toBeGreaterThan(40);
    expect(toMeterPercent(falaNormal)).toBeLessThan(60);
  });

  it("sala silenciosa fica perto do zero, sem encostar", () => {
    const salaQuieta = Math.pow(10, -55 / 20);
    expect(toMeterPercent(salaQuieta)).toBeLessThan(12);
    expect(toMeterPercent(salaQuieta)).toBeGreaterThan(0);
  });

  it("valores inválidos e abaixo do piso não quebram", () => {
    expect(toDbfs(Number.NaN)).toBe(METER_FLOOR_DB);
    expect(toDbfs(-1)).toBe(METER_FLOOR_DB);
    expect(toMeterPercent(Number.NaN)).toBe(0);
  });

  it("acima do máximo não passa de 100", () => {
    expect(toMeterPercent(50)).toBe(100);
  });
});

describe("a voz passa do corte?", () => {
  it("passa quando o medidor está acima do corte", () => {
    expect(passesGate(30, 16)).toBe(true);
  });

  it("não passa quando está abaixo", () => {
    expect(passesGate(9, 16)).toBe(false);
  });

  it("corte desligado deixa tudo passar", () => {
    expect(passesGate(0, 0)).toBe(true);
  });

  it("no limite exato, passa", () => {
    expect(passesGate(16, 16)).toBe(true);
  });
});

describe("veredito do nível de voz", () => {
  it("classifica sem som, baixo, bom e alto", () => {
    expect(judgePeak(2)).toBe("sem-som");
    expect(judgePeak(12)).toBe("baixo");
    expect(judgePeak(55)).toBe("bom");
    expect(judgePeak(98)).toBe("alto");
  });

  it("todo veredito tem uma orientação em texto", () => {
    for (const veredito of ["sem-som", "baixo", "bom", "alto"] as const) {
      expect(VERDICT_TEXT[veredito].length).toBeGreaterThan(10);
    }
  });
});
