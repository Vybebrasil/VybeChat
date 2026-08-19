import { Bell, Pin, Reply, Search, SmilePlus, UserPlus, Volume2, X } from "lucide-react";
import React, { useMemo, useState } from "react";

export type CollaborationMessage = {
  id: string;
  channelId: number;
  userId: string;
  authorName: string;
  content: string;
  createdAt: string;
  parentId?: string | null;
  reactions?: Record<string, string[]>;
};

export type CollaborationPresence = {
  userId: string;
  name: string;
  status: string;
  statusMessage?: string;
  role?: string;
};

type Props = {
  messages: CollaborationMessage[];
  pinnedIds: string[];
  presence: CollaborationPresence[];
  profileId: string;
  profileName: string;
  status: string;
  statusMessage: string;
  searchQuery: string;
  searchResults: CollaborationMessage[];
  activeCall: boolean;
  pushToTalkEnabled: boolean;
  pushToTalkKey: "Space" | "KeyV";
  isTransmitting: boolean;
  canManage: boolean;
  readOnly: boolean;
  invitePolicy: "admin" | "member";
  onStatusChange: (status: "online" | "away" | "offline" | "focus" | "meeting", message: string) => void;
  onSearch: (query: string) => void;
  onReact: (messageId: string, emoji: string) => void;
  onPin: (messageId: string) => void;
  onReply: (message: CollaborationMessage) => void;
  onInvite: (userId: string) => void;
  onTogglePushToTalk: () => void;
  onPushToTalkKeyChange: (key: "Space" | "KeyV") => void;
  onToggleReadOnly: () => void;
  onSetRole: (userId: string, role: "admin" | "moderator" | "member") => void;
  onToggleInvitePolicy: () => void;
};

