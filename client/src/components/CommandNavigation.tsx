import React from "react";
import { AtSign, Hash, MicOff, Volume2 } from "lucide-react";
import { formatBadge, type UnreadMap } from "@/lib/unread";
import { iniciais } from "@/lib/team-roster";

type Member = { socketId: string; name: string; photo?: string; isMuted?: boolean; isSpeaking?: boolean };
type Channel = { id: number; name: string; type: "text" | "voice" };
type Group = { name: string; channels: Channel[] };

type Props = {
  groups: Group[];
  selectedChannelId: number;
  voiceRooms: Record<number, Member[]>;
  onSelectText: (channelId: number) => void;
  onJoinVoice: (channelId: number) => void;
  unread?: UnreadMap;
};

export function CommandNavigation({ groups, selectedChannelId, voiceRooms, onSelectText, onJoinVoice, unread = {} }: Props) {
  return <nav className="command-navigation" aria-label="Canais e salas de voz">
    {groups.map(group => <section key={group.name} className="command-nav-group">
      <p>{group.name}</p>
      {group.channels.map(channel => {
        const members = voiceRooms[channel.id] ?? [];
        const active = selectedChannelId === channel.id;
        const pendente = unread[channel.id];
        return <div key={channel.id} className="command-nav-channel">
          <button onClick={() => channel.type === "voice" ? onJoinVoice(channel.id) : onSelectText(channel.id)} className={active ? "is-active" : ""}>
            {channel.type === "voice" ? <Volume2 className="size-4" /> : <Hash className="size-4" />}<span className={pendente && !active ? "font-semibold text-orange-50" : ""}>{channel.name}</span>
            {pendente && !active && (pendente.mentioned
              ? <span title="Você foi citado" className="ml-auto flex items-center gap-1 rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-black"><AtSign className="size-3" />{formatBadge(pendente.count)}</span>
              : <span title={`${pendente.count} não lidas`} className="ml-auto rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-bold text-orange-50">{formatBadge(pendente.count)}</span>)}
            {channel.type === "voice" && members.length > 0 && <em>{String(members.length).padStart(2, "0")}</em>}
          </button>
          {members.map(member => <div key={member.socketId} className="command-voice-member">
            {member.photo
              ? <img src={member.photo} alt="" loading="lazy" className={`size-4 shrink-0 rounded-full object-cover ${member.isSpeaking ? "ring-2 ring-emerald-400" : ""}`} />
              : <span className={`grid size-4 shrink-0 place-items-center rounded-full bg-orange-400/15 text-[8px] font-bold text-orange-100 ${member.isSpeaking ? "ring-2 ring-emerald-400" : ""}`}>{iniciais(member.name)}</span>}
            <span>{member.name}</span>{member.isMuted && <MicOff className="ml-auto size-3" />}
          </div>)}
        </div>;
      })}
    </section>)}
  </nav>;
}
