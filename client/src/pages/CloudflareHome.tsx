import { CallStage } from "@/components/CallStage";
import { CollaborationDrawer } from "@/components/CollaborationDrawer";
import { CallPreflightDialog } from "@/components/CallPreflightDialog";
import { CommandTelemetryRail } from "@/components/CommandTelemetryRail";
import { CommandNavigation } from "@/components/CommandNavigation";
import { DirectMessagesDrawer, type DirectMessage, type DirectThread } from "@/components/DirectMessagesDrawer";
import { MediaTile } from "@/components/MediaTile";
import { VoiceContextDock } from "@/components/VoiceContextDock";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getSelectedAudioTrack, listAudioInputs, type AudioInput } from "@/lib/audio-input";
import { getCallMedia, getCallMediaErrorMessage, type CallDeviceSelection } from "@/lib/call-media";
import { normalizeExternalMessage } from "@/lib/cloudflare-safe-message";
import { EXTERNAL_WORKSPACE, findExternalChannel } from "@/lib/external-workspace";
import { drainIceCandidates, queueIceCandidate, type PendingIceCandidates } from "@/lib/ice-candidates";
import { createLocalProfile, type LocalProfile } from "@/lib/local-profile";
import { summarizePeerAudioStats, type PeerAudioDiagnostics } from "@/lib/peer-audio-diagnostics";
import { getRealtimeSocket } from "@/lib/realtime";
import type { VoiceRoom } from "@/lib/voice-room-state";
import { Bell, Hash, LogOut, Menu, Mic, MicOff, MonitorUp, Phone, Pin, Search, SendHorizontal, SmilePlus, UserPlus, Video, VideoOff, Volume2, X } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Profile = LocalProfile;
type Presence = { userId: string; name: string; status: "online" | "away" | "offline" | "focus" | "meeting"; statusMessage?: string; role?: "admin" | "moderator" | "member" };
type ExternalMessage = { id: string; channelId: number; userId: string; authorName: string; content: string; createdAt: string; parentId?: string | null; reactions?: Record<string, string[]> };
type RemoteStream = { socketId: string; stream: MediaStream };
type CallPeer = { socketId: string; name: string };

const PROFILE_KEY = "vybechat-cloudflare-profile";

function initials(name: string) {
  return name.split(" ").map(part => part[0]).slice(0, 2).join("").toUpperCase() || "V";
}

function directThreadId(firstUserId: string, secondUserId: string) {
  return `direct:${[firstUserId, secondUserId].sort().join("|")}`;
}

