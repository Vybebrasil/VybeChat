import { describe, expect, it } from "vitest";
import { hasCollision, isPolitePeer, shouldIgnoreOffer, shouldRestartIce, shouldScheduleRestart } from "./peer-negotiation";

describe("negociação entre pares", () => {
  it("elege exatamente um lado educado para qualquer par", () => {
    const a = "3f2b1c";
    const b = "9d8e7f";
    expect(isPolitePeer(a, b)).not.toBe(isPolitePeer(b, a));
  });

  it("numa colisão o educado cede e o impaciente mantém a própria oferta", () => {
    const colisão = { makingOffer: true, signalingState: "have-local-offer" as RTCSignalingState };
    expect(shouldIgnoreOffer({ polite: true, ...colisão })).toBe(false);
    expect(shouldIgnoreOffer({ polite: false, ...colisão })).toBe(true);
  });

  it("sem colisão ninguém ignora a oferta, dos dois lados", () => {
    const tranquilo = { makingOffer: false, signalingState: "stable" as RTCSignalingState };
    expect(shouldIgnoreOffer({ polite: true, ...tranquilo })).toBe(false);
    expect(shouldIgnoreOffer({ polite: false, ...tranquilo })).toBe(false);
  });

  it("detecta colisão tanto por oferta em voo quanto por estado não estável", () => {
    expect(hasCollision({ makingOffer: true, signalingState: "stable" })).toBe(true);
    expect(hasCollision({ makingOffer: false, signalingState: "have-remote-offer" })).toBe(true);
    expect(hasCollision({ makingOffer: false, signalingState: "stable" })).toBe(false);
  });

  it("reinicia na hora em failed e apenas agenda em disconnected", () => {
    expect(shouldRestartIce("failed")).toBe(true);
    expect(shouldRestartIce("disconnected")).toBe(false);
    expect(shouldScheduleRestart("disconnected")).toBe(true);
    expect(shouldScheduleRestart("connected")).toBe(false);
    expect(shouldScheduleRestart("failed")).toBe(false);
  });

  it("o par que antes ficava surdo agora resolve a colisão", () => {
    // Os dois lados detectam `failed` e ofertam ao mesmo tempo. Antes os dois
    // chamavam setRemoteDescription com oferta local pendente e explodiam.
    const paulo = "aaa111";
    const vinicius = "bbb222";
    const emColisao = { makingOffer: true, signalingState: "have-local-offer" as RTCSignalingState };

    const pauloIgnora = shouldIgnoreOffer({ polite: isPolitePeer(paulo, vinicius), ...emColisao });
    const viniciusIgnora = shouldIgnoreOffer({ polite: isPolitePeer(vinicius, paulo), ...emColisao });

    // Exatamente um aceita: a negociação converge em vez de travar.
    expect([pauloIgnora, viniciusIgnora].filter(Boolean)).toHaveLength(1);
  });
});
