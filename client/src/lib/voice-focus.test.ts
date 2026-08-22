import { describe, expect, it } from "vitest";
import { getLoopbackInputWarning, getVoiceFocusHoldMs, getVoiceFocusThreshold, shouldKeepVoiceGateOpen } from "./voice-focus";

describe("voice focus", () => {
  it("identifica entradas que tipicamente espelham o áudio do sistema", () => {
    expect(getLoopbackInputWarning("Stereo Mix (Realtek Audio)")).toContain("áudio do sistema");
    expect(getLoopbackInputWarning("BlackHole 2ch")).toContain("áudio do sistema");
    expect(getLoopbackInputWarning("Microfone USB")).toBeNull();
  });

  it("mantém a fala aberta por uma janela curta e torna o modo forte mais seletivo", () => {
    expect(getVoiceFocusThreshold("strong")).toBeGreaterThan(getVoiceFocusThreshold("balanced"));
    expect(shouldKeepVoiceGateOpen(0, 1_000, 1_200, "balanced")).toBe(true);
    expect(shouldKeepVoiceGateOpen(0, 1_000, 1_600, "balanced")).toBe(false);
    expect(getVoiceFocusHoldMs("strong")).toBeLessThan(getVoiceFocusHoldMs("balanced"));
  });
});
