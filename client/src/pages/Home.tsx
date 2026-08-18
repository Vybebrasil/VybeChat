import { useAuth } from "@/_core/hooks/useAuth";
import { MediaTile } from "@/components/MediaTile";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { getRealtimeSocket } from "@/lib/realtime";
import { getVoiceJoinAction, indexVoiceRooms, type VoiceRoom } from "@/lib/voice-room-state";
import { getCallMedia, getCallMediaErrorMessage } from "@/lib/call-media";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  CirclePlus,
  Hash,
  Loader2,
  LogOut,
  Menu,
  Mic,
  MicOff,
  MonitorUp,
  Phone,
  PanelTopOpen,
  Plus,
  SendHorizontal,
  Settings2,
  SmilePlus,
  Users,
  Video,
  VideoOff,
  Volume2,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Streamdown } from "streamdown";

type Presence = { userId: string; name: string; status: "online" | "away" | "offline" };
type RemoteStream = { socketId: string; stream: MediaStream };
type CallMember = { socketId: string; name: string };

const STATUS_COPY = {
  online: "Online",
  away: "Ausente",
  offline: "Offline",
} as const;

function initials(name?: string | null) {
  return (name || "V").split(" ").map(part => part[0]).slice(0, 2).join("").toUpperCase();
}

function PresenceDot({ status }: { status: Presence["status"] }) {
  const colors = { online: "bg-emerald-400", away: "bg-amber-400", offline: "bg-slate-500" };
  return <span className={`block size-2.5 rounded-full ring-2 ring-[#17111f] ${colors[status]}`} aria-label={STATUS_COPY[status]} />;
}

