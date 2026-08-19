import { MediaTile } from "@/components/MediaTile";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getCallMedia, getCallMediaErrorMessage } from "@/lib/call-media";
import { normalizeExternalMessage } from "@/lib/cloudflare-safe-message";
import { EXTERNAL_WORKSPACE, findExternalChannel } from "@/lib/external-workspace";
import { getRealtimeSocket } from "@/lib/realtime";
import type { VoiceRoom } from "@/lib/voice-room-state";
import { Hash, LogOut, Mic, MicOff, MonitorUp, Phone, SendHorizontal, Users, Video, VideoOff, Volume2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Profile = { id: string; name: string; email: string };
type Presence = { userId: string; name: string; status: "online" | "away" | "offline" };
type ExternalMessage = { id: string; channelId: number; userId: string; authorName: string; content: string; createdAt: string };
type RemoteStream = { socketId: string; stream: MediaStream };
type CallPeer = { socketId: string; name: string };

const Streamdown = ({ children }: { children: string }) => (
  <span className="whitespace-pre-wrap break-words">{normalizeExternalMessage(children)}</span>
);

const PROFILE_KEY = "vybechat-cloudflare-profile";

function initials(name: string) {
  return name.split(" ").map(part => part[0]).slice(0, 2).join("").toUpperCase() || "V";
}

function loadProfile(): Profile | null {
  try {
    if (window.location.pathname === "/cloudflare-preview" && new URLSearchParams(window.location.search).get("demo") === "1") {
      return { id: "preview@vybe.com.br", name: "Vybe Preview", email: "preview@vybe.com.br" };
    }
    const value = localStorage.getItem(PROFILE_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export default function CloudflareHome() {
  const [profile, setProfile] = useState<Profile | null>(() => loadProfile());
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedChannelId, setSelectedChannelId] = useState(1);
  const [messages, setMessages] = useState<Record<number, ExternalMessage[]>>({});
  const [draft, setDraft] = useState("");
  const [presence, setPresence] = useState<Presence[]>([]);
  const [voiceRooms, setVoiceRooms] = useState<Record<number, VoiceRoom["members"]>>({});
  const [activeCallChannelId, setActiveCallChannelId] = useState<number | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);
  const [callPeers, setCallPeers] = useState<Record<string, CallPeer>>({});
  const [remoteVolumes, setRemoteVolumes] = useState<Record<string, number>>({});
  const [microphoneOn, setMicrophoneOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const socketRef = useRef(getRealtimeSocket());
  const localStreamRef = useRef<MediaStream | null>(null);
  const activeCallRef = useRef<number | null>(null);
  const peerConnectionsRef = useRef(new Map<string, RTCPeerConnection>());

  const selectedChannel = useMemo(() => findExternalChannel(selectedChannelId), [selectedChannelId]);
  const activeRoomMembers = activeCallChannelId ? voiceRooms[activeCallChannelId] ?? [] : [];

  const createPeer = async (peerId: string, shouldOffer = false) => {
    const existing = peerConnectionsRef.current.get(peerId);
    if (existing) return existing;
    const connection = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    peerConnectionsRef.current.set(peerId, connection);
    localStreamRef.current?.getTracks().forEach(track => connection.addTrack(track, localStreamRef.current!));
    connection.onicecandidate = event => {
      if (event.candidate && activeCallRef.current) socketRef.current.emit("call:ice", { to: peerId, channelId: activeCallRef.current, candidate: event.candidate });
    };
    connection.ontrack = event => {
      const [stream] = event.streams;
      if (stream) setRemoteStreams(current => [...current.filter(item => item.socketId !== peerId), { socketId: peerId, stream }]);
    };
    if (shouldOffer && activeCallRef.current) {
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      socketRef.current.emit("call:offer", { to: peerId, channelId: activeCallRef.current, offer });
    }
    return connection;
  };

  useEffect(() => {
    if (!profile) return;
    const socket = socketRef.current;
    const announce = () => {
      socket.emit("presence:join", { userId: profile.id, name: profile.name, status: "online" });
      socket.emit("channel:join", { channelId: selectedChannelId });
    };
    socket.on("connect", announce);
    socket.on("presence:update", (users: Presence[]) => setPresence(users));
    socket.on("voice:rooms", (rooms: VoiceRoom[]) => setVoiceRooms(Object.fromEntries(rooms.map(room => [room.channelId, room.members]))));
    socket.on("message:history", ({ channelId, messages: history }: { channelId: number; messages: ExternalMessage[] }) => setMessages(current => ({ ...current, [channelId]: history })));
    socket.on("message:new", ({ channelId, message }: { channelId: number; message: ExternalMessage }) => setMessages(current => ({ ...current, [channelId]: [...(current[channelId] ?? []).filter(item => item.id !== message.id), message] })));
    socket.on("call:peers", async ({ channelId, peers }: { channelId: number; peers: CallPeer[] }) => {
      if (channelId !== activeCallRef.current) return;
      setCallPeers(Object.fromEntries(peers.map(peer => [peer.socketId, peer])));
      for (const peer of peers) await createPeer(peer.socketId, true);
    });
    socket.on("call:peer-joined", ({ channelId, peer }: { channelId: number; peer: CallPeer }) => {
      if (channelId === activeCallRef.current) setCallPeers(current => ({ ...current, [peer.socketId]: peer }));
    });
    socket.on("call:offer", async ({ from, channelId, offer, user }: { from: string; channelId: number; offer: RTCSessionDescriptionInit; user?: Presence }) => {
      if (channelId !== activeCallRef.current) return;
      if (user) setCallPeers(current => ({ ...current, [from]: { socketId: from, name: user.name } }));
      const peer = await createPeer(from);
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit("call:answer", { to: from, channelId, answer });
    });
    socket.on("call:answer", async ({ from, channelId, answer }: { from: string; channelId: number; answer: RTCSessionDescriptionInit }) => {
      if (channelId === activeCallRef.current) await peerConnectionsRef.current.get(from)?.setRemoteDescription(new RTCSessionDescription(answer));
    });
    socket.on("call:ice", async ({ from, channelId, candidate }: { from: string; channelId: number; candidate: RTCIceCandidateInit }) => {
      if (channelId === activeCallRef.current) await peerConnectionsRef.current.get(from)?.addIceCandidate(new RTCIceCandidate(candidate));
    });
    socket.on("call:peer-left", ({ socketId }: { socketId: string }) => {
      peerConnectionsRef.current.get(socketId)?.close();
      peerConnectionsRef.current.delete(socketId);
      setRemoteStreams(current => current.filter(item => item.socketId !== socketId));
    });
    socket.on("realtime:error", ({ message }: { message: string }) => setNotice(message));
    socket.connect();
    if (socket.connected) announce();
    return () => {
      ["connect", "presence:update", "voice:rooms", "message:history", "message:new", "call:peers", "call:peer-joined", "call:offer", "call:answer", "call:ice", "call:peer-left", "realtime:error"].forEach(event => socket.off(event));
    };
  }, [profile, selectedChannelId]);

  useEffect(() => {
    if (profile && socketRef.current.connected) socketRef.current.emit("channel:join", { channelId: selectedChannelId });
  }, [profile, selectedChannelId]);

  const submitProfile = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !email.trim()) return;
    const next = { id: email.trim().toLowerCase(), name: name.trim(), email: email.trim().toLowerCase() };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
    setProfile(next);
  };

  const sendMessage = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    socketRef.current.emit("message:new", { channelId: selectedChannelId, content: draft.trim() });
    setDraft("");
  };

  const joinVoice = async (channelId: number) => {
    if (activeCallRef.current === channelId) return;
    try {
      const { stream, mode } = await getCallMedia(navigator.mediaDevices);
      localStreamRef.current = stream;
      activeCallRef.current = channelId;
      setLocalStream(stream);
      setActiveCallChannelId(channelId);
      setSelectedChannelId(channelId);
      setMicrophoneOn(true);
      setCameraOn(mode === "camera-and-audio");
      setNotice(mode === "audio-only" ? "Você entrou somente por áudio." : null);
      socketRef.current.emit("call:join", { channelId });
    } catch (error) {
      setNotice(getCallMediaErrorMessage(error));
    }
  };

  const leaveVoice = () => {
    if (activeCallRef.current) socketRef.current.emit("call:leave", { channelId: activeCallRef.current });
    peerConnectionsRef.current.forEach(peer => peer.close());
    peerConnectionsRef.current.clear();
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    screenStream?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;
    activeCallRef.current = null;
    setActiveCallChannelId(null);
    setLocalStream(null);
    setScreenStream(null);
    setRemoteStreams([]);
  };

  const toggleMic = () => {
    const next = !microphoneOn;
    localStreamRef.current?.getAudioTracks().forEach(track => { track.enabled = next; });
    setMicrophoneOn(next);
    if (activeCallRef.current) socketRef.current.emit("call:audio-state", { channelId: activeCallRef.current, isMuted: !next, isSpeaking: false });
  };

  const toggleCamera = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return setNotice("Nenhuma câmera está disponível nesta chamada.");
    track.enabled = !cameraOn;
    setCameraOn(!cameraOn);
  };

  const shareScreen = async () => {
    if (!activeCallRef.current) return;
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      const cameraTrack = localStreamRef.current?.getVideoTracks()[0] ?? null;
      peerConnectionsRef.current.forEach(peer => peer.getSenders().find(sender => sender.track?.kind === "video")?.replaceTrack(cameraTrack));
      socketRef.current.emit("call:screen-share", { channelId: activeCallRef.current, active: false });
      return setScreenStream(null);
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      for (const [peerId, peer] of Array.from(peerConnectionsRef.current.entries())) {
        const sender = peer.getSenders().find((item: RTCRtpSender) => item.track?.kind === "video");
        if (sender) await sender.replaceTrack(track);
        else {
          peer.addTrack(track, stream);
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          socketRef.current.emit("call:offer", { to: peerId, channelId: activeCallRef.current, offer });
        }
      }
      setScreenStream(stream);
      socketRef.current.emit("call:screen-share", { channelId: activeCallRef.current, active: true });
      track.onended = () => setScreenStream(null);
    } catch {
      setNotice("O compartilhamento de tela foi cancelado.");
    }
  };

  if (!profile) {
    return <main className="grid min-h-screen place-items-center p-5"><form onSubmit={submitProfile} className="w-full max-w-md rounded-3xl border border-violet-300/15 bg-[#18131f]/95 p-8 shadow-2xl"><p className="font-mono text-[10px] font-bold uppercase tracking-[.2em] text-violet-300">Vybe OS / Cloudflare</p><h1 className="mt-5 text-3xl font-extrabold text-white">Entrar no VybeChat</h1><p className="mt-2 text-sm leading-6 text-slate-400">Use seu nome e e-mail da agência. O acesso ao endereço será protegido pelo Cloudflare Access.</p><div className="mt-7 space-y-3"><Input value={name} onChange={event => setName(event.target.value)} placeholder="Seu nome" className="h-11 border-white/10 bg-black/20" /><Input value={email} onChange={event => setEmail(event.target.value)} placeholder="seuemail@agencia.com" type="email" className="h-11 border-white/10 bg-black/20" /><Button className="h-11 w-full bg-violet-500 font-bold hover:bg-violet-400">Entrar</Button></div></form></main>;
  }

  return <main className="min-h-screen p-2 text-foreground sm:p-3"><section className="flex min-h-[calc(100vh-1rem)] overflow-hidden rounded-2xl border border-white/10 bg-[#100d16]/90 shadow-2xl sm:min-h-[calc(100vh-1.5rem)]">
    <aside className="flex w-[286px] shrink-0 flex-col border-r border-white/7 bg-[#15101d]/92"><div className="border-b border-white/7 px-5 py-5"><p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-violet-300">Vybe OS // Cloud</p><h2 className="mt-1 text-sm font-bold text-white">Central de comunicação</h2></div><div className="flex-1 overflow-y-auto px-3 py-4">{EXTERNAL_WORKSPACE.map(category => <section key={category.name} className="mb-5"><p className="mb-1 px-2 font-mono text-[10px] font-bold tracking-[.12em] text-slate-500">{category.name}</p>{category.channels.map(channel => { const members = voiceRooms[channel.id] ?? []; return <div key={channel.id}><button onClick={() => channel.type === "voice" ? joinVoice(channel.id) : setSelectedChannelId(channel.id)} className={`flex h-9 w-full items-center gap-2 rounded-lg px-2 text-sm ${selectedChannelId === channel.id ? "bg-violet-400/14 text-violet-100" : "text-slate-400 hover:bg-white/5"}`}>{channel.type === "voice" ? <Volume2 className="size-4" /> : <Hash className="size-4" />}<span className="truncate">{channel.name}</span>{channel.type === "voice" && members.length > 0 && <span className="ml-auto text-[10px] text-emerald-300">{members.length}</span>}</button>{members.map(member => <div key={member.socketId} className="ml-7 flex items-center gap-2 py-1 text-[11px] text-slate-400"><span className={`size-2 rounded-full ${member.isSpeaking ? "bg-emerald-300 shadow-[0_0_8px_rgba(52,211,153,.9)]" : "bg-slate-600"}`} />{member.name}{member.isMuted && <MicOff className="ml-auto size-3 text-rose-300" />}</div>)}</div>})}</section>)}</div>{activeCallChannelId && <div className="border-t border-violet-300/15 bg-violet-500/8 p-3"><p className="text-[11px] font-bold text-emerald-200">Conectado: {findExternalChannel(activeCallChannelId)?.name}</p><div className="mt-2 flex gap-1"><button onClick={toggleMic} className={`grid size-8 place-items-center rounded-lg ${microphoneOn ? "bg-white/8" : "bg-rose-500/20 text-rose-200"}`}>{microphoneOn ? <Mic className="size-4" /> : <MicOff className="size-4" />}</button><button onClick={toggleCamera} className={`grid size-8 place-items-center rounded-lg ${cameraOn ? "bg-white/8" : "bg-rose-500/20 text-rose-200"}`}>{cameraOn ? <Video className="size-4" /> : <VideoOff className="size-4" />}</button><button onClick={shareScreen} className={`grid size-8 place-items-center rounded-lg ${screenStream ? "bg-violet-400/25 text-violet-100" : "bg-white/8"}`}><MonitorUp className="size-4" /></button><button onClick={leaveVoice} className="ml-auto grid size-8 place-items-center rounded-lg bg-rose-500 text-white"><Phone className="size-4 rotate-[135deg]" /></button></div></div>}<div className="flex items-center gap-2 border-t border-white/7 p-3"><Avatar className="size-8"><AvatarFallback className="bg-violet-400/15 text-xs text-violet-100">{initials(profile.name)}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-white">{profile.name}</p><p className="truncate text-[10px] text-emerald-300">Online</p></div><button onClick={() => { leaveVoice(); localStorage.removeItem(PROFILE_KEY); setProfile(null); }}><LogOut className="size-4 text-slate-500" /></button></div></aside>
    <section className="flex min-w-0 flex-1 flex-col"><header className="flex h-[72px] items-center gap-3 border-b border-white/7 px-6"><Hash className="size-5 text-violet-300" /><div><h1 className="font-bold text-white">{selectedChannel?.name}</h1><p className="text-xs text-slate-500">Canal externo da Vybe</p></div><span className="ml-auto flex items-center gap-2 rounded-full border border-emerald-300/10 bg-emerald-400/6 px-3 py-1 font-mono text-[10px] text-emerald-300"><span className="size-1.5 rounded-full bg-emerald-400" />{presence.length} online</span></header><div className="flex min-h-0 flex-1"><section className="flex min-w-0 flex-1 flex-col"><div className="flex-1 overflow-y-auto p-7"><div className="mx-auto max-w-4xl"><div className="mb-8 border-b border-white/7 pb-7"><div className="grid size-14 place-items-center rounded-2xl bg-violet-400/10 text-violet-200"><Hash className="size-7" /></div><h2 className="mt-4 text-2xl font-extrabold text-white">#{selectedChannel?.name}</h2><p className="mt-2 text-sm text-slate-400">Canal sincronizado pelo Cloudflare.</p></div><div className="space-y-5">{(messages[selectedChannelId] ?? []).map(message => <article key={message.id} className="flex gap-3"><Avatar className="size-9"><AvatarFallback className="bg-violet-400/12 text-xs">{initials(message.authorName)}</AvatarFallback></Avatar><div><p className="text-sm font-bold text-white">{message.authorName}</p><div className="text-sm text-slate-300"><Streamdown>{message.content}</Streamdown></div></div></article>)}</div>{notice && <p className="mt-5 rounded-xl border border-amber-300/15 bg-amber-400/10 p-3 text-xs text-amber-100">{notice}</p>}</div></div>{selectedChannel?.type === "text" && <form onSubmit={sendMessage} className="mx-auto flex w-full max-w-4xl gap-2 px-7 pb-6"><Textarea value={draft} onChange={event => setDraft(event.target.value)} placeholder={`Mensagem para #${selectedChannel.name}`} className="min-h-11 resize-none border-white/10 bg-[#1c1625]" rows={1} /><Button size="icon" className="size-11 bg-violet-500"><SendHorizontal className="size-4" /></Button></form>}</section><aside className="hidden w-56 border-l border-white/7 p-4 xl:block"><p className="font-mono text-[10px] font-bold tracking-wider text-slate-500">MEMBROS — {presence.length}</p><div className="mt-4 space-y-2">{presence.map(member => <div key={member.userId} className="flex items-center gap-2"><Avatar className="size-7"><AvatarFallback className="bg-white/5 text-[10px]">{initials(member.name)}</AvatarFallback></Avatar><span className="truncate text-xs text-slate-300">{member.name}</span><span className="ml-auto size-2 rounded-full bg-emerald-400" /></div>)}</div></aside></div></section>
  </section>{activeCallChannelId && <div className="pointer-events-none fixed bottom-5 right-5 grid w-72 gap-2">{localStream && <div className="pointer-events-auto"><MediaTile stream={screenStream || localStream} label={profile.name} muted isLocal cameraOn={screenStream ? true : cameraOn} microphoneOn={microphoneOn} sharingScreen={Boolean(screenStream)} /></div>}{remoteStreams.map(remote => { const member = activeRoomMembers.find(item => item.socketId === remote.socketId); return <div key={remote.socketId} className="pointer-events-auto"><MediaTile stream={remote.stream} label={member?.name || callPeers[remote.socketId]?.name || "Participante"} microphoneOn={!member?.isMuted} speaking={Boolean(member?.isSpeaking)} volume={remoteVolumes[remote.socketId] ?? 100} onVolumeChange={volume => setRemoteVolumes(current => ({ ...current, [remote.socketId]: volume }))} /></div>})}</div>}</main>;
}
