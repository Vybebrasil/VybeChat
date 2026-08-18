import { describe, expect, it } from "vitest";
import { getVoiceJoinAction, indexVoiceRooms } from "./voice-room-state";

describe("voice room state", () => {
  it("chooses the correct direct-entry action for an unjoined, active and different room", () => {
    expect(getVoiceJoinAction(null, 8)).toBe("join");
    expect(getVoiceJoinAction(8, 8)).toBe("already-joined");
    expect(getVoiceJoinAction(8, 12)).toBe("move");
  });

  it("indexes the realtime room snapshots by channel for sidebar rendering", () => {
    expect(indexVoiceRooms([
      { channelId: 8, members: [{ socketId: "a", userId: "1", name: "Bia", status: "online", isMuted: false, isSpeaking: true }] },
      { channelId: 12, members: [{ socketId: "b", userId: "2", name: "Deivid", status: "away", isMuted: true, isSpeaking: false }] },
    ])).toEqual({
      8: [{ socketId: "a", userId: "1", name: "Bia", status: "online", isMuted: false, isSpeaking: true }],
      12: [{ socketId: "b", userId: "2", name: "Deivid", status: "away", isMuted: true, isSpeaking: false }],
    });
  });
});
