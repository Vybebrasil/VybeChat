import { Bell, MessageCircleMore, SendHorizontal, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

export type DirectThread = {
  id: string;
  peerUserId: string;
  peerName: string;
  lastMessage: string;
  updatedAt: string;
  unreadCount: number;
};

export type DirectMessage = {
  id: string;
  threadId: string;
  userId: string;
  authorName: string;
  toUserId: string;
  content: string;
  createdAt: string;
};

type Presence = { userId: string; name: string; status: string };

type DirectMessagesDrawerProps = {
  open: boolean;
  profileId: string;
  threads: DirectThread[];
  messages: Record<string, DirectMessage[]>;
  presence: Presence[];
  activeThreadId: string | null;
  onOpenChange: (open: boolean) => void;
  onOpenThread: (peer: { userId: string; name: string }) => void;
  onSend: (thread: DirectThread, content: string) => void;
};

export function DirectMessagesDrawer({ open, profileId, threads, messages, presence, activeThreadId, onOpenChange, onOpenThread, onSend }: DirectMessagesDrawerProps) {
  const [draft, setDraft] = useState("");
  const activeThread = useMemo(() => threads.find(thread => thread.id === activeThreadId) ?? null, [activeThreadId, threads]);
  const activeMessages = activeThread ? messages[activeThread.id] ?? [] : [];
  const unreadCount = threads.reduce((total, thread) => total + thread.unreadCount, 0);
  const activePeers = presence.filter(member => member.userId !== profileId && member.status !== "offline");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!activeThread || !draft.trim()) return;
    onSend(activeThread, draft.trim());
    setDraft("");
  };

  return <><button onClick={() => onOpenChange(true)} className="fixed bottom-4 right-4 z-20 flex items-center gap-2 rounded-xl border border-orange-300/25 bg-[#101116]/95 px-3 py-2 text-xs font-semibold text-orange-100 shadow-xl backdrop-blur sm:right-[122px]" aria-label="Abrir mensagens diretas"><MessageCircleMore className="size-4 text-orange-400" />Diretas{unreadCount > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-orange-400 px-1.5 py-0.5 text-[10px] font-bold text-black">{unreadCount}</span>}</button>{open && <section className="vybe-direct-drawer fixed inset-y-0 right-0 z-[70] flex w-full max-w-md flex-col border-l border-orange-300/25 bg-[#0b0c10]/98 p-4 shadow-2xl backdrop-blur sm:p-5"><header className="flex items-center justify-between border-b border-orange-300/15 pb-4"><div><p className="cyber-label">Mensagens diretas</p><h3 className="mt-1 font-sans text-lg font-semibold tracking-tight text-orange-50">Conversas privadas</h3></div><button onClick={() => onOpenChange(false)} className="grid size-9 rounded-xl border border-orange-300/20 text-orange-100" aria-label="Fechar mensagens diretas"><X className="size-4" /></button></header><div className="mt-4 grid min-h-0 flex-1 grid-cols-[132px_1fr] gap-3 overflow-hidden"><aside className="overflow-y-auto border-r border-orange-300/15 pr-2"><p className="cyber-label mb-2">Equipe online</p>{activePeers.map(member => { const thread = threads.find(item => item.peerUserId === member.userId); return <button key={member.userId} onClick={() => onOpenThread({ userId: member.userId, name: member.name })} className={`mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs ${activeThread?.peerUserId === member.userId ? "bg-orange-400/12 text-orange-50" : "text-stone-300 hover:bg-white/5"}`}><span className="size-2 rounded-full bg-emerald-400" /><span className="min-w-0 flex-1 truncate">{member.name}</span>{thread?.unreadCount ? <span className="rounded-full bg-orange-400 px-1.5 py-0.5 text-[9px] font-bold text-black">{thread.unreadCount}</span> : null}</button>})}<p className="cyber-label mb-2 mt-5">Recentes</p>{threads.map(thread => <button key={thread.id} onClick={() => onOpenThread({ userId: thread.peerUserId, name: thread.peerName })} className={`mb-1 w-full rounded-lg px-2 py-2 text-left text-xs ${activeThread?.id === thread.id ? "bg-orange-400/12 text-orange-50" : "text-stone-300 hover:bg-white/5"}`}><span className="flex items-center gap-1.5"><span className="truncate font-semibold">{thread.peerName}</span>{thread.unreadCount > 0 && <span className="size-1.5 rounded-full bg-orange-400" />}</span><span className="mt-1 block truncate text-[10px] text-stone-500">{thread.lastMessage}</span></button>)}</aside><section className="flex min-w-0 flex-col">{activeThread ? <><div className="border-b border-orange-300/12 pb-3"><p className="text-sm font-semibold text-orange-50">{activeThread.peerName}</p><p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-emerald-300"><span className="size-1.5 rounded-full bg-emerald-400" />Conversa privada</p></div><div className="flex-1 space-y-2 overflow-y-auto py-3">{activeMessages.length ? activeMessages.map(message => <article key={message.id} className={`rounded-xl p-2.5 text-xs ${message.userId === profileId ? "ml-5 bg-orange-400 text-black" : "mr-5 border border-orange-300/12 bg-white/[.04] text-stone-200"}`}><p className={`mb-1 font-semibold ${message.userId === profileId ? "text-black/70" : "text-orange-200"}`}>{message.userId === profileId ? "Você" : message.authorName}</p><p className="leading-5">{message.content}</p></article>) : <div className="grid h-full place-items-center text-center"><div><Bell className="mx-auto size-6 text-orange-300" /><p className="mt-2 text-xs text-stone-400">Comece uma conversa privada com {activeThread.peerName}.</p></div></div>}</div><form onSubmit={submit} className="flex gap-2 border-t border-orange-300/12 pt-3"><input value={draft} onChange={event => setDraft(event.target.value)} placeholder={`Mensagem para ${activeThread.peerName}`} className="min-w-0 flex-1 rounded-xl border border-orange-300/20 bg-black/35 px-3 text-xs text-orange-50 outline-none placeholder:text-stone-600" /><button className="grid size-10 place-items-center rounded-xl bg-orange-500 text-black" aria-label="Enviar mensagem direta"><SendHorizontal className="size-4" /></button></form></> : <div className="grid flex-1 place-items-center text-center"><div><MessageCircleMore className="mx-auto size-7 text-orange-300" /><p className="mt-3 text-sm font-semibold text-orange-50">Escolha alguém da equipe</p><p className="mt-1 text-xs leading-5 text-stone-400">As conversas ficam disponíveis apenas para os dois integrantes envolvidos.</p></div></div>}</section></div></section>}</>;
}