export default function Home() {
  const { user, loading, logout } = useAuth();
  const utils = trpc.useUtils();
  const workspaceQuery = trpc.workspace.list.useQuery(undefined, { enabled: Boolean(user) });
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [typingName, setTypingName] = useState<string | null>(null);
  const [presence, setPresence] = useState<Presence[]>([]);
  const [myStatus, setMyStatus] = useState<Presence["status"]>("online");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [categoryComposer, setCategoryComposer] = useState(false);
  const [channelComposer, setChannelComposer] = useState<number | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [newChannel, setNewChannel] = useState("");
  const [newChannelType, setNewChannelType] = useState<"text" | "voice">("text");
  const [callOpen, setCallOpen] = useState(false);
  const [activeCallChannelId, setActiveCallChannelId] = useState<number | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);
  const [remoteVolumes, setRemoteVolumes] = useState<Record<string, number>>({});
  const [callMembers, setCallMembers] = useState<Record<string, CallMember>>({});
  const [voiceRooms, setVoiceRooms] = useState<Record<number, VoiceRoom["members"]>>({});
  const [screenSharer, setScreenSharer] = useState<string | null>(null);
  const [microphoneOn, setMicrophoneOn] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [callNotice, setCallNotice] = useState<string | null>(null);
  const socketRef = useRef(getRealtimeSocket());
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef(new Map<string, RTCPeerConnection>());
  const activeCallChannelRef = useRef<number | null>(null);
  const typingTimerRef = useRef<number | undefined>(undefined);
  const audioDetectorRef = useRef<{ context: AudioContext; frame: number } | null>(null);

  const categories = workspaceQuery.data ?? [];
  const selectedChannel = useMemo(
    () => categories.flatMap(category => category.channels).find(channel => channel.id === selectedChannelId) ?? null,
    [categories, selectedChannelId]
  );
  const activeVoiceChannel = useMemo(
    () => categories.flatMap(category => category.channels).find(channel => channel.id === activeCallChannelId) ?? null,
    [activeCallChannelId, categories]
  );
  const activeVoiceMembers = activeCallChannelId ? voiceRooms[activeCallChannelId] ?? [] : [];
  const messagesQuery = trpc.messages.list.useQuery(
    { channelId: selectedChannelId ?? 1 },
    { enabled: Boolean(selectedChannelId && user), refetchOnWindowFocus: false }
  );

  useEffect(() => {
    if (selectedChannelId || categories.length === 0) return;
    setSelectedChannelId(categories.flatMap(category => category.channels).find(channel => channel.type === "text")?.id ?? null);
  }, [categories, selectedChannelId]);

  const createPeer = async (peerId: string, shouldCreateOffer = false) => {
    const existing = peerConnectionsRef.current.get(peerId);
    if (existing) return existing;

    const connection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    peerConnectionsRef.current.set(peerId, connection);
    localStreamRef.current?.getTracks().forEach(track => connection.addTrack(track, localStreamRef.current!));
    connection.onicecandidate = event => {
      if (event.candidate && activeCallChannelRef.current) {
        socketRef.current.emit("call:ice", {
          to: peerId,
          channelId: activeCallChannelRef.current,
          candidate: event.candidate,
        });
      }
    };
    connection.ontrack = event => {
      const [stream] = event.streams;
      if (!stream) return;
      setRemoteStreams(current => [...current.filter(remote => remote.socketId !== peerId), { socketId: peerId, stream }]);
    };
    connection.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(connection.connectionState)) {
        setRemoteStreams(current => current.filter(remote => remote.socketId !== peerId));
      }
    };

    if (shouldCreateOffer && activeCallChannelRef.current) {
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      socketRef.current.emit("call:offer", { to: peerId, channelId: activeCallChannelRef.current, offer });
    }
    return connection;
  };

  useEffect(() => {
    if (!user) return;
    const socket = socketRef.current;
    const joinPresence = () => {
      socket.emit("presence:join", { userId: String(user.id), name: user.name || "Operador Vybe", status: myStatus });
      if (selectedChannelId) socket.emit("channel:join", { channelId: selectedChannelId });
    };
    if (!socket.connected) socket.connect();
    socket.on("connect", joinPresence);
    socket.on("presence:update", (next: Presence[]) => setPresence(next));
    socket.on("voice:rooms", (rooms: VoiceRoom[]) => {
      setVoiceRooms(indexVoiceRooms(rooms));
    });
    socket.on("message:new", ({ channelId }: { channelId: number }) => {
      utils.messages.list.invalidate({ channelId });
    });
    socket.on("typing", ({ channelId, name, active }: { channelId: number; name: string; active: boolean }) => {
      if (channelId !== selectedChannelId) return;
      setTypingName(active ? name : null);
    });
    socket.on("call:peers", async ({ channelId, peers }: { channelId: number; peers: CallMember[] }) => {
      if (channelId !== activeCallChannelRef.current) return;
      setCallMembers(current => ({ ...current, ...Object.fromEntries(peers.map(peer => [peer.socketId, peer])) }));
      for (const peer of peers) await createPeer(peer.socketId, true);
    });
    socket.on("call:peer-joined", ({ channelId, peer }: { channelId: number; peer: CallMember }) => {
      if (channelId !== activeCallChannelRef.current) return;
      setCallMembers(current => ({ ...current, [peer.socketId]: peer }));
    });
    socket.on("call:offer", async ({ from, channelId, offer, user: caller }: { from: string; channelId: number; offer: RTCSessionDescriptionInit; user?: Presence }) => {
      if (channelId !== activeCallChannelRef.current) return;
      if (caller) setCallMembers(current => ({ ...current, [from]: { socketId: from, name: caller.name } }));
      const peer = await createPeer(from);
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit("call:answer", { to: from, channelId, answer });
    });
    socket.on("call:answer", async ({ from, channelId, answer }: { from: string; channelId: number; answer: RTCSessionDescriptionInit }) => {
      if (channelId !== activeCallChannelRef.current) return;
      const peer = peerConnectionsRef.current.get(from);
      if (peer) await peer.setRemoteDescription(new RTCSessionDescription(answer));
    });
    socket.on("call:ice", async ({ from, channelId, candidate }: { from: string; channelId: number; candidate: RTCIceCandidateInit }) => {
      if (channelId !== activeCallChannelRef.current) return;
      const peer = peerConnectionsRef.current.get(from);
      if (peer) await peer.addIceCandidate(new RTCIceCandidate(candidate));
    });
    socket.on("call:peer-left", ({ channelId, socketId }: { channelId: number; socketId: string }) => {
      if (channelId !== activeCallChannelRef.current) return;
      peerConnectionsRef.current.get(socketId)?.close();
      peerConnectionsRef.current.delete(socketId);
      setRemoteStreams(current => current.filter(remote => remote.socketId !== socketId));
      setCallMembers(current => {
        const next = { ...current };
        delete next[socketId];
        return next;
      });
    });
    socket.on("call:screen-share", ({ channelId, socketId, name }: { channelId: number; socketId: string | null; name: string | null }) => {
      if (channelId !== activeCallChannelRef.current) return;
      setScreenSharer(socketId ? name || "Participante" : null);
    });
    joinPresence();

    return () => {
      socket.off("connect", joinPresence);
      socket.off("presence:update");
      socket.off("voice:rooms");
      socket.off("message:new");
      socket.off("typing");
      socket.off("call:peers");
      socket.off("call:peer-joined");
      socket.off("call:offer");
      socket.off("call:answer");
      socket.off("call:ice");
      socket.off("call:peer-left");
      socket.off("call:screen-share");
    };
  }, [user, myStatus, selectedChannelId, utils]);

  useEffect(() => {
    if (!selectedChannelId || !socketRef.current.connected) return;
    socketRef.current.emit("channel:join", { channelId: selectedChannelId });
  }, [selectedChannelId]);

  const createCategoryMutation = trpc.workspace.createCategory.useMutation({
    onSuccess: async () => {
      setNewCategory("");
      setCategoryComposer(false);
      await utils.workspace.list.invalidate();
    },
  });
  const createChannelMutation = trpc.workspace.createChannel.useMutation({
    onSuccess: async () => {
      setNewChannel("");
      setChannelComposer(null);
      await utils.workspace.list.invalidate();
    },
  });
  const messageMutation = trpc.messages.create.useMutation({
    onSuccess: async (_, variables) => {
      await utils.messages.list.invalidate({ channelId: variables.channelId });
      socketRef.current.emit("message:new", { channelId: variables.channelId });
    },
  });

  const submitMessage = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedChannelId || !messageDraft.trim() || messageMutation.isPending) return;
    const content = messageDraft.trim();
    setMessageDraft("");
    socketRef.current.emit("typing", { channelId: selectedChannelId, name: user?.name || "Operador", active: false });
    messageMutation.mutate({ channelId: selectedChannelId, content });
  };

  const handleTyping = (value: string) => {
    setMessageDraft(value);
    if (!selectedChannelId) return;
    socketRef.current.emit("typing", { channelId: selectedChannelId, name: user?.name || "Operador", active: Boolean(value.trim()) });
    window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => {
      socketRef.current.emit("typing", { channelId: selectedChannelId, name: user?.name || "Operador", active: false });
    }, 1400);
  };

  const startCall = async (voiceChannelId = selectedChannelId, openStage = false) => {
    if (!voiceChannelId || !user || activeCallChannelRef.current) return;
    try {
      const result = await getCallMedia(navigator.mediaDevices);
      const stream = result.stream;
      localStreamRef.current = stream;
      setLocalStream(stream);
      setMicrophoneOn(true);
      setCameraOn(result.mode === "camera-and-audio");
      setCallNotice(result.mode === "audio-only" ? "Você entrou somente por áudio. A câmera não está disponível neste momento." : null);
      activeCallChannelRef.current = voiceChannelId;
      setActiveCallChannelId(voiceChannelId);
      setCallOpen(openStage);
      socketRef.current.emit("call:join", { channelId: voiceChannelId });
      const AudioContextClass = window.AudioContext;
      const audioTrack = stream.getAudioTracks()[0];
      if (AudioContextClass && audioTrack) {
        const context = new AudioContextClass();
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        const source = context.createMediaStreamSource(new MediaStream([audioTrack]));
        source.connect(analyser);
        const buffer = new Uint8Array(analyser.fftSize);
        let lastSpeaking = false;
        const detector = { context, frame: 0 };
        const detectVoice = () => {
          if (audioDetectorRef.current !== detector) return;
          analyser.getByteTimeDomainData(buffer);
          const energy = buffer.reduce((sum, value) => sum + Math.abs(value - 128), 0) / buffer.length;
          const speaking = audioTrack.enabled && energy > 2.4;
          if (speaking !== lastSpeaking && activeCallChannelRef.current) {
            lastSpeaking = speaking;
            setIsSpeaking(speaking);
            socketRef.current.emit("call:audio-state", { channelId: activeCallChannelRef.current, isMuted: !audioTrack.enabled, isSpeaking: speaking });
          }
          detector.frame = window.requestAnimationFrame(detectVoice);
        };
        audioDetectorRef.current = detector;
        detector.frame = window.requestAnimationFrame(detectVoice);
      }
    } catch (error) {
      setCallNotice(getCallMediaErrorMessage(error));
    }
  };

  const endCall = () => {
    const channelId = activeCallChannelRef.current;
    if (channelId) socketRef.current.emit("call:leave", { channelId });
    peerConnectionsRef.current.forEach(connection => connection.close());
    peerConnectionsRef.current.clear();
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    if (audioDetectorRef.current) {
      window.cancelAnimationFrame(audioDetectorRef.current.frame);
      audioDetectorRef.current.context.close();
      audioDetectorRef.current = null;
    }
    screenStream?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;
    activeCallChannelRef.current = null;
    setLocalStream(null);
    setScreenStream(null);
    setRemoteStreams([]);
    setRemoteVolumes({});
    setCallMembers({});
    setScreenSharer(null);
    setIsSpeaking(false);
    setActiveCallChannelId(null);
    setCallOpen(false);
  };

  const joinVoiceChannel = async (channelId: number) => {
    setSelectedChannelId(channelId);
    setMobileMenuOpen(false);
    const action = getVoiceJoinAction(activeCallChannelRef.current, channelId);
    if (action === "already-joined") return;
    if (action === "move") endCall();
    await startCall(channelId);
  };

  const toggleMicrophone = () => {
    const next = !microphoneOn;
    localStreamRef.current?.getAudioTracks().forEach(track => { track.enabled = next; });
    setMicrophoneOn(next);
    if (!next) setIsSpeaking(false);
    if (activeCallChannelRef.current) socketRef.current.emit("call:audio-state", { channelId: activeCallChannelRef.current, isMuted: !next, isSpeaking: next ? isSpeaking : false });
  };

  const toggleCamera = () => {
    if (!localStreamRef.current?.getVideoTracks().length) {
      setCallNotice("Você entrou somente por áudio. Saia e entre novamente após liberar ou conectar uma câmera.");
      return;
    }
    const next = !cameraOn;
    localStreamRef.current?.getVideoTracks().forEach(track => { track.enabled = next; });
    setCameraOn(next);
  };

  const stopScreenShare = () => {
    if (!screenStream || !activeCallChannelRef.current) return;
    const cameraTrack = localStreamRef.current?.getVideoTracks()[0] ?? null;
    peerConnectionsRef.current.forEach(connection => {
      connection.getSenders().find(sender => sender.track?.kind === "video")?.replaceTrack(cameraTrack);
    });
    screenStream.getTracks().forEach(track => track.stop());
    socketRef.current.emit("call:screen-share", { channelId: activeCallChannelRef.current, active: false });
    setScreenStream(null);
  };

  const toggleScreenShare = async () => {
    if (screenStream) return stopScreenShare();
    if (!activeCallChannelRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const screenTrack = stream.getVideoTracks()[0];
      if (!screenTrack) return;
      peerConnectionsRef.current.forEach(connection => {
        connection.getSenders().find(sender => sender.track?.kind === "video")?.replaceTrack(screenTrack);
      });
      screenTrack.onended = stopScreenShare;
      setScreenStream(stream);
      socketRef.current.emit("call:screen-share", { channelId: activeCallChannelRef.current, active: true });
    } catch {
      // O navegador cancela essa solicitação quando a pessoa fecha o seletor de tela.
    }
  };

  if (loading) {
    return <div className="grid min-h-screen place-items-center"><Loader2 className="size-6 animate-spin text-violet-300" /></div>;
  }

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center p-5">
        <section className="vybe-enter relative w-full max-w-lg overflow-hidden rounded-3xl border border-violet-300/15 bg-[#18131f]/90 p-8 shadow-2xl shadow-violet-950/30 backdrop-blur-xl sm:p-11">
          <div className="absolute -right-8 -top-8 size-40 rounded-full bg-violet-500/15 blur-3xl" />
          <div className="relative">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">Vybe OS / Comunicação</p>
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">Conecte o núcleo.</h1>
            <p className="mt-4 max-w-md text-base leading-7 text-violet-100/65">Uma central interna para conversar, alinhar e trabalhar junto em tempo real.</p>
            <Button onClick={() => startLogin()} className="mt-9 h-12 w-full bg-violet-500 text-base font-bold text-white shadow-lg shadow-violet-950/50 hover:bg-violet-400">Entrar no VybeChat</Button>
          </div>
        </section>
      </main>
    );
  }

  const onlineCount = presence.filter(member => member.status === "online").length;

  return (
    <main className="min-h-screen p-2 text-foreground sm:p-3">
      <section className="flex min-h-[calc(100vh-1rem)] overflow-hidden rounded-2xl border border-white/10 bg-[#100d16]/85 shadow-2xl shadow-black/40 backdrop-blur-xl sm:min-h-[calc(100vh-1.5rem)]">
        <aside className="hidden w-[78px] shrink-0 flex-col items-center border-r border-white/7 bg-[#0c0911]/80 py-4 lg:flex">
          <div className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-violet-400 to-fuchsia-700 font-mono text-xl font-bold text-white shadow-lg shadow-violet-900/35">V</div>
          <div className="my-4 h-px w-7 bg-white/10" />
          <div className="mb-4 flex h-14 w-8 flex-col justify-between overflow-hidden rounded-full border border-violet-300/15 bg-violet-400/[0.035] px-2 py-2" aria-label="Sinal Vybe ativo">
            <span className="h-1 rounded-full bg-violet-300/30" />
            <span className="h-4 rounded-full bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,.9)]" />
            <span className="h-2 rounded-full bg-violet-300/45" />
          </div>
          <button className="grid size-10 place-items-center rounded-xl border border-violet-300/20 bg-violet-400/13 text-violet-200" aria-label="Comunicação"><Users className="size-5" /></button>
          <button className="mt-3 grid size-10 place-items-center rounded-xl text-slate-500 transition hover:bg-white/5 hover:text-violet-200" aria-label="Notificações"><Bell className="size-5" /></button>
          <button className="mt-auto grid size-10 place-items-center rounded-xl text-slate-500 transition hover:bg-white/5 hover:text-violet-200" aria-label="Configurações"><Settings2 className="size-5" /></button>
        </aside>

        <aside className={`${mobileMenuOpen ? "fixed inset-y-0 left-0 z-30 flex w-[292px] shadow-2xl" : "hidden"} w-[286px] shrink-0 flex-col border-r border-white/7 bg-[#15101d]/92 lg:flex lg:static`}>
          <div className="flex h-[72px] items-center justify-between border-b border-white/7 px-5">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.19em] text-violet-300">Vybe OS</p>
              <h2 className="mt-0.5 text-sm font-bold text-white">Central de comunicação <span className="ml-1 font-mono text-[9px] font-normal tracking-wider text-violet-300/70">// SYNC</span></h2>
            </div>
            <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400 hover:text-white lg:hidden" aria-label="Fechar menu"><X className="size-5" /></button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4">
            {workspaceQuery.isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-violet-300" /></div>
            ) : categories.map(category => (
              <section key={category.id} className="mb-5">
                <div className="mb-1 flex items-center justify-between px-2">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{category.name}</p>
                  <button onClick={() => { setChannelComposer(category.id); setNewChannelType("text"); }} className="rounded p-1 text-slate-500 transition hover:bg-white/5 hover:text-violet-200" aria-label={`Criar canal em ${category.name}`}><Plus className="size-3.5" /></button>
                </div>
                <div className="space-y-0.5">
                  {category.channels.map(channel => {
                    const isActive = channel.id === selectedChannelId;
                    const roomMembers = voiceRooms[channel.id] ?? [];
                    const connectedHere = activeCallChannelId === channel.id;
                    return <div key={channel.id} className="mb-0.5">
                      <button onClick={() => channel.type === "voice" ? joinVoiceChannel(channel.id) : (setSelectedChannelId(channel.id), setMobileMenuOpen(false))} className={`group flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-sm transition ${isActive ? "bg-violet-400/14 text-violet-100" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"}`}>
                        {channel.type === "voice" ? <Volume2 className={`size-4 shrink-0 ${connectedHere ? "text-emerald-300" : ""}`} /> : <Hash className="size-4 shrink-0" />}
                        <span className="truncate">{channel.name}</span>
                        {channel.type === "voice" && <span className={`ml-auto font-mono text-[9px] ${roomMembers.length ? "text-emerald-300" : "text-slate-600"}`}>{roomMembers.length || ""}</span>}
                      </button>
                      {channel.type === "voice" && roomMembers.length > 0 && <div className="ml-5 border-l border-violet-300/15 py-1 pl-3"><div className="space-y-1">{roomMembers.map(member => <div key={member.socketId} className={`flex items-center gap-2 rounded-md px-1 py-0.5 ${member.isSpeaking ? "bg-emerald-400/10" : ""}`}><div className="relative"><Avatar className={`size-5 border ${member.isSpeaking ? "border-emerald-300/90 shadow-[0_0_10px_rgba(52,211,153,.65)]" : "border-white/10"}`}><AvatarFallback className="bg-violet-400/15 text-[8px] font-bold text-violet-100">{initials(member.name)}</AvatarFallback></Avatar><span className="absolute -bottom-0.5 -right-0.5"><PresenceDot status={member.status} /></span></div><span className={`truncate text-[11px] ${member.isSpeaking ? "font-bold text-emerald-200" : "text-slate-400"}`}>{member.name}{member.userId === String(user.id) ? " (você)" : ""}</span><span className="ml-auto">{member.isMuted ? <MicOff className="size-3 text-rose-300" /> : member.isSpeaking ? <span className="block size-2 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(52,211,153,.9)]" /> : <Mic className="size-3 text-slate-600" />}</span></div>)}</div></div>}
                    </div>;
                  })}
                </div>
                {channelComposer === category.id && (
                  <form onSubmit={event => { event.preventDefault(); if (newChannel.trim()) createChannelMutation.mutate({ categoryId: category.id, name: newChannel, type: newChannelType }); }} className="mt-2 space-y-2 rounded-xl border border-violet-300/15 bg-violet-950/20 p-2">
                    <Input value={newChannel} onChange={event => setNewChannel(event.target.value)} placeholder="nome-do-canal" autoFocus className="h-8 border-white/10 bg-black/20 text-xs" />
                    <div className="flex gap-1">
                      <button type="button" onClick={() => setNewChannelType("text")} className={`rounded px-2 py-1 font-mono text-[10px] ${newChannelType === "text" ? "bg-violet-400/20 text-violet-100" : "text-slate-500"}`}># TEXTO</button>
                      <button type="button" onClick={() => setNewChannelType("voice")} className={`rounded px-2 py-1 font-mono text-[10px] ${newChannelType === "voice" ? "bg-violet-400/20 text-violet-100" : "text-slate-500"}`}>⌁ VOZ</button>
                      <button type="button" onClick={() => setChannelComposer(null)} className="ml-auto px-1 text-slate-500"><X className="size-3.5" /></button>
                    </div>
                  </form>
                )}
              </section>
            ))}
            <div className="border-t border-white/7 pt-3">
              {categoryComposer ? (
                <form onSubmit={event => { event.preventDefault(); if (newCategory.trim()) createCategoryMutation.mutate({ name: newCategory }); }} className="flex gap-1">
                  <Input value={newCategory} onChange={event => setNewCategory(event.target.value)} placeholder="Nova categoria" autoFocus className="h-8 border-white/10 bg-black/20 text-xs" />
                  <Button type="submit" size="icon" className="size-8 bg-violet-500 hover:bg-violet-400"><Plus className="size-4" /></Button>
                </form>
              ) : <button onClick={() => setCategoryComposer(true)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold text-slate-500 transition hover:bg-white/5 hover:text-violet-200"><CirclePlus className="size-4" />Criar categoria</button>}
            </div>
          </div>

          {activeVoiceChannel && <div className="border-t border-violet-300/15 bg-violet-500/[0.08] p-3"><div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-emerald-400/15 text-emerald-300"><Volume2 className="size-3.5" /></span><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold text-emerald-200">Conectado: {activeVoiceChannel.name}</p><p className="text-[10px] text-emerald-300/60">{activeVoiceMembers.length} na sala</p></div><button onClick={() => setCallOpen(true)} className="rounded p-1.5 text-violet-200 hover:bg-white/8" aria-label="Abrir chamada"><PanelTopOpen className="size-3.5" /></button></div>{callNotice && <p className="mt-2 rounded-lg border border-amber-300/15 bg-amber-400/10 px-2 py-1.5 text-[10px] leading-4 text-amber-100">{callNotice}</p>}<div className="mt-2 flex gap-1"><button onClick={toggleMicrophone} className={`grid size-7 place-items-center rounded-md ${microphoneOn ? "bg-white/8 text-slate-300" : "bg-rose-500/20 text-rose-200"}`} aria-label="Microfone">{microphoneOn ? <Mic className="size-3.5" /> : <MicOff className="size-3.5" />}</button><button onClick={toggleCamera} className={`grid size-7 place-items-center rounded-md ${cameraOn ? "bg-white/8 text-slate-300" : "bg-rose-500/20 text-rose-200"}`} aria-label="Câmera">{cameraOn ? <Video className="size-3.5" /> : <VideoOff className="size-3.5" />}</button><button onClick={toggleScreenShare} className={`grid size-7 place-items-center rounded-md ${screenStream ? "bg-violet-400/25 text-violet-100" : "bg-white/8 text-slate-300"}`} aria-label={screenStream ? "Parar compartilhamento de tela" : "Compartilhar tela"}><MonitorUp className="size-3.5" /></button><button onClick={endCall} className="ml-auto grid size-7 place-items-center rounded-md bg-rose-500/80 text-white hover:bg-rose-400" aria-label="Sair da sala"><Phone className="size-3.5 rotate-[135deg]" /></button></div></div>}
          <div className="border-t border-white/7 bg-[#0e0a14]/70 p-3">
            <div className="flex items-center gap-2.5">
              <div className="relative"><Avatar className="size-8 border border-violet-200/25"><AvatarFallback className="bg-violet-400/15 text-xs font-bold text-violet-100">{initials(user.name)}</AvatarFallback></Avatar><span className="absolute -bottom-0.5 -right-0.5"><PresenceDot status={myStatus} /></span></div>
              <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-white">{user.name || "Operador Vybe"}</p><button onClick={() => { const next = myStatus === "online" ? "away" : "online"; setMyStatus(next); socketRef.current.emit("presence:status", next); }} className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-violet-200"><ChevronDown className="size-3" />{STATUS_COPY[myStatus]}</button></div>
              <button onClick={logout} className="rounded p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-rose-300" aria-label="Sair"><LogOut className="size-4" /></button>
            </div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-[#130f1a]/40">
          <header className="flex h-[72px] shrink-0 items-center gap-3 border-b border-white/7 px-4 sm:px-6">
            <button onClick={() => setMobileMenuOpen(true)} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white lg:hidden" aria-label="Abrir canais"><Menu className="size-5" /></button>
            <div className="flex min-w-0 items-center gap-2"><Hash className="size-5 shrink-0 text-violet-300" /><div className="min-w-0"><h1 className="truncate text-base font-bold text-white">{selectedChannel?.name || "Carregando canal"}</h1><p className="hidden text-xs text-slate-500 sm:block">Canal interno da Vybe</p></div></div>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="mr-2 hidden items-center gap-2 rounded-full border border-emerald-300/10 bg-emerald-400/6 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-emerald-300 md:flex"><span className="size-1.5 rounded-full bg-emerald-400" />{onlineCount} online</span>
              {activeVoiceChannel ? <Button onClick={() => setCallOpen(true)} size="sm" className="h-9 gap-2 bg-emerald-500/90 px-3 text-xs font-bold text-white hover:bg-emerald-400"><Volume2 className="size-4" /><span className="hidden sm:inline">Retomar sala</span></Button> : selectedChannel?.type === "voice" ? <Button onClick={() => joinVoiceChannel(selectedChannel.id)} size="sm" className="h-9 gap-2 bg-violet-500 px-3 text-xs font-bold hover:bg-violet-400"><Volume2 className="size-4" /><span className="hidden sm:inline">Entrar na sala</span></Button> : null}
            </div>
          </header>

          <div className="flex min-h-0 flex-1">
            <section className="flex min-w-0 flex-1 flex-col">
              <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-7">
                <div className="mx-auto max-w-4xl">
                  <div className="vybe-enter mb-8 border-b border-white/7 pb-7">
                    <div className="grid size-14 place-items-center rounded-2xl border border-violet-300/20 bg-violet-400/10 text-violet-200"><Hash className="size-7" /></div>
                    <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-white">#{selectedChannel?.name || "canal"}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-400">Você chegou ao início do canal. Use-o para decisões, alinhamentos e registros importantes do time.</p>
                  </div>
                  {messagesQuery.isLoading ? <div className="flex justify-center py-10"><Loader2 className="size-5 animate-spin text-violet-300" /></div> : messagesQuery.data?.length ? (
                    <div className="space-y-5">
                      {messagesQuery.data.map(message => (
                        <article key={message.id} className="group flex gap-3.5">
                          <Avatar className="mt-0.5 size-9 shrink-0 border border-violet-200/15"><AvatarFallback className="bg-violet-400/12 text-xs font-bold text-violet-100">{initials(message.authorName)}</AvatarFallback></Avatar>
                          <div className="min-w-0"><div className="flex items-baseline gap-2"><p className="text-sm font-bold text-white">{message.authorName || "Operador Vybe"}</p><time className="font-mono text-[10px] text-slate-600">{new Date(message.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</time></div><div className="prose prose-sm prose-invert mt-1 max-w-none break-words text-slate-300 prose-p:my-0 prose-strong:text-violet-100"><Streamdown>{message.content}</Streamdown></div></div>
                        </article>
                      ))}
                    </div>
                  ) : <div className="relative overflow-hidden rounded-2xl border border-dashed border-violet-300/15 bg-[linear-gradient(135deg,rgba(139,92,246,.07),transparent_44%)] p-7 text-center"><div className="pointer-events-none absolute left-1/2 top-1/2 size-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-violet-300/10 shadow-[0_0_0_14px_rgba(139,92,246,.025),0_0_0_28px_rgba(139,92,246,.018)]" /><p className="relative font-mono text-[10px] font-bold uppercase tracking-[0.19em] text-violet-300">Canal armado / sinal aberto</p><p className="relative mt-3 text-sm font-semibold text-slate-200">A próxima direção começa aqui.</p><p className="relative mt-1 text-xs text-slate-500">Registre o primeiro pulso do time neste canal.</p></div>}
                </div>
              </div>
              <form onSubmit={submitMessage} className="mx-auto w-full max-w-4xl shrink-0 px-4 pb-4 sm:px-7 sm:pb-6">
                {typingName && <p className="mb-1.5 text-[11px] text-violet-300">{typingName} está digitando...</p>}
                <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-[#1c1625] p-2 shadow-xl shadow-black/10 focus-within:border-violet-400/45 focus-within:ring-4 focus-within:ring-violet-400/8">
                  <button type="button" className="mb-1 rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-violet-200" aria-label="Adicionar conteúdo"><Plus className="size-4" /></button>
                  <Textarea value={messageDraft} onChange={event => handleTyping(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) submitMessage(event); }} placeholder={`Enviar mensagem para #${selectedChannel?.name || "canal"}`} className="min-h-10 max-h-28 flex-1 resize-none border-0 bg-transparent px-1 py-2 text-sm shadow-none focus-visible:ring-0" rows={1} />
                  <button type="button" className="mb-1 rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-violet-200" aria-label="Adicionar reação"><SmilePlus className="size-4" /></button>
                  <Button type="submit" disabled={!messageDraft.trim() || messageMutation.isPending} size="icon" className="mb-1 size-8 bg-violet-500 hover:bg-violet-400"><SendHorizontal className="size-4" /></Button>
                </div>
                <p className="mt-2 pl-2 text-[10px] text-slate-600">Enter para enviar · Shift + Enter para quebrar linha · Markdown básico disponível</p>
              </form>
            </section>

            <aside className="hidden w-[232px] shrink-0 border-l border-white/7 bg-[#120e19]/60 p-4 xl:block">
              <div className="flex items-center justify-between"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Membros — {presence.length}</p><Users className="size-4 text-slate-600" /></div>
              <div className="mt-4 space-y-1.5">
                {presence.length ? presence.map(member => <div key={member.userId} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5"><div className="relative"><Avatar className="size-7 border border-white/10"><AvatarFallback className="bg-white/5 text-[10px] font-bold text-slate-300">{initials(member.name)}</AvatarFallback></Avatar><span className="absolute -bottom-0.5 -right-0.5"><PresenceDot status={member.status} /></span></div><span className="truncate text-xs font-medium text-slate-300">{member.name}</span></div>) : <p className="mt-5 text-xs leading-5 text-slate-600">Conectando presença do time...</p>}
              </div>
            </aside>
          </div>
        </section>
      </section>

      {callOpen && (
        <section className="fixed inset-0 z-50 flex flex-col bg-[#0c0911]/97 backdrop-blur-xl">
          <header className="flex h-[70px] shrink-0 items-center gap-3 border-b border-white/8 px-5 sm:px-7"><span className="grid size-9 place-items-center rounded-xl bg-violet-400/15 text-violet-200"><Video className="size-4" /></span><div><p className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-violet-300">Chamada em andamento</p><h2 className="text-sm font-bold text-white">#{categories.flatMap(category => category.channels).find(channel => channel.id === activeCallChannelId)?.name || "sala-vybe"}</h2></div><span className="ml-auto hidden rounded-full border border-white/8 bg-white/4 px-3 py-1.5 font-mono text-[10px] text-slate-400 sm:block">P2P / WEBRTC</span></header>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5 sm:p-7">{callNotice && <p className="mx-auto mb-4 w-full max-w-6xl rounded-xl border border-amber-300/15 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100">{callNotice}</p>}<div className="mx-auto grid w-full max-w-6xl flex-1 auto-rows-fr grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"><MediaTile stream={screenStream || localStream} label={user.name || "Você"} muted isLocal cameraOn={screenStream ? true : cameraOn} microphoneOn={microphoneOn} speaking={isSpeaking} sharingScreen={Boolean(screenStream)} accent={Boolean(screenStream)} />{remoteStreams.map(remote => { const member = activeVoiceMembers.find(candidate => candidate.socketId === remote.socketId); return <MediaTile key={remote.socketId} stream={remote.stream} label={member?.name || callMembers[remote.socketId]?.name || "Participante"} microphoneOn={!member?.isMuted} speaking={Boolean(member?.isSpeaking)} sharingScreen={screenSharer === member?.name} accent={screenSharer === member?.name} volume={remoteVolumes[remote.socketId] ?? 100} onVolumeChange={volume => setRemoteVolumes(current => ({ ...current, [remote.socketId]: volume }))} />})}</div>{screenSharer && <p className="mx-auto mt-4 rounded-full border border-violet-300/15 bg-violet-400/10 px-3 py-1.5 text-xs text-violet-100"><MonitorUp className="mr-1.5 inline size-3.5" />{screenSharer} está compartilhando a tela</p>}</div>
          <footer className="flex shrink-0 items-center justify-center gap-3 border-t border-white/8 p-5"><Button onClick={toggleMicrophone} variant="outline" size="icon" className={`size-11 rounded-2xl border-white/10 ${!microphoneOn ? "bg-rose-500/15 text-rose-200" : "bg-white/5 text-slate-200"}`}>{microphoneOn ? <Mic className="size-5" /> : <MicOff className="size-5" />}</Button><Button onClick={toggleCamera} variant="outline" size="icon" className={`size-11 rounded-2xl border-white/10 ${!cameraOn ? "bg-rose-500/15 text-rose-200" : "bg-white/5 text-slate-200"}`}>{cameraOn ? <Video className="size-5" /> : <VideoOff className="size-5" />}</Button><Button onClick={toggleScreenShare} variant="outline" size="icon" className={`size-11 rounded-2xl border-white/10 ${screenStream ? "bg-violet-400/20 text-violet-100" : "bg-white/5 text-slate-200"}`}><MonitorUp className="size-5" /></Button><Button onClick={endCall} size="icon" className="size-11 rounded-2xl bg-rose-500 text-white hover:bg-rose-400"><Phone className="size-5 rotate-[135deg]" /></Button></footer>
        </section>
      )}
    </main>
  );
}
