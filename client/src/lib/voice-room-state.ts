export type VoiceRoomMember = {
  socketId: string;
  userId: string;
  name: string;
  status: "online" | "away" | "offline";
  isMuted?: boolean;
  isSpeaking?: boolean;
};

export type VoiceRoom = {
  channelId: number;
  members: VoiceRoomMember[];
};

export function indexVoiceRooms(rooms: VoiceRoom[]) {
  return Object.fromEntries(rooms.map(room => [room.channelId, room.members])) as Record<number, VoiceRoomMember[]>;
}

export function getVoiceJoinAction(activeChannelId: number | null, targetChannelId: number) {
  if (activeChannelId === targetChannelId) return "already-joined" as const;
  return activeChannelId ? "move" as const : "join" as const;
}
