import { describe, expect, it } from "vitest";
import { buildVoiceRoomSnapshots, updateVoiceMemberAudio } from "./voice-room.utils";

describe("voice room snapshots", () => {
  it("serializes occupied rooms and omits empty or invalid room entries", () => {
    const members = new Map([
      ["socket-1", { socketId: "socket-1", userId: "1", name: "Bia", status: "online" as const, isMuted: false, isSpeaking: true }],
      ["socket-2", { socketId: "socket-2", userId: "2", name: "Deivid", status: "away" as const, isMuted: true, isSpeaking: false }],
    ]);

    expect(buildVoiceRoomSnapshots([
      ["12", members],
      ["13", new Map()],
      ["invalid", members],
    ])).toEqual([
      { channelId: 12, members: Array.from(members.values()) },
    ]);
  });

  it("never leaves a muted participant marked as speaking", () => {
    const member = { socketId: "socket-1", userId: "1", name: "Bia", status: "online" as const, isMuted: false, isSpeaking: false };
    expect(updateVoiceMemberAudio(member, true, true)).toMatchObject({ isMuted: true, isSpeaking: false });
    expect(updateVoiceMemberAudio(member, false, true)).toMatchObject({ isMuted: false, isSpeaking: true });
  });
});
