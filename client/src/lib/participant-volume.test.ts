import { describe, expect, it } from "vitest";
import { normalizeParticipantVolume, toMediaElementVolume } from "./participant-volume";

describe("participant volume", () => {
  it("keeps each participant volume within the supported 0–150% range", () => {
    expect(normalizeParticipantVolume(-20)).toBe(0);
    expect(normalizeParticipantVolume(78.6)).toBe(79);
    expect(normalizeParticipantVolume(220)).toBe(150);
  });

  it("converts the interface percentage into the media element volume value", () => {
    expect(toMediaElementVolume(50)).toBe(0.5);
    expect(toMediaElementVolume(150)).toBe(1.5);
  });
});
