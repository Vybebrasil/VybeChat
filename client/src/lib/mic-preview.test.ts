import { describe, expect, it } from "vitest";
import { judgePeak, METER_FULL_SCALE, passesGate, toMeterPercent, VERDICT_TEXT } from "./mic-preview";
import { sensitivityToThreshold } from "./noise-gate";

describe("medidor na mesma escala do controle", () => {
  it("o topo do medidor bate com o topo do controle de sensibilidade", () => {
    // É isto que dá sentido ao número: 100 no medidor é o mesmo ponto que 100
    // no controle. Antes o medidor usava outra escala e "16%" não dizia nada.
    expect(toMeterPercent(METER_FULL_SCALE)).toBe(100);
    expect(sensitivityToThreshold(100)).toBeCloseTo(METER_FULL_SCALE, 5);
  });

  it("um mesmo nível vira o mesmo número nos dois lados", () => {
    const sensibilidade = 40;
    const limiar = sensitivityToThreshold(sensibilidade);
    expect(toMeterPercent(limiar)).toBe(sensibilidade);
  });

  it("silêncio marca zero e valores inválidos não quebram", () => {
    expect(toMeterPercent(0)).toBe(0);
    expect(toMeterPercent(-1)).toBe(0);
    expect(toMeterPercent(Number.NaN)).toBe(0);
  });

  it("nível acima do teto não passa de 100", () => {
    expect(toMeterPercent(5)).toBe(100);
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
