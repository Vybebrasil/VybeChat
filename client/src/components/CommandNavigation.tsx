import React from "react";
import { Hash, MicOff, Volume2 } from "lucide-react";

type Member = { socketId: string; name: string; isMuted?: boolean; isSpeaking?: boolean };
type Channel = { id: number; name: string; type: "text" | "voice" };
type Group = { name: string; channels: Channel[] };

type Props = {
  groups: Group[];
  selectedChannelId: number;
  voiceRooms: Record<number, Member[]>;
  onSelectText: (channelId: number) => void;
  onJoinVoice: (channelId: number) => void;
};

export function CommandNavigation({ groups, selectedChannelId, voiceRooms, onSelectText, onJoinVoice }: Props) {
  return <nav className="command-navigation" aria-label="Canais e salas de voz">
    {groups.map(group => <section key={group.name} className="command-nav-group">
      <p>// {group.name}</p>
      {group.channels.map(channel => {
        const members = voiceRooms[channel.id] ?? [];
        const active = selectedChannelId === channel.id;
        return <div key={channel.id} className="command-nav-channel">
          <button onClick={() => channel.type === "voice" ? onJoinVoice(channel.id) : onSelectText(channel.id)} className={active ? "is-active" : ""}>
            {channel.type === "voice" ? <Volume2 className="size-4" /> : <Hash className="size-4" />}<span>{channel.name}</span>
            {channel.type === "voice" && members.length > 0 && <em>{String(members.length).padStart(2, "0")}</em>}
          </button>
          {members.map(member => <div key={member.socketId} className="command-voice-member"><i className={member.isSpeaking ? "is-speaking" : ""} /><span>{member.name}</span>{member.isMuted && <MicOff className="ml-auto size-3" />}</div>)}
        </div>;
      })}
    </section>)}
  </nav>;
}
