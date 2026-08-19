import { CallStage } from "@/components/CallStage";
import { CollaborationDrawer } from "@/components/CollaborationDrawer";
import { CommandTelemetryRail } from "@/components/CommandTelemetryRail";
import { CommandNavigation } from "@/components/CommandNavigation";
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
import { Bell, Hash, LogOut, Menu, Mic, MicOff, MonitorUp, Phone, Pin, Search, SendHorizontal, SmilePlus, UserPlus, Video, VideoOff, Volume2, X } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Profile = { id: string; name: string; email: string };
type Presence = { userId: string; name: string; status: "online" | "away" | "offline" | "focus" | "meeting"; statusMessage?: string; role?: "admin" | "moderator" | "member" };
type ExternalMessage = { id: string; channelId: number; userId: string; authorName: string; content: string; createdAt: string; parentId?: string | null; reactions?: Record<string, string[]> };
type RemoteStream = { socketId: string; stream: MediaStream };
type CallPeer = { socketId: string; name: string };

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
  const [screenSharer, setScreenSharer] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [callStageOpen, setCallStageOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<Record<number, string[]>>({});
  const [threadParent, setThreadParent] = useState<ExternalMessage | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ExternalMessage[]>([]);
  const [status, setStatus] = useState<Presence["status"]>("online");
  const [statusMessage, setStatusMessage] = useState("");
  const [pushToTalkEnabled, setPushToTalkEnabled] = useState(false);
  const [pushToTalkKey, setPushToTalkKey] = useState<"Space" | "KeyV">("Space");
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [typingNames, setTypingNames] = useState<string[]>([]);
  const [channelPermissions, setChannelPermissions] = useState<Record<number, { readOnly: boolean; invitePolicy: "admin" | "member" }>>({});
  const socketRef = useRef(getRealtimeSocket());
  const localStreamRef = useRef<MediaStream | null>(null);
  const activeCallRef = useRef<number | null>(null);
  const peerConnectionsRef = useRef(new Map<string, RTCPeerConnection>());

  const selectedChannel = useMemo(() => findExternalChannel(selectedChannelId), [selectedChannelId]);
  const activeRoomMembers = activeCallChannelId ? voiceRooms[activeCallChannelId] ?? [] : [];
  const channelMessages = messages[selectedChannelId] ?? [];

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
      socket.emit("presence:join", { userId: profile.id, name: profile.name, status, statusMessage, role: profile.email.includes("gestaovybe") ? "admin" : "member" });
      socket.emit("channel:join", { channelId: selectedChannelId });
    };
    socket.on("connect", announce);
    socket.on("presence:update", (users: Presence[]) => setPresence(users));
    socket.on("voice:rooms", (rooms: VoiceRoom[]) => setVoiceRooms(Object.fromEntries(rooms.map(room => [room.channelId, room.members]))));
    socket.on("message:history", ({ channelId, messages: history }: { channelId: number; messages: ExternalMessage[] }) => setMessages(current => ({ ...current, [channelId]: history })));
    socket.on("message:new", ({ channelId, message }: { channelId: number; message: ExternalMessage }) => {
      setMessages(current => ({ ...current, [channelId]: [...(current[channelId] ?? []).filter(item => item.id !== message.id), message] }));
      if (message.userId !== profile.id && message.content.toLocaleLowerCase().includes(`@${profile.name.toLocaleLowerCase()}`)) setNotice(`${message.authorName} mencionou você em #${findExternalChannel(channelId)?.name ?? "canal"}.`);
    });
    socket.on("message:update", ({ channelId, message }: { channelId: number; message: ExternalMessage }) => setMessages(current => ({ ...current, [channelId]: (current[channelId] ?? []).map(item => item.id === message.id ? message : item) })));
    socket.on("message:pins", ({ channelId, pinnedIds: pins }: { channelId: number; pinnedIds: string[] }) => setPinnedIds(current => ({ ...current, [channelId]: pins })));
    socket.on("message:search-results", ({ results }: { results: ExternalMessage[] }) => setSearchResults(results));
    socket.on("channel:permissions", ({ channelId, permissions }: { channelId: number; permissions: { readOnly: boolean; invitePolicy: "admin" | "member" } }) => setChannelPermissions(current => ({ ...current, [channelId]: permissions })));
    socket.on("typing", ({ channelId, name: typingName, active }: { channelId: number; name: string; active: boolean }) => {
      if (channelId !== selectedChannelId || typingName === profile.name) return;
      setTypingNames(current => active ? Array.from(new Set([...current, typingName])) : current.filter(item => item !== typingName));
    });
    socket.on("call:invite", ({ channelId, from }: { channelId: number; from: { name: string } }) => setNotice(`${from.name} convidou você para ${findExternalChannel(channelId)?.name ?? "uma sala"}.`));
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
      setCallPeers(current => {
        const next = { ...current };
        delete next[socketId];
        return next;
      });
    });
    socket.on("call:screen-share", ({ channelId, name }: { channelId: number; name: string | null }) => {
      if (channelId === activeCallRef.current) setScreenSharer(name);
    });
    socket.on("realtime:error", ({ message }: { message: string }) => setNotice(message));
    socket.connect();
    if (socket.connected) announce();
    return () => {
      ["connect", "presence:update", "voice:rooms", "message:history", "message:new", "message:update", "message:pins", "message:search-results", "channel:permissions", "typing", "call:invite", "call:peers", "call:peer-joined", "call:offer", "call:answer", "call:ice", "call:peer-left", "call:screen-share", "realtime:error"].forEach(event => socket.off(event));
    };
  }, [profile, selectedChannelId, status, statusMessage]);

  useEffect(() => {
    if (profile && socketRef.current.connected) socketRef.current.emit("channel:join", { channelId: selectedChannelId });
  }, [profile, selectedChannelId]);

  useEffect(() => {
    if (!pushToTalkEnabled || !activeCallChannelId) return;
    const updateTransmit = (enabled: boolean) => {
      localStreamRef.current?.getAudioTracks().forEach(track => { track.enabled = enabled; });
      setMicrophoneOn(enabled);
      setIsTransmitting(enabled);
      socketRef.current.emit("call:audio-state", { channelId: activeCallRef.current, isMuted: !enabled, isSpeaking: enabled });
    };
    const down = (event: KeyboardEvent) => {
      if (event.code === pushToTalkKey && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) { event.preventDefault(); updateTransmit(true); }
    };
    const up = (event: KeyboardEvent) => { if (event.code === pushToTalkKey) updateTransmit(false); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    updateTransmit(false);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [activeCallChannelId, pushToTalkEnabled, pushToTalkKey]);

  const stageParticipants = useMemo(() => {
    const local = localStream && profile ? [{
      id: "local",
      stream: screenStream || localStream,
      label: profile.name,
      muted: true,
      isLocal: true,
      cameraOn: screenStream ? true : cameraOn,
      microphoneOn,
      sharingScreen: Boolean(screenStream),
      accent: Boolean(screenStream),
    }] : [];
    const remote = remoteStreams.map(remoteStream => {
      const member = activeRoomMembers.find(candidate => candidate.socketId === remoteStream.socketId);
      const label = member?.name || callPeers[remoteStream.socketId]?.name || "Participante";
      return {
        id: remoteStream.socketId,
        stream: remoteStream.stream,
        label,
        microphoneOn: !member?.isMuted,
        speaking: Boolean(member?.isSpeaking),
        sharingScreen: screenSharer === label,
        accent: screenSharer === label,
        volume: remoteVolumes[remoteStream.socketId] ?? 100,
        onVolumeChange: (volume: number) => setRemoteVolumes(current => ({ ...current, [remoteStream.socketId]: volume })),
      };
    });
    return [...local, ...remote];
  }, [activeRoomMembers, cameraOn, callPeers, localStream, microphoneOn, profile, remoteStreams, remoteVolumes, screenSharer, screenStream]);

  const submitProfile = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !email.trim()) return;
    const next = { id: email.trim().toLowerCase(), name: name.trim(), email: email.trim().toLowerCase() };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
    setProfile(next);
  };

  const selectChannel = (channelId: number) => {
    setSelectedChannelId(channelId);
    setMobileSidebarOpen(false);
  };

  const sendMessage = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    socketRef.current.emit("message:new", { channelId: selectedChannelId, content: draft.trim(), parentId: threadParent?.id ?? null });
    setDraft("");
    setThreadParent(null);
  };

  const reactToMessage = (messageId: string, emoji: string) => socketRef.current.emit("message:reaction", { channelId: selectedChannelId, messageId, emoji });
  const togglePin = (messageId: string) => socketRef.current.emit("message:pin", { channelId: selectedChannelId, messageId });
  const searchMessages = (query: string) => {
    setSearchQuery(query);
    if (query.trim().length >= 2) socketRef.current.emit("message:search", { query: query.trim() });
    else setSearchResults([]);
  };
  const updateStatus = (nextStatus: Presence["status"], nextMessage = statusMessage) => {
    setStatus(nextStatus);
    setStatusMessage(nextMessage);
    socketRef.current.emit("presence:status", { status: nextStatus, statusMessage: nextMessage });
  };
  const inviteToCall = (userId: string) => {
    if (!activeCallChannelId) return;
    socketRef.current.emit("call:invite", { channelId: activeCallChannelId, userId });
    setNotice("Convite enviado para a sala de voz.");
  };
  const toggleReadOnly = () => {
    const current = channelPermissions[selectedChannelId] ?? { readOnly: false, invitePolicy: "member" as const };
    socketRef.current.emit("channel:permissions:update", { channelId: selectedChannelId, readOnly: !current.readOnly, invitePolicy: current.invitePolicy });
  };
  const setMemberRole = (userId: string, role: "admin" | "moderator" | "member") => socketRef.current.emit("team:role:update", { userId, role });
  const toggleInvitePolicy = () => {
    const current = channelPermissions[selectedChannelId] ?? { readOnly: false, invitePolicy: "member" as const };
    socketRef.current.emit("channel:permissions:update", { channelId: selectedChannelId, readOnly: current.readOnly, invitePolicy: current.invitePolicy === "admin" ? "member" : "admin" });
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
    setScreenSharer(null);
    setRemoteStreams([]);
    setCallPeers({});
    setCallStageOpen(false);
  };

  const joinVoice = async (channelId: number) => {
    if (activeCallRef.current === channelId) return setCallStageOpen(true);
    try {
      if (activeCallRef.current) leaveVoice();
      const { stream, mode } = await getCallMedia(navigator.mediaDevices);
      localStreamRef.current = stream;
      activeCallRef.current = channelId;
      setLocalStream(stream);
      setActiveCallChannelId(channelId);
      setSelectedChannelId(channelId);
      setMicrophoneOn(true);
      setCameraOn(mode === "camera-and-audio");
      setNotice(mode === "audio-only" ? "Você entrou somente por áudio." : null);
      setCallStageOpen(true);
      setMobileSidebarOpen(false);
      socketRef.current.emit("call:join", { channelId });
    } catch (error) {
      setNotice(getCallMediaErrorMessage(error));
    }
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
      setScreenStream(null);
      setScreenSharer(null);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      for (const [peerId, peer] of Array.from(peerConnectionsRef.current.entries())) {
        const sender = peer.getSenders().find(item => item.track?.kind === "video");
        if (sender) await sender.replaceTrack(track);
        else {
          peer.addTrack(track, stream);
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          socketRef.current.emit("call:offer", { to: peerId, channelId: activeCallRef.current, offer });
        }
      }
      setScreenStream(stream);
      setScreenSharer(profile?.name ?? "Você");
      socketRef.current.emit("call:screen-share", { channelId: activeCallRef.current, active: true });
      track.onended = () => {
        setScreenStream(null);
        setScreenSharer(null);
      };
    } catch {
      setNotice("O compartilhamento de tela foi cancelado.");
    }
  };

  if (!profile) {
    return <main className="cyber-grid grid min-h-screen place-items-center overflow-hidden p-5"><form onSubmit={submitProfile} className="cyber-panel cyber-corner cyber-reveal w-full max-w-md p-1"><div className="border border-orange-300/15 bg-[#0c0d10]/80 p-7 sm:p-9"><div className="flex items-center justify-between"><p className="cyber-label">Vybe command / access_01</p><span className="signal-pulse size-2 rounded-full bg-orange-400" /></div><h1 className="mt-6 [font-family:Orbitron] text-3xl font-bold tracking-tight text-orange-100">VYBE<span className="text-orange-500">CHAT</span></h1><p className="mt-2 text-sm leading-6 text-stone-400">Central operacional criptografada para a equipe Vybe.</p><div className="my-7 h-px bg-gradient-to-r from-orange-500/70 via-orange-200/10 to-transparent" /><div className="space-y-3"><Input value={name} onChange={event => setName(event.target.value)} placeholder="Identificação do operador" className="h-12 rounded-none border-orange-300/20 bg-black/50 text-orange-50 placeholder:text-stone-600 focus-visible:ring-orange-400" /><Input value={email} onChange={event => setEmail(event.target.value)} placeholder="e-mail@agencia.com" type="email" className="h-12 rounded-none border-orange-300/20 bg-black/50 text-orange-50 placeholder:text-stone-600 focus-visible:ring-orange-400" /><Button className="h-12 w-full rounded-none bg-orange-500 font-bold tracking-wide text-black hover:bg-orange-400">INICIAR SESSÃO</Button></div><p className="mt-5 font-mono text-[9px] uppercase tracking-[.15em] text-stone-600">Sistema de presença e chamada em tempo real</p></div></form></main>;
  }

  const sidebar = <aside className={`${mobileSidebarOpen ? "fixed inset-y-0 left-0 z-40 flex w-[292px] shadow-2xl" : "hidden"} cyber-panel flex-col bg-[#0a0b0f]/98 md:relative md:flex md:w-[292px] md:shrink-0`}>
    <div className="border-b border-orange-300/15 px-5 py-5"><div className="flex items-start justify-between"><div className="flex items-start gap-3"><span className="grid size-10 place-items-center border border-orange-300/45 bg-orange-400/10 [font-family:Orbitron] text-sm font-extrabold text-orange-300">V//</span><div><p className="cyber-label">Vybe / comms network</p><h2 className="mt-2 [font-family:Orbitron] text-sm font-bold tracking-[.08em] text-orange-100">COMMAND GRID</h2></div></div><button onClick={() => setMobileSidebarOpen(false)} className="grid size-8 border border-orange-300/15 text-orange-200 md:hidden" aria-label="Fechar canais"><X className="size-4" /></button></div><div className="mt-4 flex items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-orange-300/70"><span className="size-1.5 rounded-full bg-orange-400" />Canal seguro ativo</div></div>
    <div className="flex-1 overflow-y-auto px-3 py-4"><CommandNavigation groups={EXTERNAL_WORKSPACE} selectedChannelId={selectedChannelId} voiceRooms={voiceRooms} onSelectText={selectChannel} onJoinVoice={joinVoice} /></div>
    {activeCallChannelId && <div className="border-y border-orange-300/15 bg-orange-400/5 p-3"><button onClick={() => setCallStageOpen(true)} className="w-full text-left"><p className="cyber-label text-orange-300">Link de voz ativo</p><p className="mt-1 text-xs font-bold text-orange-50">{findExternalChannel(activeCallChannelId)?.name}</p></button><div className="mt-3 flex gap-1.5"><button onClick={toggleMic} className={`grid size-9 place-items-center border ${microphoneOn ? "border-orange-300/20 bg-white/5 text-orange-100" : "border-rose-500/30 bg-rose-500/15 text-rose-200"}`}>{microphoneOn ? <Mic className="size-4" /> : <MicOff className="size-4" />}</button><button onClick={toggleCamera} className={`grid size-9 place-items-center border ${cameraOn ? "border-orange-300/20 bg-white/5 text-orange-100" : "border-rose-500/30 bg-rose-500/15 text-rose-200"}`}>{cameraOn ? <Video className="size-4" /> : <VideoOff className="size-4" />}</button><button onClick={shareScreen} className={`grid size-9 place-items-center border ${screenStream ? "border-orange-300/50 bg-orange-400/20 text-orange-100" : "border-orange-300/20 bg-white/5 text-orange-100"}`}><MonitorUp className="size-4" /></button><button onClick={leaveVoice} className="ml-auto grid size-9 place-items-center bg-rose-500 text-white"><Phone className="size-4 rotate-[135deg]" /></button></div></div>}
    <div className="flex items-center gap-2 border-t border-orange-300/15 p-3"><Avatar className="size-9"><AvatarFallback className="rounded-none border border-orange-300/25 bg-orange-400/10 text-xs text-orange-100">{initials(profile.name)}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-orange-50">{profile.name}</p><p className="font-mono text-[9px] uppercase tracking-wider text-orange-300">Operador online</p></div><button onClick={() => { leaveVoice(); localStorage.removeItem(PROFILE_KEY); setProfile(null); }} aria-label="Sair"><LogOut className="size-4 text-stone-500" /></button></div>
  </aside>;

  return <main className="cyber-grid flex min-h-screen p-0 text-foreground md:p-3"><section className="cyber-panel flex min-w-0 flex-1 min-h-screen overflow-hidden bg-[#0b0c10]/92 md:min-h-[calc(100vh-1.5rem)]">{mobileSidebarOpen && <button onClick={() => setMobileSidebarOpen(false)} className="fixed inset-0 z-30 bg-black/75 md:hidden" aria-label="Fechar navegação" />}{sidebar}
    <section className="flex min-w-0 flex-1 flex-col"><header className="flex h-[64px] items-center gap-3 border-b border-orange-300/15 bg-black/20 px-4 sm:h-[76px] sm:px-6"><button onClick={() => setMobileSidebarOpen(true)} className="grid size-9 border border-orange-300/20 text-orange-200 md:hidden" aria-label="Abrir canais"><Menu className="size-4" /></button><div className="grid size-10 place-items-center border border-orange-300/25 bg-orange-400/10 text-orange-300"><Hash className="size-5" /></div><div className="min-w-0"><p className="cyber-label">Canal / transmissão</p><h1 className="truncate [font-family:Orbitron] text-sm font-bold tracking-wide text-orange-50">{selectedChannel?.name}</h1></div>{activeCallChannelId && <button onClick={() => setCallStageOpen(true)} className="ml-auto border border-orange-300/35 bg-orange-400/10 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-orange-100">Abrir palco</button>}<span className={`${activeCallChannelId ? "hidden sm:flex" : "ml-auto flex"} items-center gap-2 border border-orange-300/20 bg-orange-400/5 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-orange-200`}><span className="signal-pulse size-1.5 rounded-full bg-orange-400" />{presence.length} operadores</span></header>
      <div className="flex min-h-0 flex-1"><section className="flex min-w-0 flex-1 flex-col"><div className="flex-1 overflow-y-auto p-4 sm:p-7"><div className="mx-auto max-w-4xl"><div className="mb-7 border-b border-orange-300/12 pb-7"><div className="grid size-14 place-items-center border border-orange-300/25 bg-orange-400/10 text-orange-300"><Hash className="size-7" /></div><p className="cyber-label mt-5">Fluxo de inteligência / 01</p><h2 className="mt-1 [font-family:Orbitron] text-2xl font-bold text-orange-50">#{selectedChannel?.name}</h2><p className="mt-2 text-sm text-stone-400">Canal sincronizado pelo Cloudflare para decisões e operações em tempo real.</p></div><div className="space-y-4">{channelMessages.length ? channelMessages.map(message => <article key={message.id} className="cyber-corner flex gap-3 border border-orange-300/10 bg-black/15 p-3"><Avatar className="size-9"><AvatarFallback className="rounded-none border border-orange-300/20 bg-orange-400/10 text-xs text-orange-100">{initials(message.authorName)}</AvatarFallback></Avatar><div className="min-w-0"><p className="font-mono text-[10px] font-bold uppercase tracking-wider text-orange-200">{message.authorName}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-stone-300">{normalizeExternalMessage(message.content)}</p></div></article>) : <div className="cyber-corner relative overflow-hidden border border-orange-300/15 bg-black/20 p-6 sm:p-8"><div className="absolute right-5 top-4 [font-family:Orbitron] text-5xl font-bold text-orange-400/10">V//</div><p className="cyber-label">Nenhuma transmissão registrada</p><p className="mt-3 max-w-sm text-sm leading-6 text-stone-400">O canal está limpo. Envie a primeira mensagem para iniciar o fluxo de inteligência da equipe.</p><div className="mt-6 flex gap-2 font-mono text-[9px] uppercase tracking-wider text-orange-300/70"><span>◉ Link seguro</span><span>•</span><span>◉ Buffer pronto</span><span>•</span><span>◉ Escuta ativa</span></div></div>}</div>{typingNames.length > 0 && <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-orange-300">{typingNames.join(", ")} transmitindo texto…</p>}{notice && <p className="mt-5 border-l-2 border-orange-400 bg-orange-400/8 p-3 text-xs text-orange-100">{notice}</p>}</div></div>{selectedChannel && (selectedChannel.type === "text" || activeCallChannelId === selectedChannelId) && <form onSubmit={sendMessage} className="mx-auto flex w-full max-w-4xl gap-2 px-4 pb-4 sm:px-7 sm:pb-6"><div className="min-w-0 flex-1">{threadParent && <p className="mb-1 truncate font-mono text-[10px] text-orange-300">Respondendo a {threadParent.authorName} · <button type="button" onClick={() => setThreadParent(null)} className="underline">cancelar</button></p>}<Textarea value={draft} onChange={event => { setDraft(event.target.value); socketRef.current.emit("typing", { channelId: selectedChannelId, active: Boolean(event.target.value.trim()) }); }} placeholder={`Transmitir para #${selectedChannel.name}`} className="min-h-12 resize-none rounded-none border-orange-300/20 bg-black/40 text-orange-50 placeholder:text-stone-600 focus-visible:ring-orange-400" rows={1} /></div><Button size="icon" className="size-12 rounded-none bg-orange-500 text-black hover:bg-orange-400"><SendHorizontal className="size-4" /></Button></form>}</section><aside className="hidden w-60 border-l border-orange-300/15 bg-black/15 p-5 xl:block"><p className="cyber-label">Operadores — {presence.length}</p><div className="mt-5 space-y-2">{presence.map(member => <div key={member.userId} className="flex items-center gap-2 border-l border-orange-300/15 py-1.5 pl-2"><Avatar className="size-7"><AvatarFallback className="rounded-none bg-orange-400/10 text-[10px] text-orange-100">{initials(member.name)}</AvatarFallback></Avatar><span className="truncate text-xs font-semibold text-stone-300">{member.name}</span><span className="ml-auto size-1.5 rounded-full bg-orange-400" /></div>)}</div></aside></div></section>
  </section><CommandTelemetryRail channelName={selectedChannel?.name ?? "geral"} onlineCount={presence.length} voiceCount={activeRoomMembers.length} messageCount={channelMessages.length} activeCall={Boolean(activeCallChannelId)} operators={presence} /><CollaborationDrawer messages={messages[selectedChannelId] ?? []} pinnedIds={pinnedIds[selectedChannelId] ?? []} presence={presence} profileId={profile.id} profileName={profile.name} status={status} statusMessage={statusMessage} searchQuery={searchQuery} searchResults={searchResults} activeCall={Boolean(activeCallChannelId)} pushToTalkEnabled={pushToTalkEnabled} pushToTalkKey={pushToTalkKey} isTransmitting={isTransmitting} canManage={profile.email === "gestaovybe@gmail.com"} readOnly={channelPermissions[selectedChannelId]?.readOnly ?? false} invitePolicy={channelPermissions[selectedChannelId]?.invitePolicy ?? "member"} onStatusChange={updateStatus} onSearch={searchMessages} onReact={reactToMessage} onPin={togglePin} onReply={message => { setThreadParent(message); setNotice(`Respondendo em thread a ${message.authorName}.`); }} onInvite={inviteToCall} onTogglePushToTalk={() => setPushToTalkEnabled(current => !current)} onPushToTalkKeyChange={setPushToTalkKey} onToggleReadOnly={toggleReadOnly} onSetRole={setMemberRole} onToggleInvitePolicy={toggleInvitePolicy} />{activeCallChannelId && !callStageOpen && <div className="fixed bottom-4 right-4 z-20 w-[min(92vw,360px)]"><button onClick={() => setCallStageOpen(true)} className="cyber-panel cyber-corner w-full p-3 text-left"><span className="cyber-label flex items-center gap-2"><MonitorUp className="size-4" />Palco em espera</span>{stageParticipants[0] && <div className="mt-3 h-28 overflow-hidden border border-orange-300/20"><MediaTile {...stageParticipants[0]} className="h-full min-h-0 rounded-none" /></div>}</button></div>}{activeCallChannelId && callStageOpen && <CallStage roomName={findExternalChannel(activeCallChannelId)?.name ?? "Chamada"} participants={stageParticipants} microphoneOn={microphoneOn} cameraOn={cameraOn} sharingScreen={Boolean(screenStream)} onToggleMic={toggleMic} onToggleCamera={toggleCamera} onShareScreen={shareScreen} onLeave={leaveVoice} onMinimize={() => setCallStageOpen(false)} />}</main>;
}
