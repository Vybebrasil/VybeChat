import { describe, expect, it } from "vitest";
import { dayLabel, formatMessageTime, needsDaySeparator } from "./message-time";

const agora = new Date("2026-08-21T15:30:00");

describe("horário das mensagens", () => {
  it("hoje mostra só a hora", () => {
    expect(formatMessageTime("2026-08-21T09:05:00", agora)).toBe("09:05");
  });

  it("ontem é dito por extenso, não por data", () => {
    expect(formatMessageTime("2026-08-20T22:10:00", agora)).toMatch(/^Ontem/);
  });

  it("dentro da semana mostra o dia", () => {
    const texto = formatMessageTime("2026-08-18T11:00:00", agora);
    expect(texto).toMatch(/11:00$/);
    expect(texto).not.toMatch(/^Ontem/);
  });

  it("mais antigo mostra a data", () => {
    expect(formatMessageTime("2026-07-02T08:00:00", agora)).toMatch(/02\/07/);
  });

  it("data inválida não quebra a conversa", () => {
    expect(formatMessageTime("nao-e-data", agora)).toBe("");
    expect(dayLabel("nao-e-data", agora)).toBe("");
  });
});

describe("separador de dia", () => {
  it("a primeira mensagem sempre abre um dia", () => {
    expect(needsDaySeparator("2026-08-21T09:00:00")).toBe(true);
  });

  it("mensagens do mesmo dia não repetem o separador", () => {
    expect(needsDaySeparator("2026-08-21T09:00:00", "2026-08-21T08:00:00")).toBe(false);
  });

  it("virou o dia, entra o separador", () => {
    expect(needsDaySeparator("2026-08-21T00:10:00", "2026-08-20T23:50:00")).toBe(true);
  });

  it("rotula hoje e ontem por extenso", () => {
    expect(dayLabel("2026-08-21T10:00:00", agora)).toBe("Hoje");
    expect(dayLabel("2026-08-20T10:00:00", agora)).toBe("Ontem");
    expect(dayLabel("2026-06-01T10:00:00", agora)).toMatch(/junho/);
  });
});
