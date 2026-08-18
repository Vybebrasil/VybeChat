export type VoiceRoomMember = {
  socketId: string;
  userId: string;
  name: string;
  status: "online" | "away" | "offline";
  isMuted: boolean;
  isSpeaking: boolean;
};

export type VoiceRoomSnapshot = {
  channelId: number;
  members: VoiceRoomMember[];
};

export function buildVoiceRoomSnapshots(
  entries: Array<[string, Map<string, VoiceRoomMember>]>
): VoiceRoomSnapshot[] {
  return entries
    .map(([channelId, members]) => ({
      channelId: Number(channelId),
      members: Array.from(members.values()),
    }))
    .filter(room => Number.isInteger(room.channelId) && room.channelId > 0 && room.members.length > 0);
}

export function updateVoiceMemberAudio(member: VoiceRoomMember, isMuted: boolean, isSpeaking: boolean): VoiceRoomMember {
  return {
    ...member,
    isMuted,
    isSpeaking: isMuted ? false : isSpeaking,
  };
}