export function CollaborationDrawer(props: Props) {
  const [open, setOpen] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const pins = useMemo(() => props.messages.filter(message => props.pinnedIds.includes(message.id)), [props.messages, props.pinnedIds]);
  const threadCount = useMemo(() => Object.values(props.messages.reduce<Record<string, number>>((counts, message) => {
    if (message.parentId) counts[message.parentId] = (counts[message.parentId] ?? 0) + 1;
    return counts;
  }, {})).reduce((sum, count) => sum + count, 0), [props.messages]);
  const activeThread = useMemo(() => props.messages.find(message => message.id === activeThreadId) ?? null, [activeThreadId, props.messages]);
  const threadReplies = useMemo(() => activeThread ? props.messages.filter(message => message.parentId === activeThread.id) : [], [activeThread, props.messages]);

  return <>
    <button onClick={() => setOpen(true)} className="fixed bottom-4 left-4 z-20 flex items-center gap-2 border border-orange-300/30 bg-[#0d0e12]/95 px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-orange-100 shadow-xl backdrop-blur"><Bell className="size-4 text-orange-400" />Central</button>
    {open && <section className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-md flex-col border-l border-orange-300/25 bg-[#0b0c10]/98 p-4 shadow-2xl backdrop-blur sm:p-5">
      <header className="flex items-center justify-between border-b border-orange-300/15 pb-4"><div><p className="cyber-label">Colaboração / núcleo</p><h3 className="mt-1 [font-family:Orbitron] text-lg font-bold tracking-wide text-orange-50">CENTRAL DA EQUIPE</h3></div><button onClick={() => setOpen(false)} className="grid size-9 border border-orange-300/20 text-orange-100"><X className="size-4" /></button></header>
      <div className="mt-4 grid grid-cols-2 gap-2"><select value={props.status} onChange={event => props.onStatusChange(event.target.value as "online" | "away" | "offline" | "focus" | "meeting", props.statusMessage)} className="h-10 rounded-none border border-orange-300/20 bg-black/40 px-2 text-xs text-orange-50"><option value="online">Disponível</option><option value="focus">Em foco</option><option value="meeting">Em reunião</option><option value="away">Ausente</option></select><input value={props.statusMessage} onChange={event => props.onStatusChange(props.status as "online" | "away" | "offline" | "focus" | "meeting", event.target.value)} placeholder="Status personalizado" className="h-10 min-w-0 rounded-none border border-orange-300/20 bg-black/40 px-2 text-xs text-orange-50 placeholder:text-stone-600" /></div>
      <div className="mt-3 flex items-center gap-2 border border-orange-300/20 bg-black/30 px-3"><Search className="size-4 text-orange-400" /><input value={props.searchQuery} onChange={event => props.onSearch(event.target.value)} placeholder="Buscar transmissões" className="h-10 min-w-0 flex-1 bg-transparent text-sm text-orange-50 outline-none placeholder:text-stone-600" /></div>
      {props.searchResults.length > 0 && <div className="mt-2 max-h-28 overflow-y-auto border border-orange-300/15 bg-orange-400/[.03] p-2">{props.searchResults.map(message => <p key={message.id} className="mb-1 text-xs text-stone-300"><b className="text-orange-200">{message.authorName}:</b> {message.content}</p>)}</div>}
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2"><button onClick={props.onTogglePushToTalk} className={`flex h-11 items-center justify-between border px-3 font-mono text-[11px] font-bold uppercase tracking-wide ${props.isTransmitting ? "border-orange-200 bg-orange-400 text-black" : props.pushToTalkEnabled ? "border-orange-300/45 bg-orange-400/12 text-orange-100" : "border-orange-300/20 bg-white/4 text-stone-300"}`}><span className="flex items-center gap-2"><Volume2 className="size-4" />Push-to-talk</span><span className="font-mono text-[10px]">{props.isTransmitting ? "Transmitindo" : props.pushToTalkEnabled ? "Pronto" : "Off"}</span></button><select value={props.pushToTalkKey} onChange={event => props.onPushToTalkKeyChange(event.target.value as "Space" | "KeyV")} className="border border-orange-300/20 bg-black/40 px-2 text-xs text-orange-50"><option value="Space">Espaço</option><option value="KeyV">V</option></select></div>
      {props.canManage && <div className="mt-2 grid grid-cols-2 gap-2"><button onClick={props.onToggleReadOnly} className={`h-9 border font-mono text-[9px] font-bold uppercase tracking-wide ${props.readOnly ? "border-orange-300/50 bg-orange-400/12 text-orange-100" : "border-orange-300/15 bg-white/4 text-stone-300"}`}>Moderação: {props.readOnly ? "bloqueada" : "aberta"}</button><button onClick={props.onToggleInvitePolicy} className="h-9 border border-orange-300/15 bg-white/4 font-mono text-[9px] font-bold uppercase tracking-wide text-stone-300">Convites: {props.invitePolicy === "admin" ? "admin" : "equipe"}</button></div>}
      <div className="mt-4 grid min-h-0 flex-1 grid-rows-[auto_auto_1fr] gap-4 overflow-hidden"><section className="border-l border-orange-300/25 pl-3"><div className="flex items-center justify-between"><p className="cyber-label"><Pin className="mr-1 inline size-3.5" />Fixados ({pins.length})</p><span className="font-mono text-[9px] text-stone-500">{threadCount} threads</span></div><div className="mt-2 max-h-24 overflow-y-auto">{pins.length ? pins.map(message => <p key={message.id} className="mb-1 text-xs text-stone-400">{message.content}</p>) : <p className="text-xs text-stone-600">Nenhuma decisão fixada ainda.</p>}</div></section>
      <section><p className="cyber-label">Operadores e papéis</p><div className="mt-2 flex flex-wrap gap-2">{props.presence.filter(member => member.userId !== props.profileId).map(member => <div key={member.userId} className="flex items-center gap-1.5 border border-orange-300/15 bg-white/3 px-2 py-1.5 text-[11px] text-stone-200"><button onClick={() => props.onInvite(member.userId)} disabled={!props.activeCall} className="flex items-center gap-1 disabled:opacity-40"><UserPlus className="size-3.5 text-orange-300" />{member.name}</button>{props.canManage ? <select value={["admin", "moderator"].includes(member.role ?? "") ? member.role : "member"} onChange={event => props.onSetRole(member.userId, event.target.value as "admin" | "moderator" | "member")} className="bg-black/40 px-1 py-0.5 font-mono text-[8px] uppercase text-orange-200"><option value="member">membro</option><option value="moderator">moderador</option><option value="admin">admin</option></select> : <span className="border border-orange-300/20 bg-orange-400/8 px-1 py-0.5 font-mono text-[8px] uppercase text-orange-200">{member.role ?? "member"}</span>}</div>)}</div></section>
      <section className="min-h-0 overflow-y-auto">{activeThread ? <div className="mb-3 border border-orange-300/25 bg-orange-400/[.04] p-3"><div className="flex items-center justify-between"><p className="cyber-label">Thread / {activeThread.authorName}</p><button onClick={() => setActiveThreadId(null)} className="font-mono text-[10px] text-stone-400">Fechar</button></div><p className="mt-2 text-xs text-stone-300">{activeThread.content}</p><div className="mt-3 border-l border-orange-300/25 pl-3">{threadReplies.length ? threadReplies.map(reply => <p key={reply.id} className="mb-2 text-xs text-stone-400"><b className="text-orange-200">{reply.authorName}:</b> {reply.content}</p>) : <p className="text-xs text-stone-500">Ainda não há respostas nesta thread.</p>}</div><button onClick={() => props.onReply(activeThread)} className="mt-3 border border-orange-300/30 bg-orange-400/10 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-orange-100">Responder na thread</button></div> : <><p className="cyber-label mb-2">Mensagens recentes</p>{props.messages.filter(message => !message.parentId).slice(-20).reverse().map(message => <article key={message.id} className="mb-2 border border-orange-300/10 bg-white/[.025] p-2.5"><p className="font-mono text-[10px] font-bold uppercase tracking-wide text-orange-100">{message.authorName}</p><p className="mt-1 text-xs leading-5 text-stone-300">{message.content}</p><div className="mt-2 flex items-center gap-1"><button onClick={() => props.onReact(message.id, "👍")} className="border border-orange-300/15 bg-white/4 px-1.5 py-1 text-[11px]">👍 {message.reactions?.["👍"]?.length ?? 0}</button><button onClick={() => props.onReact(message.id, "🔥")} className="border border-orange-300/15 bg-white/4 px-1.5 py-1 text-[11px]">🔥 {message.reactions?.["🔥"]?.length ?? 0}</button><button onClick={() => { setActiveThreadId(message.id); props.onReply(message); }} className="ml-auto p-1 text-orange-200"><Reply className="size-3.5" /></button><button onClick={() => props.onPin(message.id)} className={`p-1 ${props.pinnedIds.includes(message.id) ? "text-orange-200" : "text-stone-500"}`}><Pin className="size-3.5" /></button></div></article>)}</>}</section></div>
    </section>}
  </>;
}