function loadProfile(): Profile | null {
  try {
    if (window.location.pathname === "/cloudflare-preview" && new URLSearchParams(window.location.search).get("demo") === "1") {
      return { id: "preview-vybe", name: "Vybe Preview" };
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
  const [peerAudioDiagnostics, setPeerAudioDiagnostics] = useState<Record<string, PeerAudioDiagnostics>>({});
  const [audioInputs, setAudioInputs] = useState<AudioInput[]>([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState("");
  const [preflightChannelId, setPreflightChannelId] = useState<number | null>(null);
  const [directOpen, setDirectOpen] = useState(false);
  const [directThreads, setDirectThreads] = useState<DirectThread[]>([]);
  const [directMessages, setDirectMessages] = useState<Record<string, DirectMessage[]>>({});
  const [activeDirectThreadId, setActiveDirectThreadId] = useState<string | null>(null);
  const [handRaised, setHandRaised] = useState(false);
  const socketRef = useRef(getRealtimeSocket());
  const localStreamRef = useRef<MediaStream | null>(null);
  const activeCallRef = useRef<number | null>(null);
  const peerConnectionsRef = useRef(new Map<string, RTCPeerConnection>());
  const pendingIceCandidatesRef = useRef<PendingIceCandidates>(new Map());

  const selectedChannel = useMemo(() => findExternalChannel(selectedChannelId), [selectedChannelId]);
  const isContextPreview = window.location.pathname === "/cloudflare-preview" && new URLSearchParams(window.location.search).get("demo") === "1" && new URLSearchParams(window.location.search).get("call") === "1";
  const activeRoomMembers = activeCallChannelId ? (isContextPreview ? [{ socketId: "preview-vybe", userId: "preview-vybe", name: "Vybe Preview", status: "online" as const, isMuted: false, isSpeaking: false }, { socketId: "preview-paulo", userId: "preview-paulo", name: "Paulo", status: "online" as const, isMuted: false, isSpeaking: true }] : voiceRooms[activeCallChannelId] ?? []) : [];
  const channelMessages = messages[selectedChannelId] ?? [];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (window.location.pathname === "/cloudflare-preview" && params.get("demo") === "1" && params.get("call") === "1") {
      setActiveCallChannelId(5);
      setVoiceRooms({ 5: [{ socketId: "preview-vybe", userId: "preview-vybe", name: "Vybe Preview", status: "online", isMuted: false, isSpeaking: false }, { socketId: "preview-paulo", userId: "preview-paulo", name: "Paulo", status: "online", isMuted: false, isSpeaking: true }] });
    }
  }, []);

  const flushPendingIceCandidates = async (peerId: string, connection: RTCPeerConnection) => {
    if (!connection.remoteDescription) return;
    for (const candidate of drainIceCandidates(pendingIceCandidatesRef.current, peerId)) {
      try {
        await connection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.warn("[VybeChat] candidate ICE pendente recusado", { peerId, error });
      }
    }
  };

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
      setRemoteStreams(current => {
        const existing = current.find(item => item.socketId === peerId);
        const stream = event.streams[0] ?? existing?.stream ?? new MediaStream();
        if (!stream.getTracks().some(track => track.id === event.track.id)) stream.addTrack(event.track);
        return [...current.filter(item => item.socketId !== peerId), { socketId: peerId, stream }];
      });
    };
    connection.onconnectionstatechange = () => {
      if (connection.connectionState !== "failed" || !activeCallRef.current) return;
      void (async () => {
        try {
          const offer = await connection.createOffer({ iceRestart: true });
          await connection.setLocalDescription(offer);
          socketRef.current.emit("call:offer", { to: peerId, channelId: activeCallRef.current, offer });
        } catch {
          setNotice("A conexão com um participante caiu. Tente sair e entrar novamente na sala.");
        }
      })();
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
      socket.emit("presence:join", { userId: profile.id, name: profile.name, status, statusMessage });
      socket.emit("channel:join", { channelId: selectedChannelId });
      socket.emit("direct:list", {});
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
    socket.on("direct:list", ({ threads }: { threads: DirectThread[] }) => setDirectThreads(threads));
    socket.on("direct:history", ({ threadId, messages: history }: { threadId: string; messages: DirectMessage[] }) => setDirectMessages(current => ({ ...current, [threadId]: history })));
    socket.on("direct:new", ({ thread, message }: { thread: DirectThread; message: DirectMessage }) => {
      setDirectThreads(current => [thread, ...current.filter(item => item.id !== thread.id)].sort((first, second) => second.updatedAt.localeCompare(first.updatedAt)));
      setDirectMessages(current => ({ ...current, [thread.id]: [...(current[thread.id] ?? []).filter(item => item.id !== message.id), message] }));
      if (message.userId !== profile.id && activeDirectThreadId !== thread.id) setNotice(`${message.authorName} enviou uma mensagem direta.`);
    });
    socket.on("direct:read", ({ thread }: { thread: DirectThread }) => setDirectThreads(current => current.map(item => item.id === thread.id ? thread : item)));
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
      await flushPendingIceCandidates(from, peer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit("call:answer", { to: from, channelId, answer });
    });
    socket.on("call:answer", async ({ from, channelId, answer }: { from: string; channelId: number; answer: RTCSessionDescriptionInit }) => {
      if (channelId !== activeCallRef.current) return;
      const peer = peerConnectionsRef.current.get(from);
      if (!peer) return;
      await peer.setRemoteDescription(new RTCSessionDescription(answer));
      await flushPendingIceCandidates(from, peer);
    });
    socket.on("call:ice", async ({ from, channelId, candidate }: { from: string; channelId: number; candidate: RTCIceCandidateInit }) => {
      if (channelId !== activeCallRef.current) return;
      const peer = await createPeer(from);
      if (!peer.remoteDescription) {
        queueIceCandidate(pendingIceCandidatesRef.current, from, candidate);
        return;
      }
      try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.warn("[VybeChat] candidate ICE recusado", { peerId: from, error });
      }
    });
    socket.on("call:peer-left", ({ socketId }: { socketId: string }) => {
      peerConnectionsRef.current.get(socketId)?.close();
      peerConnectionsRef.current.delete(socketId);
      pendingIceCandidatesRef.current.delete(socketId);
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
      ["connect", "presence:update", "voice:rooms", "message:history", "message:new", "message:update", "message:pins", "message:search-results", "channel:permissions", "direct:list", "direct:history", "direct:new", "direct:read", "typing", "call:invite", "call:peers", "call:peer-joined", "call:offer", "call:answer", "call:ice", "call:peer-left", "call:screen-share", "realtime:error"].forEach(event => socket.off(event));
    };
  }, [activeDirectThreadId, profile, selectedChannelId, status, statusMessage]);

  useEffect(() => {
    if (profile && socketRef.current.connected) socketRef.current.emit("channel:join", { channelId: selectedChannelId });
  }, [profile, selectedChannelId]);

  useEffect(() => {
    if (!profile || !navigator.mediaDevices?.enumerateDevices) return;
    void listAudioInputs(navigator.mediaDevices).then(setAudioInputs).catch(() => setAudioInputs([]));
  }, [profile]);

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

  useEffect(() => {
    if (!activeCallChannelId) {
      setPeerAudioDiagnostics({});
      return;
    }
    let active = true;
    const collect = async () => {
      const entries = await Promise.all(Array.from(peerConnectionsRef.current.entries()).map(async ([peerId, connection]) => {
        try {
          const report = await connection.getStats();
          return [peerId, summarizePeerAudioStats(report.values(), connection.connectionState)] as const;
        } catch {
          return [peerId, { sending: false, receiving: false, connection: connection.connectionState, quality: connection.connectionState === "failed" || connection.connectionState === "disconnected" ? "recovering" : "connecting" }] as const;
        }
      }));
      if (active) setPeerAudioDiagnostics(Object.fromEntries(entries));
    };
    void collect();
    const timer = window.setInterval(() => void collect(), 1800);
    return () => { active = false; window.clearInterval(timer); };
  }, [activeCallChannelId, remoteStreams.length]);

  const stageParticipants = useMemo(() => {
    const local = localStream && profile ? [{
      id: "local",
      stream: screenStream || localStream,
      label: profile.name,
      muted: true,
      isLocal: true,
      cameraOn: screenStream ? true : cameraOn,
      microphoneOn,
      handRaised,
      sharingScreen: Boolean(screenStream),
      accent: Boolean(screenStream),
    }] : [];
    const remote = remoteStreams.map(remoteStream => {
      const member = activeRoomMembers.find(candidate => candidate.socketId === remoteStream.socketId);
      const label = member?.name || callPeers[remoteStream.socketId]?.name || "Participante";
      const hasVideo = remoteStream.stream.getVideoTracks().some(track => track.readyState === "live" && track.enabled);
      return {
        id: remoteStream.socketId,
        stream: remoteStream.stream,
        label,
        microphoneOn: !member?.isMuted,
        cameraOn: hasVideo,
        speaking: Boolean(member?.isSpeaking),
        handRaised: Boolean(member?.handRaised),
        sharingScreen: screenSharer === label,
        accent: screenSharer === label,
        volume: remoteVolumes[remoteStream.socketId] ?? 100,
        onVolumeChange: (volume: number) => setRemoteVolumes(current => ({ ...current, [remoteStream.socketId]: volume })),
      };
    });
    return [...local, ...remote];
  }, [activeRoomMembers, cameraOn, callPeers, handRaised, localStream, microphoneOn, profile, remoteStreams, remoteVolumes, screenSharer, screenStream]);

  const submitProfile = (event: FormEvent) => {
    event.preventDefault();
    const next = createLocalProfile(name);
    if (!next) return;
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
  const openDirectMessage = (peer: { userId: string; name: string }) => {
    if (!profile) return;
    const threadId = directThreadId(profile.id, peer.userId);
    setDirectOpen(true);
    setActiveDirectThreadId(threadId);
    setDirectThreads(current => current.some(item => item.id === threadId) ? current : [{ id: threadId, peerUserId: peer.userId, peerName: peer.name, lastMessage: "", updatedAt: new Date(0).toISOString(), unreadCount: 0 }, ...current]);
    socketRef.current.emit("direct:history", { peerUserId: peer.userId });
    socketRef.current.emit("direct:read", { peerUserId: peer.userId });
  };
  const sendDirectMessage = (thread: DirectThread, content: string) => {
    socketRef.current.emit("direct:new", { toUserId: thread.peerUserId, toName: thread.peerName, content });
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
    pendingIceCandidatesRef.current.clear();
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
    setHandRaised(false);
  };

  const joinVoice = async (channelId: number, selection: CallDeviceSelection = {}) => {
    if (activeCallRef.current === channelId) return setCallStageOpen(true);
    try {
      if (activeCallRef.current) leaveVoice();
      const { stream, mode } = await getCallMedia(navigator.mediaDevices, selection);
      localStreamRef.current = stream;
      activeCallRef.current = channelId;
      setLocalStream(stream);
      setActiveCallChannelId(channelId);
      setSelectedChannelId(channelId);
      setMicrophoneOn(true);
      setCameraOn(mode === "camera-and-audio");
      setSelectedAudioInput(selection.audioInputId ?? "");
      setHandRaised(false);
      setNotice(mode === "audio-only" ? "Você entrou somente por áudio." : null);
      setCallStageOpen(false);
      setMobileSidebarOpen(false);
      socketRef.current.emit("call:join", { channelId });
    } catch (error) {
      setNotice(getCallMediaErrorMessage(error));
    }
  };

  const prepareVoice = (channelId: number) => {
    if (activeCallRef.current === channelId) return setCallStageOpen(true);
    setPreflightChannelId(channelId);
  };

  const toggleMic = () => {
    const next = !microphoneOn;
    localStreamRef.current?.getAudioTracks().forEach(track => { track.enabled = next; });
    setMicrophoneOn(next);
    if (activeCallRef.current) socketRef.current.emit("call:audio-state", { channelId: activeCallRef.current, isMuted: !next, isSpeaking: false });
  };

  const toggleHandRaise = () => {
    if (!activeCallRef.current) return;
    const next = !handRaised;
    setHandRaised(next);
    socketRef.current.emit("call:hand-raise", { channelId: activeCallRef.current, active: next });
  };

  const toggleCamera = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return setNotice("Nenhuma câmera está disponível nesta chamada.");
    track.enabled = !cameraOn;
    setCameraOn(!cameraOn);
  };

  const changeAudioInput = async (deviceId: string) => {
    setSelectedAudioInput(deviceId);
    if (!deviceId || !localStreamRef.current) return;
    try {
      const { track } = await getSelectedAudioTrack(navigator.mediaDevices, deviceId);
      track.enabled = microphoneOn;
      const previousTrack = localStreamRef.current.getAudioTracks()[0];
      localStreamRef.current.removeTrack(previousTrack);
      localStreamRef.current.addTrack(track);
      previousTrack?.stop();
      await Promise.all(Array.from(peerConnectionsRef.current.values()).map(peer => peer.getSenders().find(sender => sender.track?.kind === "audio")?.replaceTrack(track)));
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      setNotice("Microfone atualizado para esta chamada.");
    } catch (error) {
      setNotice(getCallMediaErrorMessage(error));
    }
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
        const cameraTrack = localStreamRef.current?.getVideoTracks()[0] ?? null;
        peerConnectionsRef.current.forEach(peer => { void peer.getSenders().find(sender => sender.track?.kind === "video")?.replaceTrack(cameraTrack); });
        if (activeCallRef.current) socketRef.current.emit("call:screen-share", { channelId: activeCallRef.current, active: false });
        setScreenStream(null);
        setScreenSharer(null);
      };
    } catch {
      setNotice("O compartilhamento de tela foi cancelado.");
    }
  };

  if (!profile) {
    return <main className="cyber-grid grid min-h-screen place-items-center overflow-hidden p-5"><form onSubmit={submitProfile} className="cyber-panel cyber-corner cyber-reveal w-full max-w-md p-1"><div className="border border-orange-300/15 bg-[#0c0d10]/80 p-7 sm:p-9"><div className="flex items-center justify-between"><p className="cyber-label">VybeChat</p><span className="signal-pulse size-2 rounded-full bg-orange-400" /></div><h1 className="mt-6 font-sans text-3xl font-semibold tracking-tight text-orange-100">Entre para conversar<br />com a equipe.</h1><p className="mt-2 text-sm leading-6 text-stone-400">Escolha um nome. Nós vamos lembrar você neste dispositivo.</p><div className="my-7 h-px bg-gradient-to-r from-orange-500/70 via-orange-200/10 to-transparent" /><div className="space-y-3"><Input value={name} onChange={event => setName(event.target.value)} placeholder="Seu nome" autoComplete="username" className="h-12 rounded-xl border-orange-300/20 bg-black/50 text-orange-50 placeholder:text-stone-600 focus-visible:ring-orange-400" /><Button className="h-12 w-full rounded-xl bg-orange-500 font-semibold text-black hover:bg-orange-400">Entrar no VybeChat</Button></div><p className="mt-5 text-xs text-stone-500">Sem senha e sem e-mail. Você pode trocar de nome ao sair.</p></div></form></main>;
  }

  const sidebar = <aside className={`${mobileSidebarOpen ? "fixed inset-y-0 left-0 z-40 flex w-[292px] shadow-2xl" : "hidden"} cyber-panel flex-col bg-[#0a0b0f]/98 md:relative md:flex md:w-[292px] md:shrink-0`}>
    <div className="border-b border-orange-300/15 px-5 py-5"><div className="flex items-start justify-between"><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl border border-orange-300/45 bg-orange-400/10 text-sm font-extrabold text-orange-300">V</span><div><p className="cyber-label">Equipe Vybe</p><h2 className="mt-1 font-sans text-lg font-semibold tracking-tight text-orange-100">VybeChat</h2></div></div><button onClick={() => setMobileSidebarOpen(false)} className="grid size-8 rounded-lg border border-orange-300/15 text-orange-200 md:hidden" aria-label="Fechar canais"><X className="size-4" /></button></div><div className="mt-4 flex items-center gap-2 text-xs text-stone-400"><span className="size-1.5 rounded-full bg-emerald-400" />Todos os sistemas online</div></div>
    <div className="flex-1 overflow-y-auto px-3 py-4"><CommandNavigation groups={EXTERNAL_WORKSPACE} selectedChannelId={selectedChannelId} voiceRooms={voiceRooms} onSelectText={selectChannel} onJoinVoice={prepareVoice} /></div>
    {activeCallChannelId && <div className="border-y border-orange-300/15 p-3"><VoiceContextDock roomName={findExternalChannel(activeCallChannelId)?.name ?? "Sala de voz"} participantCount={activeRoomMembers.length} microphoneOn={microphoneOn} cameraOn={cameraOn} screenSharing={Boolean(screenStream)} audioInputs={audioInputs} selectedAudioInput={selectedAudioInput} onAudioInputChange={changeAudioInput} onToggleMic={toggleMic} onToggleCamera={toggleCamera} onShareScreen={shareScreen} onOpenFocus={() => setCallStageOpen(true)} onLeave={leaveVoice} /></div>}
    <div className="flex items-center gap-2 border-t border-orange-300/15 p-3"><Avatar className="size-9"><AvatarFallback className="rounded-xl border border-orange-300/25 bg-orange-400/10 text-xs text-orange-100">{initials(profile.name)}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-orange-50">{profile.name}</p><p className="text-[11px] text-emerald-400">Online</p></div><button onClick={() => { leaveVoice(); localStorage.removeItem(PROFILE_KEY); setProfile(null); }} aria-label="Sair"><LogOut className="size-4 text-stone-500" /></button></div>
  </aside>;

  const currentRole = presence.find(member => member.userId === profile.id)?.role ?? "member";
  return <main className="cyber-grid flex min-h-screen p-0 text-foreground md:p-3"><CallPreflightDialog open={preflightChannelId !== null} roomName={findExternalChannel(preflightChannelId ?? 0)?.name ?? "sala"} onOpenChange={open => { if (!open) setPreflightChannelId(null); }} onJoin={selection => { const channelId = preflightChannelId; setPreflightChannelId(null); if (channelId !== null) void joinVoice(channelId, selection); }} /><DirectMessagesDrawer open={directOpen} profileId={profile.id} threads={directThreads} messages={directMessages} presence={presence} activeThreadId={activeDirectThreadId} onOpenChange={setDirectOpen} onOpenThread={openDirectMessage} onSend={sendDirectMessage} /><section className="cyber-panel flex min-w-0 flex-1 min-h-screen overflow-hidden bg-[#0b0c10]/92 md:min-h-[calc(100vh-1.5rem)]">{mobileSidebarOpen && <button onClick={() => setMobileSidebarOpen(false)} className="fixed inset-0 z-30 bg-black/75 md:hidden" aria-label="Fechar navegação" />}{sidebar}
    <section className="flex min-w-0 flex-1 flex-col"><header className="flex h-[64px] items-center gap-3 border-b border-orange-300/15 bg-black/20 px-4 sm:h-[76px] sm:px-6"><button onClick={() => setMobileSidebarOpen(true)} className="grid size-9 rounded-lg border border-orange-300/20 text-orange-200 md:hidden" aria-label="Abrir canais"><Menu className="size-4" /></button><div className="grid size-10 place-items-center rounded-xl border border-orange-300/25 bg-orange-400/10 text-orange-300"><Hash className="size-5" /></div><div className="min-w-0"><p className="cyber-label">Canal</p><h1 className="truncate font-sans text-sm font-semibold text-orange-50">{selectedChannel?.name}</h1></div>{activeCallChannelId && <button onClick={() => setCallStageOpen(true)} className="ml-auto rounded-xl border border-orange-300/35 bg-orange-400/10 px-3 py-2 text-xs font-semibold text-orange-100">Abrir chamada</button>}<span className={`${activeCallChannelId ? "hidden sm:flex" : "ml-auto flex"} items-center gap-2 rounded-full border border-orange-300/20 bg-orange-400/5 px-3 py-2 text-xs text-orange-200`}><span className="signal-pulse size-1.5 rounded-full bg-emerald-400" />{presence.length} online</span></header>
      <div className="flex min-h-0 flex-1"><section className="flex min-w-0 flex-1 flex-col"><div className="flex-1 overflow-y-auto p-4 sm:p-7"><div className="mx-auto max-w-4xl"><div className="mb-7 border-b border-orange-300/12 pb-7"><div className="grid size-14 place-items-center rounded-2xl border border-orange-300/25 bg-orange-400/10 text-orange-300"><Hash className="size-7" /></div><p className="cyber-label mt-5">Canal da equipe</p><h2 className="mt-1 font-sans text-3xl font-semibold tracking-tight text-orange-50">#{selectedChannel?.name}</h2><p className="mt-2 text-sm text-stone-400">Converse, compartilhe decisões e mantenha todo mundo no mesmo contexto.</p></div><div className="space-y-4">{channelMessages.length ? channelMessages.map(message => <article key={message.id} className="cyber-corner flex gap-3 border border-orange-300/10 bg-black/15 p-3"><Avatar className="size-9"><AvatarFallback className="rounded-xl border border-orange-300/20 bg-orange-400/10 text-xs text-orange-100">{initials(message.authorName)}</AvatarFallback></Avatar><div className="min-w-0"><p className="text-xs font-semibold text-orange-100">{message.authorName}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-stone-300">{normalizeExternalMessage(message.content)}</p></div></article>) : <div className="cyber-corner relative overflow-hidden border border-orange-300/15 bg-black/20 p-6 sm:p-8"><div className="absolute right-5 top-4 text-5xl font-bold text-orange-400/10">V</div><p className="cyber-label">Ainda não há mensagens</p><p className="mt-3 max-w-sm text-sm leading-6 text-stone-400">Comece a conversa e mantenha a equipe alinhada neste canal.</p><div className="mt-6 flex gap-2 text-xs text-stone-400"><span>Canal privado</span><span>•</span><span>Atualizações em tempo real</span></div></div>}</div>{typingNames.length > 0 && <p className="mt-4 text-xs text-orange-300">{typingNames.join(", ")} digitando…</p>}{notice && <p className="mt-5 rounded-xl border-l-2 border-orange-400 bg-orange-400/8 p-3 text-xs text-orange-100">{notice}</p>}</div></div>{selectedChannel && (selectedChannel.type === "text" || activeCallChannelId === selectedChannelId) && <form onSubmit={sendMessage} className="mx-auto flex w-full max-w-4xl gap-2 px-4 pb-4 sm:px-7 sm:pb-6"><div className="min-w-0 flex-1">{threadParent && <p className="mb-1 truncate text-xs text-orange-300">Respondendo a {threadParent.authorName} · <button type="button" onClick={() => setThreadParent(null)} className="underline">cancelar</button></p>}<Textarea value={draft} onChange={event => { setDraft(event.target.value); socketRef.current.emit("typing", { channelId: selectedChannelId, active: Boolean(event.target.value.trim()) }); }} placeholder={`Mensagem para #${selectedChannel.name}`} className="min-h-12 resize-none rounded-xl border-orange-300/20 bg-black/40 text-orange-50 placeholder:text-stone-600 focus-visible:ring-orange-400" rows={1} /></div><Button size="icon" className="size-12 rounded-xl bg-orange-500 text-black hover:bg-orange-400"><SendHorizontal className="size-4" /></Button></form>}</section><aside className="hidden w-60 border-l border-orange-300/15 bg-black/15 p-5 xl:block"><p className="cyber-label">Online — {presence.length}</p><div className="mt-5 space-y-2">{presence.map(member => <div key={member.userId} className="flex items-center gap-2 py-1.5"><Avatar className="size-7"><AvatarFallback className="rounded-lg bg-orange-400/10 text-[10px] text-orange-100">{initials(member.name)}</AvatarFallback></Avatar><span className="truncate text-xs font-semibold text-stone-300">{member.name}</span><span className="ml-auto size-1.5 rounded-full bg-emerald-400" /></div>)}</div></aside></div></section>
  </section><CommandTelemetryRail channelName={selectedChannel?.name ?? "geral"} onlineCount={presence.length} voiceCount={activeRoomMembers.length} messageCount={channelMessages.length} activeCall={Boolean(activeCallChannelId)} operators={presence} /><CollaborationDrawer messages={messages[selectedChannelId] ?? []} pinnedIds={pinnedIds[selectedChannelId] ?? []} presence={presence} profileId={profile.id} profileName={profile.name} status={status} statusMessage={statusMessage} searchQuery={searchQuery} searchResults={searchResults} activeCall={Boolean(activeCallChannelId)} pushToTalkEnabled={pushToTalkEnabled} pushToTalkKey={pushToTalkKey} isTransmitting={isTransmitting} canManage={currentRole === "admin"} readOnly={channelPermissions[selectedChannelId]?.readOnly ?? false} invitePolicy={channelPermissions[selectedChannelId]?.invitePolicy ?? "member"} onStatusChange={updateStatus} onSearch={searchMessages} onReact={reactToMessage} onPin={togglePin} onReply={message => { setThreadParent(message); setNotice(`Respondendo em thread a ${message.authorName}.`); }} onInvite={inviteToCall} onTogglePushToTalk={() => setPushToTalkEnabled(current => !current)} onPushToTalkKeyChange={setPushToTalkKey} onToggleReadOnly={toggleReadOnly} onSetRole={setMemberRole} onToggleInvitePolicy={toggleInvitePolicy} />{activeCallChannelId && !callStageOpen && <div className="fixed bottom-4 right-4 z-20 w-[min(92vw,360px)]"><button onClick={() => setCallStageOpen(true)} className="cyber-panel cyber-corner w-full p-3 text-left"><span className="cyber-label flex items-center gap-2"><MonitorUp className="size-4" />Abrir palco</span><span className="mt-1 block text-[11px] text-stone-400">Equipe e conversa permanecem disponíveis</span>{stageParticipants[0] && <div className="mt-3 h-28 overflow-hidden border border-orange-300/20"><MediaTile {...stageParticipants[0]} className="h-full min-h-0 rounded-none" /></div>}</button></div>}{activeCallChannelId && callStageOpen && <CallStage roomName={findExternalChannel(activeCallChannelId)?.name ?? "Chamada"} participants={stageParticipants} microphoneOn={microphoneOn} cameraOn={cameraOn} sharingScreen={Boolean(screenStream)} handRaised={handRaised} diagnostics={peerAudioDiagnostics} onToggleMic={toggleMic} onToggleCamera={toggleCamera} onShareScreen={shareScreen} onToggleHandRaise={toggleHandRaise} onLeave={leaveVoice} onMinimize={() => setCallStageOpen(false)} />}</main>;
}
