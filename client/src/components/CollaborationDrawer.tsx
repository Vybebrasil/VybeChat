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
    <button onClick={() => setOpen(true)} className="fixed bottom-4 left-4 z-20 flex items-center gap-2 rounded-xl border border-violet-300/20 bg-[#171120]/95 px-3 py-2 text-xs font-semibold text-violet-100 shadow-xl backdrop-blur"><Bell className="size-4" />Central</button>
    {open && <section className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-md flex-col border-l border-violet-300/15 bg-[#110d18]/98 p-4 shadow-2xl backdrop-blur sm:p-5">
      <header className="flex items-center justify-between"><div><p className="font-mono text-[10px] font-bold uppercase tracking-[.16em] text-violet-300">Colaboração</p><h3 className="mt-1 text-lg font-extrabold text-white">Central da equipe</h3></div><button onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-lg bg-white/6 text-slate-200"><X className="size-4" /></button></header>
      <div className="mt-4 grid grid-cols-2 gap-2"><select value={props.status} onChange={event => props.onStatusChange(event.target.value as "online" | "away" | "offline" | "focus" | "meeting", props.statusMessage)} className="h-10 rounded-lg border border-white/10 bg-black/25 px-2 text-xs text-white"><option value="online">Disponível</option><option value="focus">Em foco</option><option value="meeting">Em reunião</option><option value="away">Ausente</option></select><input value={props.statusMessage} onChange={event => props.onStatusChange(props.status as "online" | "away" | "offline" | "focus" | "meeting", event.target.value)} placeholder="Status personalizado" className="h-10 min-w-0 rounded-lg border border-white/10 bg-black/25 px-2 text-xs text-white" /></div>
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3"><Search className="size-4 text-slate-500" /><input value={props.searchQuery} onChange={event => props.onSearch(event.target.value)} placeholder="Buscar mensagens" className="h-10 min-w-0 flex-1 bg-transparent text-sm text-white outline-none" /></div>
      {props.searchResults.length > 0 && <div className="mt-2 max-h-28 overflow-y-auto rounded-xl border border-white/8 bg-white/[.03] p-2">{props.searchResults.map(message => <p key={message.id} className="mb-1 text-xs text-slate-300"><b className="text-violet-200">{message.authorName}:</b> {message.content}</p>)}</div>}
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2"><button onClick={props.onTogglePushToTalk} className={`flex h-11 items-center justify-between rounded-xl px-3 text-sm font-bold ${props.isTransmitting ? "bg-emerald-400 text-slate-950" : props.pushToTalkEnabled ? "bg-emerald-400/18 text-emerald-100" : "bg-white/7 text-slate-200"}`}><span className="flex items-center gap-2"><Volume2 className="size-4" />Push-to-talk</span><span className="font-mono text-[10px]">{props.isTransmitting ? "TRANSMITINDO" : props.pushToTalkEnabled ? "PRONTO" : "OFF"}</span></button><select value={props.pushToTalkKey} onChange={event => props.onPushToTalkKeyChange(event.target.value as "Space" | "KeyV")} className="rounded-xl border border-white/10 bg-black/25 px-2 text-xs text-white"><option value="Space">Espaço</option><option value="KeyV">V</option></select></div>
      {props.canManage && <div className="mt-2 grid grid-cols-2 gap-2"><button onClick={props.onToggleReadOnly} className={`h-9 rounded-lg border text-xs font-bold ${props.readOnly ? "border-amber-300/30 bg-amber-300/10 text-amber-100" : "border-white/10 bg-white/5 text-slate-300"}`}>Moderação: {props.readOnly ? "somente leitura" : "canal aberto"}</button><button onClick={props.onToggleInvitePolicy} className="h-9 rounded-lg border border-white/10 bg-white/5 text-xs font-bold text-slate-300">Convites: {props.invitePolicy === "admin" ? "só admin" : "equipe"}</button></div>}
      <div className="mt-4 grid min-h-0 flex-1 grid-rows-[auto_auto_1fr] gap-4 overflow-hidden"><section><div className="flex items-center justify-between"><p className="text-xs font-bold text-slate-300"><Pin className="mr-1 inline size-3.5 text-violet-200" />Fixados ({pins.length})</p><span className="text-[10px] text-slate-500">{threadCount} respostas em thread</span></div><div className="mt-2 max-h-24 overflow-y-auto">{pins.length ? pins.map(message => <p key={message.id} className="mb-1 text-xs text-slate-400">{message.content}</p>) : <p className="text-xs text-slate-600">Nenhuma decisão fixada ainda.</p>}</div></section>
      <section><p className="text-xs font-bold text-slate-300">Pessoas online e papéis</p><div className="mt-2 flex flex-wrap gap-2">{props.presence.filter(member => member.userId !== props.profileId).map(member => <div key={member.userId} className="flex items-center gap-1.5 rounded-lg bg-white/6 px-2 py-1.5 text-[11px] text-slate-200"><button onClick={() => props.onInvite(member.userId)} disabled={!props.activeCall} className="flex items-center gap-1 disabled:opacity-40"><UserPlus className="size-3.5 text-violet-200" />{member.name}</button>{props.canManage ? <select value={["admin", "moderator"].includes(member.role ?? "") ? member.role : "member"} onChange={event => props.onSetRole(member.userId, event.target.value as "admin" | "moderator" | "member")} className="rounded bg-black/25 px-1 py-0.5 font-mono text-[8px] uppercase text-violet-200"><option value="member">membro</option><option value="moderator">moderador</option><option value="admin">admin</option></select> : <span className="rounded bg-violet-400/15 px-1 py-0.5 font-mono text-[8px] uppercase text-violet-200">{member.role ?? "member"}</span>}</div>)}</div></section>
      <section className="min-h-0 overflow-y-auto">{activeThread ? <div className="mb-3 rounded-xl border border-violet-300/20 bg-violet-400/5 p-3"><div className="flex items-center justify-between"><p className="text-xs font-bold text-violet-100">Thread de {activeThread.authorName}</p><button onClick={() => setActiveThreadId(null)} className="text-[11px] text-slate-400">Fechar</button></div><p className="mt-1 text-xs text-slate-300">{activeThread.content}</p><div className="mt-3 border-l border-violet-300/25 pl-3">{threadReplies.length ? threadReplies.map(reply => <p key={reply.id} className="mb-2 text-xs text-slate-400"><b className="text-violet-200">{reply.authorName}:</b> {reply.content}</p>) : <p className="text-xs text-slate-500">Ainda não há respostas nesta thread.</p>}</div><button onClick={() => props.onReply(activeThread)} className="mt-3 rounded-lg bg-violet-500/20 px-2 py-1 text-[11px] font-bold text-violet-100">Responder na thread</button></div> : <><p className="mb-2 text-xs font-bold text-slate-300">Mensagens recentes</p>{props.messages.filter(message => !message.parentId).slice(-20).reverse().map(message => <article key={message.id} className="mb-2 rounded-xl border border-white/7 bg-white/[.025] p-2.5"><p className="text-[11px] font-bold text-violet-100">{message.authorName}</p><p className="mt-1 text-xs leading-5 text-slate-300">{message.content}</p><div className="mt-2 flex items-center gap-1"><button onClick={() => props.onReact(message.id, "👍")} className="rounded-md bg-white/6 px-1.5 py-1 text-[11px]">👍 {message.reactions?.["👍"]?.length ?? 0}</button><button onClick={() => props.onReact(message.id, "🔥")} className="rounded-md bg-white/6 px-1.5 py-1 text-[11px]">🔥 {message.reactions?.["🔥"]?.length ?? 0}</button><button onClick={() => { setActiveThreadId(message.id); props.onReply(message); }} className="ml-auto rounded-md p-1 text-slate-400"><Reply className="size-3.5" /></button><button onClick={() => props.onPin(message.id)} className={`rounded-md p-1 ${props.pinnedIds.includes(message.id) ? "text-violet-200" : "text-slate-500"}`}><Pin className="size-3.5" /></button></div></article>)}</>}</section></div>
    </section>}
  </>;
}
