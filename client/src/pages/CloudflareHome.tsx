import { CallStage } from "@/components/CallStage";
import { CollaborationDrawer } from "@/components/CollaborationDrawer";
import { CallPreflightDialog } from "@/components/CallPreflightDialog";
import { CommandNavigation } from "@/components/CommandNavigation";
import {
  DirectMessagesDrawer,
  type DirectMessage,
  type DirectThread,
} from "@/components/DirectMessagesDrawer";
import { VybeCommandPalette } from "@/components/VybeCommandPalette";
import { NotificationControl } from "@/components/NotificationControl";
import {
  DecisionsDrawer,
  type TeamDecision,
} from "@/components/DecisionsDrawer";
import { MediaTile } from "@/components/MediaTile";
import { MusicRoomPanel } from "@/components/MusicRoomPanel";
import { VoiceContextDock } from "@/components/VoiceContextDock";
import { WorkspaceUtilities } from "@/components/WorkspaceUtilities";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getSelectedAudioTrack,
  listAudioInputs,
  type AudioInput,
} from "@/lib/audio-input";
import {
  getCallMedia,
  getCallMediaErrorMessage,
  getCameraTrack,
  type CallDeviceSelection,
} from "@/lib/call-media";
import { normalizeExternalMessage } from "@/lib/cloudflare-safe-message";
import {
  EXTERNAL_WORKSPACE,
  findExternalChannel,
  setExternalWorkspace,
  type ExternalCategory,
} from "@/lib/external-workspace";
import {
  drainIceCandidates,
  queueIceCandidate,
  type PendingIceCandidates,
} from "@/lib/ice-candidates";
import { CallAudioSink } from "@/components/CallAudioSink";
import { ChannelManager } from "@/components/ChannelManager";
import {
  dayLabel,
  formatMessageTime,
  needsDaySeparator,
} from "@/lib/message-time";
import { createSpeakingDetector } from "@/lib/speaking-detector";
import { createNoiseGate, sensitivityToThreshold } from "@/lib/noise-gate";
import { getIceServers } from "@/lib/ice-config";
import { attachLocalMedia } from "@/lib/peer-media";
import {
  applyScreenEncoding,
  getScreenConstraints,
  pickPreviewParticipant,
  SCREEN_ENCODING,
  type ScreenQuality,
} from "@/lib/screen-share";
import {
  DISCONNECTED_GRACE_MS,
  isPolitePeer,
  shouldIgnoreOffer,
  shouldRestartIce,
  shouldScheduleRestart,
  type NegotiationState,
} from "@/lib/peer-negotiation";
import { createLocalProfile, type LocalProfile } from "@/lib/local-profile";
import { TeamLogin } from "@/components/TeamLogin";
import { toProfileId, type TeamMember } from "@/lib/team-roster";
import {
  bumpUnread,
  clearUnread,
  mentionAliases,
  mentionsSomeone,
  totalUnread,
  type UnreadMap,
} from "@/lib/unread";
import {
  readPeerAudioSnapshot,
  summarizePeerAudioStats,
  type PeerAudioDiagnostics,
  type PeerAudioSnapshot,
} from "@/lib/peer-audio-diagnostics";
import { getRealtimeSocket } from "@/lib/realtime";
import {
  type SharedMusicState,
  type YouTubeMusicSourceInput,
} from "@/lib/youtube-music";
import {
  getCallEnginePreference,
  requestRealtimeKitSession,
  shouldFallbackToLegacy,
  type CallEngine,
} from "@/lib/realtimekit-session";
import { useVybeNotifications } from "@/lib/use-vybe-notifications";
import { useRealtimeKitCall } from "@/hooks/useRealtimeKitCall";
import type { VoiceRoom } from "@/lib/voice-room-state";
import {
  Bell,
  Hash,
  Pencil,
  Trash2,
  LogOut,
  Menu,
  Mic,
  MicOff,
  MonitorUp,
  Phone,
  Pin,
  Search,
  SendHorizontal,
  SmilePlus,
  UserPlus,
  Video,
  VideoOff,
  Volume2,
  X,
} from "lucide-react";
import {
  Fragment,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Profile = LocalProfile & { photo?: string };
type Presence = {
  userId: string;
  name: string;
  photo?: string;
  status: "online" | "away" | "offline" | "focus" | "meeting";
  statusMessage?: string;
  role?: "admin" | "moderator" | "member";
};
type ExternalMessage = {
  id: string;
  channelId: number;
  userId: string;
  authorName: string;
  content: string;
  createdAt: string;
  editedAt?: string;
  parentId?: string | null;
  reactions?: Record<string, string[]>;
};
type RemoteStream = { socketId: string; stream: MediaStream };
type CallPeer = { socketId: string; name: string };

const PROFILE_KEY = "vybechat-cloudflare-profile";
const WORKSPACE_CODE_KEY = "vybechat-workspace-code";
const GATE_KEY = "vybechat-gate-sensitivity";
const GATE_SCALE_KEY = "vybechat-gate-scale";
const SCREEN_QUALITY_KEY = "vybechat-screen-quality";
const AUDIO_CONFIG_KEY = "vybechat-audio-config";
const CALL_NOTICE_PATTERN =
  /microfone|chamada|compartilh|m[ií]dia|[aá]udio|conex[aã]o|sfu/i;

const PREVIEW_MUSIC_STATE: SharedMusicState = {
  channelId: 5,
  queue: [
    {
      id: "preview-lofi",
      kind: "video",
      videoId: "M7lc1UVf-VE",
      url: "https://www.youtube.com/watch?v=M7lc1UVf-VE",
      addedBy: { userId: "preview-vybe", name: "Vybe Preview" },
      addedAt: "2026-08-21T00:00:00.000Z",
    },
  ],
  queueIndex: 0,
  playlistIndex: 0,
  playing: true,
  positionSeconds: 0,
  updatedAt: Date.now(),
  revision: 1,
  djUserId: "preview-vybe",
  djName: "Vybe Preview",
  updatedBy: { userId: "preview-vybe", name: "Vybe Preview" },
};

function openWorkspaceSurface(
  surface: "commands" | "collaboration" | "decisions"
) {
  window.dispatchEvent(new Event(`vybe:open-${surface}`));
}

function initials(name: string) {
  return (
    name
      .split(" ")
      .map(part => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "V"
  );
}

const AVATAR_COLORS = [
  "bg-rose-500/10 text-rose-300", 
  "bg-pink-500/10 text-pink-300", 
  "bg-fuchsia-500/10 text-fuchsia-300", 
  "bg-purple-500/10 text-purple-300", 
  "bg-violet-500/10 text-violet-300",
  "bg-indigo-500/10 text-indigo-300", 
  "bg-blue-500/10 text-blue-300", 
  "bg-sky-500/10 text-sky-300", 
  "bg-cyan-500/10 text-cyan-300", 
  "bg-teal-500/10 text-teal-300",
  "bg-emerald-500/10 text-emerald-300", 
  "bg-green-500/10 text-green-300", 
  "bg-lime-500/10 text-lime-300", 
  "bg-orange-500/10 text-orange-300", 
  "bg-amber-500/10 text-amber-300"
];

function avatarColorClass(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function directThreadId(firstUserId: string, secondUserId: string) {
  return `direct:${[firstUserId, secondUserId].sort().join("|")}`;
}

function loadWorkspaceCode() {
  try {
    return localStorage.getItem(WORKSPACE_CODE_KEY) ?? "";
  } catch {
    return "";
  }
}

function loadProfile(): Profile | null {
  try {
    if (
      window.location.pathname === "/cloudflare-preview" &&
      new URLSearchParams(window.location.search).get("demo") === "1"
    ) {
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
  const {
    preferences: notificationPreferences,
    requestPermission,
    toggleQuiet,
    notify,
  } = useVybeNotifications();
  const [workspaceCode, setWorkspaceCode] = useState(() => loadWorkspaceCode());
  const [authError, setAuthError] = useState("");
  const [selectedChannelId, setSelectedChannelId] = useState(1);
  const [messages, setMessages] = useState<Record<number, ExternalMessage[]>>(
    {}
  );
  const [draft, setDraft] = useState("");
  const [presence, setPresence] = useState<Presence[]>([]);
  const [voiceRooms, setVoiceRooms] = useState<
    Record<number, VoiceRoom["members"]>
  >({});
  const [activeCallChannelId, setActiveCallChannelId] = useState<number | null>(
    null
  );
  const [callEngine, setCallEngine] = useState<CallEngine | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);
  const [callPeers, setCallPeers] = useState<Record<string, CallPeer>>({});
  const [remoteVolumes, setRemoteVolumes] = useState<Record<string, number>>(
    {}
  );
  // O navegador pode recusar o autoplay do audio. Antes o erro era engolido e a
  // pessoa simplesmente nao ouvia ninguem, sem nenhuma pista do motivo.
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [workspace, setWorkspace] =
    useState<ExternalCategory[]>(EXTERNAL_WORKSPACE);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [screenQuality, setScreenQuality] = useState<ScreenQuality>(() => {
    try {
      return localStorage.getItem(SCREEN_QUALITY_KEY) === "fluida"
        ? "fluida"
        : "nitida";
    } catch {
      return "nitida";
    }
  });
  const [unread, setUnread] = useState<UnreadMap>({});
  const [microphoneOn, setMicrophoneOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [audioConfig, setAudioConfig] = useState(() => {
    try {
      const val = localStorage.getItem(AUDIO_CONFIG_KEY);
      if (val) return JSON.parse(val);
    } catch {}
    return { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
  });
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [screenSharer, setScreenSharer] = useState<string | null>(null);
  const [screenSharerId, setScreenSharerId] = useState<string | null>(null);
  const screenSharerIdRef = useRef<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [callStageOpen, setCallStageOpen] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [musicState, setMusicState] = useState<SharedMusicState | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<Record<number, string[]>>({});
  const [threadParent, setThreadParent] = useState<ExternalMessage | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ExternalMessage[]>([]);
  const [status, setStatus] = useState<Presence["status"]>("online");
  const [statusMessage, setStatusMessage] = useState("");
  const [pushToTalkEnabled, setPushToTalkEnabled] = useState(false);
  // Sensibilidade do portao de ruido, de 0 (desligado) a 100. O padrao ja corta
  // fundo constante sem atrapalhar a fala.
  // Desligado por padrao. O portao corta som de fundo, mas tambem pode comer o
  // inicio das palavras — e ser ouvido importa mais do que cortar ruido. Quem
  // tem ambiente barulhento liga na barra. O navegador ja faz supressao de ruido
  // e isolamento de voz por conta propria.
  const [gateSensitivity, setGateSensitivity] = useState(() => {
    try {
      // A escala mudou de linear para decibeis: um "45" guardado antes virava um
      // corte agressivo demais e cortava fala normal. Zera uma vez.
      if (localStorage.getItem(GATE_SCALE_KEY) !== "db") {
        localStorage.setItem(GATE_SCALE_KEY, "db");
        localStorage.setItem(GATE_KEY, "0");
        return 0;
      }
      return Number(localStorage.getItem(GATE_KEY) ?? 0);
    } catch {
      return 0;
    }
  });
  const [pushToTalkKey, setPushToTalkKey] = useState<"Space" | "KeyV">("Space");
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [typingNames, setTypingNames] = useState<string[]>([]);
  const [channelPermissions, setChannelPermissions] = useState<
    Record<number, { readOnly: boolean; invitePolicy: "admin" | "member" }>
  >({});
  const [peerAudioDiagnostics, setPeerAudioDiagnostics] = useState<
    Record<string, PeerAudioDiagnostics>
  >({});
  const [audioInputs, setAudioInputs] = useState<AudioInput[]>([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState("");
  const [selectedVideoInput, setSelectedVideoInput] = useState("");
  const [preflightChannelId, setPreflightChannelId] = useState<number | null>(
    null
  );
  const [directOpen, setDirectOpen] = useState(false);
  const [directThreads, setDirectThreads] = useState<DirectThread[]>([]);
  const [directMessages, setDirectMessages] = useState<
    Record<string, DirectMessage[]>
  >({});
  const [activeDirectThreadId, setActiveDirectThreadId] = useState<
    string | null
  >(null);
  const [handRaised, setHandRaised] = useState(false);
  const [decisions, setDecisions] = useState<TeamDecision[]>([]);
  const realtimeKit = useRealtimeKitCall();
  const socketRef = useRef(getRealtimeSocket());
  const localStreamRef = useRef<MediaStream | null>(null);
  const activeCallRef = useRef<number | null>(null);
  const callEngineRef = useRef<CallEngine | null>(null);
  const realtimeKitRef = useRef(realtimeKit);
  const callEnginePreferenceRef = useRef(
    getCallEnginePreference(import.meta.env.VITE_CALL_ENGINE)
  );
  const peerConnectionsRef = useRef(new Map<string, RTCPeerConnection>());
  const pendingIceCandidatesRef = useRef<PendingIceCandidates>(new Map());
  // O worker informa nosso socketId no presence:join. Ele decide quem cede numa
  // colisao de ofertas, sem precisar de mensagem extra entre os pares.
  const localSocketIdRef = useRef("");
  const negotiationRef = useRef(new Map<string, NegotiationState>());
  const restartTimersRef = useRef(new Map<string, number>());
  const peerAudioSnapshotsRef = useRef(new Map<string, PeerAudioSnapshot>());
  // Sender de video de cada par, guardado na criacao. Procura-lo por
  // `sender.track?.kind` falhava sempre que nao havia track — sem camera, ou
  // depois de parar um compartilhamento — e caiamos numa renegociacao no meio
  // da chamada, que era o que derrubava a voz.
  const videoSendersRef = useRef(new Map<string, RTCRtpSender>());
  // Linha separada para o som da tela, para nao disputar com o microfone.
  const screenAudioSendersRef = useRef(new Map<string, RTCRtpSender>());
  const iceServersRef = useRef<RTCIceServer[]>(getIceServers());
  // Lido dentro do efeito de sockets sem entrar nas dependencias: antes trocar de
  // canal de texto durante a chamada re-registrava todos os handlers.
  const selectedChannelIdRef = useRef(selectedChannelId);
  const microphoneOnRef = useRef(true);
  const gateSensitivityRef = useRef(gateSensitivity);
  const pushToTalkRef = useRef(false);

  useEffect(() => {
    selectedChannelIdRef.current = selectedChannelId;
  }, [selectedChannelId]);
  useEffect(() => {
    microphoneOnRef.current = microphoneOn;
  }, [microphoneOn]);
  useEffect(() => {
    screenSharerIdRef.current = screenSharerId;
  }, [screenSharerId]);
  useEffect(() => {
    callEngineRef.current = callEngine;
  }, [callEngine]);
  useEffect(() => {
    realtimeKitRef.current = realtimeKit;
  }, [realtimeKit]);

  useEffect(() => {
    // Contador no titulo da aba: com o VybeChat em segundo plano, e o unico
    // lugar onde a pessoa percebe que chegou mensagem.
    const total = totalUnread(unread);
    document.title =
      total > 0 ? `(${total}) VybeChat` : "VybeChat — Central de comunicação";
  }, [unread]);
  useEffect(() => {
    pushToTalkRef.current = pushToTalkEnabled;
  }, [pushToTalkEnabled]);
  useEffect(() => {
    try {
      localStorage.setItem(SCREEN_QUALITY_KEY, screenQuality);
    } catch {
      /* storage indisponivel */
    }
  }, [screenQuality]);
  useEffect(() => {
    gateSensitivityRef.current = gateSensitivity;
    try {
      localStorage.setItem(GATE_KEY, String(gateSensitivity));
    } catch {
      /* storage indisponivel */
    }
  }, [gateSensitivity]);

  useEffect(() => {
    if (!localStream || !activeCallChannelId) return;
    const stop = createNoiseGate({
      stream: localStream,
      getThreshold: () => sensitivityToThreshold(gateSensitivityRef.current),
      // Nao mexe no microfone quando ja esta mudo ou sob push-to-talk: senao o
      // portao reabriria um microfone que a pessoa fechou de proposito.
      isEnabled: () => microphoneOnRef.current && !pushToTalkRef.current,
      onLevel: setMicLevel,
    });
    return () => {
      stop?.();
    };
  }, [activeCallChannelId, localStream]);

  const selectedChannel = useMemo(
    () => findExternalChannel(selectedChannelId),
    [selectedChannelId]
  );
  const isContextPreview =
    window.location.pathname === "/cloudflare-preview" &&
    new URLSearchParams(window.location.search).get("demo") === "1" &&
    new URLSearchParams(window.location.search).get("call") === "1";
  const activeRoomMembers = activeCallChannelId
    ? isContextPreview
      ? [
          {
            socketId: "preview-vybe",
            userId: "preview-vybe",
            name: "Vybe Preview",
            status: "online" as const,
            isMuted: false,
            isSpeaking: false,
          },
          {
            socketId: "preview-paulo",
            userId: "preview-paulo",
            name: "Paulo",
            status: "online" as const,
            isMuted: false,
            isSpeaking: true,
          },
        ]
      : (voiceRooms[activeCallChannelId] ?? [])
    : [];
  const callMicrophoneOn =
    callEngine === "realtimekit" ? realtimeKit.microphoneOn : microphoneOn;
  const callCameraOn =
    callEngine === "realtimekit" ? realtimeKit.cameraOn : cameraOn;
  const callScreenSharing =
    callEngine === "realtimekit"
      ? realtimeKit.sharingScreen
      : Boolean(screenStream);
  const callRemoteStreams =
    callEngine === "realtimekit" ? realtimeKit.remoteStreams : remoteStreams;
  const callDiagnostics =
    callEngine === "realtimekit"
      ? realtimeKit.diagnostics
      : peerAudioDiagnostics;
  const callAudioBlocked =
    audioBlocked || (callEngine === "realtimekit" && realtimeKit.audioBlocked);
  const channelMessages = messages[selectedChannelId] ?? [];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (
      window.location.pathname === "/cloudflare-preview" &&
      params.get("demo") === "1" &&
      params.get("call") === "1"
    ) {
      setActiveCallChannelId(5);
      setVoiceRooms({
        5: [
          {
            socketId: "preview-vybe",
            userId: "preview-vybe",
            name: "Vybe Preview",
            status: "online",
            isMuted: false,
            isSpeaking: false,
          },
          {
            socketId: "preview-paulo",
            userId: "preview-paulo",
            name: "Paulo",
            status: "online",
            isMuted: false,
            isSpeaking: true,
          },
        ],
      });
    }
  }, []);

  const flushPendingIceCandidates = async (
    peerId: string,
    connection: RTCPeerConnection
  ) => {
    if (!connection.remoteDescription) return;
    for (const candidate of drainIceCandidates(
      pendingIceCandidatesRef.current,
      peerId
    )) {
      try {
        await connection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.warn("[VybeChat] candidate ICE pendente recusado", {
          peerId,
          error,
        });
      }
    }
  };

  const clearRestartTimer = (peerId: string) => {
    const timer = restartTimersRef.current.get(peerId);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      restartTimersRef.current.delete(peerId);
    }
  };

  const restartIce = async (peerId: string, connection: RTCPeerConnection) => {
    if (!activeCallRef.current) return;
    const negotiation = negotiationRef.current.get(peerId);
    if (
      !negotiation ||
      negotiation.makingOffer ||
      connection.signalingState !== "stable"
    )
      return;
    try {
      negotiation.makingOffer = true;
      const offer = await connection.createOffer({ iceRestart: true });
      if (connection.signalingState !== "stable") return;
      await connection.setLocalDescription(offer);
      socketRef.current.emit("call:offer", {
        to: peerId,
        channelId: activeCallRef.current,
        offer,
      });
    } catch (error) {
      console.warn("[VybeChat] reinicio de ICE falhou", { peerId, error });
      setNotice(
        "A conexão com um participante caiu. Tente sair e entrar novamente na sala."
      );
    } finally {
      negotiation.makingOffer = false;
    }
  };

  /**
   * Renegocia com um participante respeitando o controle de colisao de ofertas.
   * Necessario ao comecar a compartilhar: a linha de video e criada junto com a
   * conexao, mas nasce sem track, e a resposta do outro lado a fixa como "so
   * recebo" — entao a tela saia de quem compartilha e nao tinha por onde entrar.
   */
  const renegociar = async (peerId: string, connection: RTCPeerConnection) => {
    if (!activeCallRef.current) return;
    const negotiation = negotiationRef.current.get(peerId);
    if (
      !negotiation ||
      negotiation.makingOffer ||
      connection.signalingState !== "stable"
    )
      return;
    try {
      negotiation.makingOffer = true;
      const offer = await connection.createOffer();
      if (connection.signalingState !== "stable") return;
      await connection.setLocalDescription(offer);
      socketRef.current.emit("call:offer", {
        to: peerId,
        channelId: activeCallRef.current,
        offer,
      });
    } catch (error) {
      console.warn("[VybeChat] renegociacao falhou", { peerId, error });
    } finally {
      negotiation.makingOffer = false;
    }
  };

  const createPeer = async (peerId: string, shouldOffer = false) => {
    const existing = peerConnectionsRef.current.get(peerId);
    if (existing) return existing;
    const connection = new RTCPeerConnection({
      iceServers: iceServersRef.current,
    });
    peerConnectionsRef.current.set(peerId, connection);
    negotiationRef.current.set(peerId, {
      makingOffer: false,
      ignoreOffer: false,
    });
    const senders = attachLocalMedia(connection, localStreamRef.current);
    if (senders.video)
      videoSendersRef.current.set(peerId, senders.video as RTCRtpSender);
    if (senders.screenAudio)
      screenAudioSendersRef.current.set(
        peerId,
        senders.screenAudio as RTCRtpSender
      );
    connection.onicecandidate = event => {
      if (event.candidate && activeCallRef.current)
        socketRef.current.emit("call:ice", {
          to: peerId,
          channelId: activeCallRef.current,
          candidate: event.candidate,
        });
    };
    connection.ontrack = event => {
      // Um track recem-chegado nasce `muted` e so desmuta quando a midia comeca a
      // fluir. A interface decide se ha video olhando `muted`, e essa mudanca nao
      // gera render nenhum: a tela compartilhada chegava e ficava invisivel para
      // sempre. Um toque no estado a cada mute/unmute resolve.
      const redesenhar = () => setRemoteStreams(current => [...current]);
      event.track.addEventListener("unmute", redesenhar);
      event.track.addEventListener("mute", redesenhar);
      event.track.addEventListener("ended", redesenhar);
      setRemoteStreams(current => {
        const existing = current.find(item => item.socketId === peerId);
        const stream =
          event.streams[0] ?? existing?.stream ?? new MediaStream();
        if (!stream.getTracks().some(track => track.id === event.track.id))
          stream.addTrack(event.track);
        return [
          ...current.filter(item => item.socketId !== peerId),
          { socketId: peerId, stream },
        ];
      });
    };
    connection.onconnectionstatechange = () => {
      const state = connection.connectionState;
      if (state === "connected" || state === "closed") {
        clearRestartTimer(peerId);
        return;
      }
      // `failed` nao volta sozinho: reinicia na hora. `disconnected` costuma se
      // resolver em poucos segundos, entao damos uma janela antes de mexer.
      if (shouldRestartIce(state)) {
        clearRestartTimer(peerId);
        void restartIce(peerId, connection);
        return;
      }
      if (
        shouldScheduleRestart(state) &&
        !restartTimersRef.current.has(peerId)
      ) {
        const timer = window.setTimeout(() => {
          restartTimersRef.current.delete(peerId);
          if (connection.connectionState === "disconnected")
            void restartIce(peerId, connection);
        }, DISCONNECTED_GRACE_MS);
        restartTimersRef.current.set(peerId, timer);
      }
    };
    if (shouldOffer && activeCallRef.current) {
      const negotiation = negotiationRef.current.get(peerId)!;
      try {
        negotiation.makingOffer = true;
        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);
        socketRef.current.emit("call:offer", {
          to: peerId,
          channelId: activeCallRef.current,
          offer,
        });
      } catch (error) {
        console.warn("[VybeChat] oferta inicial falhou", { peerId, error });
      } finally {
        negotiation.makingOffer = false;
      }
    }
    return connection;
  };

  useEffect(() => {
    if (!profile) return;
    const socket = socketRef.current;
    const announce = () => {
      socket.emit("presence:join", {
        userId: profile.id,
        name: profile.name,
        photo: profile.photo ?? "",
        status,
        statusMessage,
        workspaceCode,
      });
      socket.emit("channel:join", { channelId: selectedChannelIdRef.current });
      socket.emit("direct:list", {});
      socket.emit("decision:list", {});
      socket.emit("workspace:list", {});
    };
    socket.on("connect", announce);
    socket.on("presence:update", (users: Presence[]) => setPresence(users));
    socket.on("voice:rooms", (rooms: VoiceRoom[]) =>
      setVoiceRooms(
        Object.fromEntries(rooms.map(room => [room.channelId, room.members]))
      )
    );
    socket.on(
      "music:state",
      ({
        channelId,
        state: nextMusicState,
      }: {
        channelId: number;
        state: SharedMusicState;
      }) => {
        if (channelId === activeCallRef.current) setMusicState(nextMusicState);
      }
    );
    socket.on(
      "message:history",
      ({
        channelId,
        messages: history,
      }: {
        channelId: number;
        messages: ExternalMessage[];
      }) => setMessages(current => ({ ...current, [channelId]: history }))
    );
    socket.on(
      "message:new",
      ({
        channelId,
        message,
      }: {
        channelId: number;
        message: ExternalMessage;
      }) => {
        setUnread(atual =>
          bumpUnread({
            unread: atual,
            channelId,
            activeChannelId: selectedChannelIdRef.current,
            fromSelf: message.userId === profile.id,
            mentioned: mentionsSomeone(
              message.content,
              mentionAliases(profile.name)
            ),
          })
        );
        setMessages(current => ({
          ...current,
          [channelId]: [
            ...(current[channelId] ?? []).filter(
              item => item.id !== message.id
            ),
            message,
          ],
        }));
        // A checagem anterior exigia o nome inteiro no texto: com nomes vindos do
        // Monday isso virava "@paulo martins", e a mencao nunca disparava.
        if (
          message.userId !== profile.id &&
          mentionsSomeone(message.content, mentionAliases(profile.name))
        ) {
          const channelName = findExternalChannel(channelId)?.name ?? "canal";
          setNotice(`${message.authorName} mencionou você em #${channelName}.`);
          notify(
            `Menção em #${channelName}`,
            `${message.authorName}: ${message.content.slice(0, 110)}`
          );
        }
      }
    );
    socket.on(
      "message:update",
      ({
        channelId,
        message,
      }: {
        channelId: number;
        message: ExternalMessage;
      }) =>
        setMessages(current => ({
          ...current,
          [channelId]: (current[channelId] ?? []).map(item =>
            item.id === message.id ? message : item
          ),
        }))
    );
    socket.on(
      "message:pins",
      ({
        channelId,
        pinnedIds: pins,
      }: {
        channelId: number;
        pinnedIds: string[];
      }) => setPinnedIds(current => ({ ...current, [channelId]: pins }))
    );
    socket.on(
      "message:search-results",
      ({ results }: { results: ExternalMessage[] }) => setSearchResults(results)
    );
    socket.on(
      "channel:permissions",
      ({
        channelId,
        permissions,
      }: {
        channelId: number;
        permissions: { readOnly: boolean; invitePolicy: "admin" | "member" };
      }) =>
        setChannelPermissions(current => ({
          ...current,
          [channelId]: permissions,
        }))
    );
    socket.on("direct:list", ({ threads }: { threads: DirectThread[] }) =>
      setDirectThreads(threads)
    );
    socket.on(
      "direct:history",
      ({
        threadId,
        messages: history,
      }: {
        threadId: string;
        messages: DirectMessage[];
      }) => setDirectMessages(current => ({ ...current, [threadId]: history }))
    );
    socket.on(
      "direct:new",
      ({
        thread,
        message,
      }: {
        thread: DirectThread;
        message: DirectMessage;
      }) => {
        setDirectThreads(current =>
          [thread, ...current.filter(item => item.id !== thread.id)].sort(
            (first, second) => second.updatedAt.localeCompare(first.updatedAt)
          )
        );
        setDirectMessages(current => ({
          ...current,
          [thread.id]: [
            ...(current[thread.id] ?? []).filter(
              item => item.id !== message.id
            ),
            message,
          ],
        }));
        if (
          message.userId !== profile.id &&
          activeDirectThreadId !== thread.id
        ) {
          setNotice(`${message.authorName} enviou uma mensagem direta.`);
          notify(
            `Mensagem de ${message.authorName}`,
            message.content.slice(0, 110)
          );
        }
      }
    );
    socket.on("direct:read", ({ thread }: { thread: DirectThread }) =>
      setDirectThreads(current =>
        current.map(item => (item.id === thread.id ? thread : item))
      )
    );
    socket.on(
      "decision:list",
      ({ decisions: nextDecisions }: { decisions: TeamDecision[] }) =>
        setDecisions(nextDecisions)
    );
    socket.on(
      "typing",
      ({
        channelId,
        name: typingName,
        active,
      }: {
        channelId: number;
        name: string;
        active: boolean;
      }) => {
        if (
          channelId !== selectedChannelIdRef.current ||
          typingName === profile.name
        )
          return;
        setTypingNames(current =>
          active
            ? Array.from(new Set([...current, typingName]))
            : current.filter(item => item !== typingName)
        );
      }
    );
    socket.on("session:ready", ({ socketId }: { socketId: string }) => {
      localSocketIdRef.current = socketId;
      // O WebSocket pode cair sem a mídia cair. O Worker remove a associação da
      // sala junto com o socket antigo; ao autenticar o novo socket, reentramos
      // na presença da chamada. No motor legado isso também recria os pares.
      if (activeCallRef.current && callEngineRef.current) {
        socket.emit("call:join", {
          channelId: activeCallRef.current,
          mediaEngine: callEngineRef.current,
        });
      }
    });
    socket.on(
      "message:removed",
      ({
        channelId,
        messageIds,
      }: {
        channelId: number;
        messageIds: string[];
      }) => {
        const removidos = new Set(messageIds);
        setMessages(current => ({
          ...current,
          [channelId]: (current[channelId] ?? []).filter(
            item => !removidos.has(item.id)
          ),
        }));
        setThreadParent(atual =>
          atual && removidos.has(atual.id) ? null : atual
        );
      }
    );
    socket.on(
      "call:force-mute",
      ({ channelId, by }: { channelId: number; by: string }) => {
        if (channelId !== activeCallRef.current) return;
        if (callEngineRef.current === "realtimekit") {
          void realtimeKitRef.current
            .setMicrophoneEnabled(false)
            .catch(() => undefined);
          setNotice(
            `${by} silenciou seu microfone. Ligue de novo quando quiser falar.`
          );
          return;
        }
        localStreamRef.current?.getAudioTracks().forEach(track => {
          track.enabled = false;
        });
        setMicrophoneOn(false);
        setNotice(
          `${by} silenciou seu microfone. Ligue de novo quando quiser falar.`
        );
      }
    );
    socket.on(
      "workspace:list",
      ({ workspace: recebido }: { workspace: ExternalCategory[] }) => {
        setExternalWorkspace(recebido);
        setWorkspace(recebido);
      }
    );
    socket.on(
      "call:invite",
      ({ channelId, from }: { channelId: number; from: { name: string } }) =>
        setNotice(
          `${from.name} convidou você para ${findExternalChannel(channelId)?.name ?? "uma sala"}.`
        )
    );
    socket.on(
      "call:peers",
      async ({
        channelId,
        peers,
      }: {
        channelId: number;
        peers: CallPeer[];
      }) => {
        if (
          channelId !== activeCallRef.current ||
          callEngineRef.current !== "legacy"
        )
          return;
        setCallPeers(
          Object.fromEntries(peers.map(peer => [peer.socketId, peer]))
        );
        for (const peer of peers) await createPeer(peer.socketId, true);
      }
    );
    socket.on(
      "call:peer-joined",
      ({ channelId, peer }: { channelId: number; peer: CallPeer }) => {
        if (
          channelId === activeCallRef.current &&
          callEngineRef.current === "legacy"
        )
          setCallPeers(current => ({ ...current, [peer.socketId]: peer }));
      }
    );
    socket.on(
      "call:offer",
      async ({
        from,
        channelId,
        offer,
        user,
      }: {
        from: string;
        channelId: number;
        offer: RTCSessionDescriptionInit;
        user?: Presence;
      }) => {
        if (
          channelId !== activeCallRef.current ||
          callEngineRef.current !== "legacy"
        )
          return;
        if (user)
          setCallPeers(current => ({
            ...current,
            [from]: { socketId: from, name: user.name },
          }));
        const peer = await createPeer(from);
        const negotiation = negotiationRef.current.get(from) ?? {
          makingOffer: false,
          ignoreOffer: false,
        };
        const polite = isPolitePeer(localSocketIdRef.current, from);
        // Colisao: os dois lados ofertaram ao mesmo tempo (tipico no reinicio de
        // ICE). O lado educado desfaz a propria oferta e aceita a do outro; o
        // impaciente descarta a que chegou. Sem isso um dos pares ficava mudo.
        negotiation.ignoreOffer = shouldIgnoreOffer({
          polite,
          makingOffer: negotiation.makingOffer,
          signalingState: peer.signalingState,
        });
        negotiationRef.current.set(from, negotiation);
        if (negotiation.ignoreOffer) return;
        try {
          if (polite && peer.signalingState !== "stable") {
            await Promise.all([
              peer.setLocalDescription({
                type: "rollback",
              } as RTCLocalSessionDescriptionInit),
              peer.setRemoteDescription(new RTCSessionDescription(offer)),
            ]);
          } else {
            await peer.setRemoteDescription(new RTCSessionDescription(offer));
          }
          await flushPendingIceCandidates(from, peer);
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          socket.emit("call:answer", { to: from, channelId, answer });
        } catch (error) {
          console.warn("[VybeChat] oferta recusada", { peerId: from, error });
        }
      }
    );
    socket.on(
      "call:answer",
      async ({
        from,
        channelId,
        answer,
      }: {
        from: string;
        channelId: number;
        answer: RTCSessionDescriptionInit;
      }) => {
        if (
          channelId !== activeCallRef.current ||
          callEngineRef.current !== "legacy"
        )
          return;
        const peer = peerConnectionsRef.current.get(from);
        if (!peer) return;
        try {
          // Uma resposta que chega depois de a conexao voltar a "stable" ja nao
          // pertence a negociacao atual; aplicar mata a conexao com excecao.
          if (peer.signalingState !== "have-local-offer") return;
          await peer.setRemoteDescription(new RTCSessionDescription(answer));
          await flushPendingIceCandidates(from, peer);
        } catch (error) {
          console.warn("[VybeChat] resposta recusada", { peerId: from, error });
        }
      }
    );
    socket.on(
      "call:ice",
      async ({
        from,
        channelId,
        candidate,
      }: {
        from: string;
        channelId: number;
        candidate: RTCIceCandidateInit;
      }) => {
        if (
          channelId !== activeCallRef.current ||
          callEngineRef.current !== "legacy"
        )
          return;
        const peer = await createPeer(from);
        if (!peer.remoteDescription) {
          queueIceCandidate(pendingIceCandidatesRef.current, from, candidate);
          return;
        }
        try {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.warn("[VybeChat] candidate ICE recusado", {
            peerId: from,
            error,
          });
        }
      }
    );
    socket.on("call:peer-left", ({ socketId }: { socketId: string }) => {
      if (callEngineRef.current !== "legacy") return;
      peerConnectionsRef.current.get(socketId)?.close();
      peerConnectionsRef.current.delete(socketId);
      pendingIceCandidatesRef.current.delete(socketId);
      peerAudioSnapshotsRef.current.delete(socketId);
      negotiationRef.current.delete(socketId);
      videoSendersRef.current.delete(socketId);
      screenAudioSendersRef.current.delete(socketId);
      clearRestartTimer(socketId);
      // Se quem saiu era quem compartilhava, o Worker nao avisa que a
      // transmissao acabou: o aviso "Tela ao vivo" ficava aceso para sempre e o
      // palco seguia tentando focar alguem que nao esta mais na sala.
      if (screenSharerIdRef.current === socketId) {
        setScreenSharerId(null);
        setScreenSharer(null);
      }
      setRemoteStreams(current =>
        current.filter(item => item.socketId !== socketId)
      );
      setCallPeers(current => {
        const next = { ...current };
        delete next[socketId];
        return next;
      });
    });
    // Antes isto guardava o nome de quem compartilha e a interface comparava
    // nomes. Dois "Ewerton" na sala, ou a propria pessoa com o mesmo nome de
    // outra, e a tela era atribuida a quem nao era. O socketId e unico.
    socket.on(
      "call:screen-share",
      ({
        channelId,
        socketId,
        name,
      }: {
        channelId: number;
        socketId: string | null;
        name: string | null;
      }) => {
        if (
          channelId === activeCallRef.current &&
          callEngineRef.current === "legacy"
        ) {
          setScreenSharerId(socketId);
          setScreenSharer(name);
        }
      }
    );
    socket.on("disconnect", () => {
      if (!activeCallRef.current) return;
      setNotice(
        callEngineRef.current === "realtimekit"
          ? "Reconectando presença da equipe; a mídia continua pelo SFU…"
          : "Reconectando a chamada…"
      );
      if (callEngineRef.current !== "legacy") return;
      peerConnectionsRef.current.forEach(peer => peer.close());
      peerConnectionsRef.current.clear();
      pendingIceCandidatesRef.current.clear();
      peerAudioSnapshotsRef.current.clear();
      negotiationRef.current.clear();
      videoSendersRef.current.clear();
      screenAudioSendersRef.current.clear();
      setRemoteStreams([]);
      setCallPeers({});
    });
    socket.on(
      "realtime:error",
      ({ message, code }: { message: string; code?: string }) => {
        // O worker recusou o acesso: devolve a pessoa para a tela de entrada em vez
        // de deixar ela presa num shell vazio achando que o app quebrou.
        if (code === "auth") {
          if (isContextPreview) return;
          // O cliente dispara channel:join, direct:list e decision:list logo apos o
          // presence:join. Quando o acesso e recusado, os quatro voltam com erro e o
          // generico sobrescrevia justamente a mensagem que explica o motivo. Vale a
          // primeira; submitProfile limpa antes de cada nova tentativa.
          setAuthError(previous => previous || message);
          try {
            localStorage.removeItem(PROFILE_KEY);
          } catch {
            /* storage indisponivel */
          }
          setProfile(null);
          return;
        }
        setNotice(message);
      }
    );
    socket.connect();
    if (socket.connected) announce();
    return () => {
      [
        "connect",
        "disconnect",
        "session:ready",
        "presence:update",
        "voice:rooms",
        "music:state",
        "message:history",
        "message:new",
        "message:update",
        "message:removed",
        "message:pins",
        "message:search-results",
        "channel:permissions",
        "direct:list",
        "direct:history",
        "direct:new",
        "direct:read",
        "decision:list",
        "workspace:list",
        "typing",
        "call:invite",
        "call:force-mute",
        "call:peers",
        "call:peer-joined",
        "call:offer",
        "call:answer",
        "call:ice",
        "call:peer-left",
        "call:screen-share",
        "realtime:error",
      ].forEach(event => socket.off(event));
    };
  }, [
    activeDirectThreadId,
    isContextPreview,
    notify,
    profile,
    status,
    statusMessage,
  ]);

  useEffect(() => {
    if (profile && socketRef.current.connected)
      socketRef.current.emit("channel:join", { channelId: selectedChannelId });
  }, [profile, selectedChannelId]);

  useEffect(() => {
    if (!profile || !navigator.mediaDevices?.enumerateDevices) return;
    void listAudioInputs(navigator.mediaDevices)
      .then(setAudioInputs)
      .catch(() => setAudioInputs([]));
  }, [profile]);

  useEffect(() => {
    // Sem isso o indicador "Falando" so acendia com push-to-talk ligado.
    if (!localStream || !activeCallChannelId || pushToTalkEnabled) return;
    const stop = createSpeakingDetector({
      stream: localStream,
      onChange: speaking => {
        if (!activeCallRef.current) return;
        socketRef.current.emit("call:audio-state", {
          channelId: activeCallRef.current,
          isMuted: !microphoneOnRef.current,
          isSpeaking: speaking && microphoneOnRef.current,
        });
      },
    });
    return () => {
      stop?.();
    };
  }, [activeCallChannelId, localStream, pushToTalkEnabled]);

  useEffect(() => {
    if (!pushToTalkEnabled || !activeCallChannelId) return;
    const updateTransmit = (enabled: boolean) => {
      if (callEngineRef.current === "realtimekit") {
        void realtimeKitRef.current
          .setMicrophoneEnabled(enabled)
          .catch(() => undefined);
        setIsTransmitting(enabled);
        socketRef.current.emit("call:audio-state", {
          channelId: activeCallRef.current,
          isMuted: !enabled,
          isSpeaking: enabled,
        });
        return;
      }
      localStreamRef.current?.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
      setMicrophoneOn(enabled);
      setIsTransmitting(enabled);
      socketRef.current.emit("call:audio-state", {
        channelId: activeCallRef.current,
        isMuted: !enabled,
        isSpeaking: enabled,
      });
    };
    const down = (event: KeyboardEvent) => {
      if (
        event.code === pushToTalkKey &&
        !(
          event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLTextAreaElement
        )
      ) {
        event.preventDefault();
        updateTransmit(true);
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === pushToTalkKey) updateTransmit(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    updateTransmit(false);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [activeCallChannelId, pushToTalkEnabled, pushToTalkKey]);

  useEffect(() => {
    if (!activeCallChannelId || callEngine === "realtimekit") {
      setPeerAudioDiagnostics({});
      peerAudioSnapshotsRef.current.clear();
      return;
    }
    let active = true;
    const collect = async () => {
      const entries = await Promise.all(
        Array.from(peerConnectionsRef.current.entries()).map(
          async ([peerId, connection]) => {
            try {
              const report = await connection.getStats();
              const values = Array.from(report.values());
              const diagnostic = summarizePeerAudioStats(
                values,
                connection.connectionState,
                peerAudioSnapshotsRef.current.get(peerId)
              );
              peerAudioSnapshotsRef.current.set(
                peerId,
                readPeerAudioSnapshot(values)
              );
              return [peerId, diagnostic] as const;
            } catch {
              return [
                peerId,
                {
                  sending: false,
                  receiving: false,
                  connection: connection.connectionState,
                  quality:
                    connection.connectionState === "failed" ||
                    connection.connectionState === "disconnected"
                      ? "recovering"
                      : "connecting",
                },
              ] as const;
            }
          }
        )
      );
      if (active) setPeerAudioDiagnostics(Object.fromEntries(entries));
    };
    void collect();
    const timer = window.setInterval(() => void collect(), 1800);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [activeCallChannelId, callEngine, remoteStreams.length]);

  const stageParticipants = useMemo(() => {
    if (isContextPreview) {
      return [
        {
          id: "preview-vybe",
          stream: null,
          label: "Vybe Preview",
          muted: true,
          isLocal: true,
          cameraOn: false,
          microphoneOn: true,
          speaking: false,
          handRaised: false,
          sharingScreen: false,
          accent: false,
          volume: undefined,
          onVolumeChange: undefined,
        },
        {
          id: "preview-paulo",
          stream: null,
          label: "Paulo",
          muted: false,
          isLocal: false,
          cameraOn: true,
          microphoneOn: true,
          speaking: true,
          handRaised: false,
          sharingScreen: false,
          accent: false,
          volume: 100,
          onVolumeChange: undefined,
        },
      ];
    }
    if (callEngine === "realtimekit") {
      return realtimeKit.participants.map(participant => {
        const stableUserId = participant.userId.split(":")[0];
        const member = activeRoomMembers.find(
          candidate => candidate.userId === stableUserId
        );
        return {
          id: participant.id,
          stream: participant.stream,
          label: participant.label,
          muted: participant.isLocal,
          isLocal: participant.isLocal,
          cameraOn: participant.cameraOn,
          microphoneOn: participant.microphoneOn,
          speaking: participant.speaking || Boolean(member?.isSpeaking),
          handRaised: participant.isLocal
            ? handRaised
            : Boolean(member?.handRaised),
          sharingScreen: participant.sharingScreen,
          accent: participant.sharingScreen,
          volume: participant.isLocal
            ? undefined
            : (remoteVolumes[participant.id] ?? 100),
          onVolumeChange: participant.isLocal
            ? undefined
            : (volume: number) =>
                setRemoteVolumes(current => ({
                  ...current,
                  [participant.id]: volume,
                })),
        };
      });
    }
    const local =
      localStream && profile
        ? [
            {
              id: "local",
              stream: screenStream || localStream,
              label: profile.name,
              muted: true,
              isLocal: true,
              cameraOn: screenStream ? true : cameraOn,
              microphoneOn,
              speaking: false,
              handRaised,
              sharingScreen: Boolean(screenStream),
              accent: Boolean(screenStream),
              volume: undefined,
              onVolumeChange: undefined,
            },
          ]
        : [];
    const remote = remoteStreams.map(remoteStream => {
      const member = activeRoomMembers.find(
        candidate => candidate.socketId === remoteStream.socketId
      );
      const label =
        member?.name ||
        callPeers[remoteStream.socketId]?.name ||
        "Participante";
      // `muted` cobre o replaceTrack(null) de quem parou de compartilhar sem camera:
      // o track continua "live" e o tile ficava congelado no ultimo quadro.
      const hasVideo = remoteStream.stream
        .getVideoTracks()
        .some(
          track => track.readyState === "live" && track.enabled && !track.muted
        );
      return {
        id: remoteStream.socketId,
        stream: remoteStream.stream,
        label,
        muted: false,
        isLocal: false,
        microphoneOn: !member?.isMuted,
        cameraOn: hasVideo,
        speaking: Boolean(member?.isSpeaking),
        handRaised: Boolean(member?.handRaised),
        sharingScreen: screenSharerId === remoteStream.socketId,
        accent: screenSharerId === remoteStream.socketId,
        volume: remoteVolumes[remoteStream.socketId] ?? 100,
        onVolumeChange: (volume: number) =>
          setRemoteVolumes(current => ({
            ...current,
            [remoteStream.socketId]: volume,
          })),
      };
    });
    return [...local, ...remote];
  }, [
    activeRoomMembers,
    callEngine,
    cameraOn,
    callPeers,
    handRaised,
    isContextPreview,
    localStream,
    microphoneOn,
    profile,
    realtimeKit.participants,
    remoteStreams,
    remoteVolumes,
    screenSharerId,
    screenStream,
  ]);

  // O painel reduzido mostra quem compartilha, nao voce mesmo.
  const previewParticipant = useMemo(
    () => pickPreviewParticipant(stageParticipants),
    [stageParticipants]
  );
  const visualPreviewParticipant =
    previewParticipant?.cameraOn || previewParticipant?.sharingScreen
      ? previewParticipant
      : null;

  const guardarPerfil = (next: Profile, codigo: string) => {
    setAuthError("");
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
    localStorage.setItem(WORKSPACE_CODE_KEY, codigo);
    setWorkspaceCode(codigo);
    setProfile(next);
  };

  const entrarComoMembro = (pessoa: TeamMember, codigo: string) => {
    // O id vem do Monday: o mesmo em qualquer aparelho, e e ele que define quem
    // e administrador — sem depender do nome que a pessoa digitou.
    guardarPerfil(
      { id: toProfileId(pessoa.id), name: pessoa.name, photo: pessoa.photo },
      codigo
    );
  };

  const entrarPorNome = (valor: string, codigo: string) => {
    const next = createLocalProfile(valor);
    if (next) guardarPerfil(next, codigo);
  };

  const editMessage = (messageId: string, content: string) =>
    socketRef.current.emit("message:edit", {
      channelId: selectedChannelId,
      messageId,
      content,
    });

  const deleteMessage = (messageId: string) =>
    socketRef.current.emit("message:delete", {
      channelId: selectedChannelId,
      messageId,
    });

  const saveWorkspace = (proximo: ExternalCategory[]) =>
    socketRef.current.emit("workspace:update", { workspace: proximo });

  const muteParticipant = (socketId: string) => {
    if (!activeCallRef.current) return;
    if (callEngineRef.current === "realtimekit") {
      const participant = realtimeKitRef.current.participants.find(
        candidate => candidate.id === socketId
      );
      const stableUserId = participant?.userId.split(":")[0];
      const member = activeRoomMembers.find(
        candidate => candidate.userId === stableUserId
      );
      // O comando do SDK continua funcionando mesmo se o WebSocket de presença
      // estiver reconectando; o Worker mantém a lista lateral e o alvo em sync.
      void realtimeKitRef.current
        .muteParticipant(socketId)
        .catch(error =>
          setNotice(
            error instanceof Error
              ? error.message
              : "Não foi possível silenciar o participante."
          )
        );
      if (member)
        socketRef.current.emit("call:mute", {
          channelId: activeCallRef.current,
          socketId: member.socketId,
        });
      return;
    }
    socketRef.current.emit("call:mute", {
      channelId: activeCallRef.current,
      socketId,
    });
  };

  const selectChannel = (channelId: number) => {
    setSelectedChannelId(channelId);
    setUnread(atual => clearUnread(atual, channelId));
    setMobileSidebarOpen(false);
  };

  const sendMessage = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    socketRef.current.emit("message:new", {
      channelId: selectedChannelId,
      content: draft.trim(),
      parentId: threadParent?.id ?? null,
    });
    setDraft("");
    setThreadParent(null);
  };

  const reactToMessage = (messageId: string, emoji: string) =>
    socketRef.current.emit("message:reaction", {
      channelId: selectedChannelId,
      messageId,
      emoji,
    });
  const togglePin = (messageId: string) =>
    socketRef.current.emit("message:pin", {
      channelId: selectedChannelId,
      messageId,
    });
  const searchMessages = (query: string) => {
    setSearchQuery(query);
    if (query.trim().length >= 2)
      socketRef.current.emit("message:search", { query: query.trim() });
    else setSearchResults([]);
  };
  const updateStatus = (
    nextStatus: Presence["status"],
    nextMessage = statusMessage
  ) => {
    setStatus(nextStatus);
    setStatusMessage(nextMessage);
    socketRef.current.emit("presence:status", {
      status: nextStatus,
      statusMessage: nextMessage,
    });
  };
  const inviteToCall = (userId: string) => {
    if (!activeCallChannelId) return;
    socketRef.current.emit("call:invite", {
      channelId: activeCallChannelId,
      userId,
    });
    setNotice("Convite enviado para a sala de voz.");
  };
  const openDirectMessage = (peer: { userId: string; name: string }) => {
    if (!profile) return;
    const threadId = directThreadId(profile.id, peer.userId);
    setDirectOpen(true);
    setActiveDirectThreadId(threadId);
    setDirectThreads(current =>
      current.some(item => item.id === threadId)
        ? current
        : [
            {
              id: threadId,
              peerUserId: peer.userId,
              peerName: peer.name,
              lastMessage: "",
              updatedAt: new Date(0).toISOString(),
              unreadCount: 0,
            },
            ...current,
          ]
    );
    socketRef.current.emit("direct:history", { peerUserId: peer.userId });
    socketRef.current.emit("direct:read", { peerUserId: peer.userId });
  };
  const sendDirectMessage = (thread: DirectThread, content: string) => {
    socketRef.current.emit("direct:new", {
      toUserId: thread.peerUserId,
      toName: thread.peerName,
      content,
    });
  };
  const createDecision = (decision: {
    title: string;
    ownerName: string;
    dueDate: string;
  }) => socketRef.current.emit("decision:create", decision);
  const updateDecision = (id: string, status: "open" | "done") =>
    socketRef.current.emit("decision:update", { id, status });
  const toggleReadOnly = () => {
    const current = channelPermissions[selectedChannelId] ?? {
      readOnly: false,
      invitePolicy: "member" as const,
    };
    socketRef.current.emit("channel:permissions:update", {
      channelId: selectedChannelId,
      readOnly: !current.readOnly,
      invitePolicy: current.invitePolicy,
    });
  };
  const setMemberRole = (
    userId: string,
    role: "admin" | "moderator" | "member"
  ) => socketRef.current.emit("team:role:update", { userId, role });
  const toggleInvitePolicy = () => {
    const current = channelPermissions[selectedChannelId] ?? {
      readOnly: false,
      invitePolicy: "member" as const,
    };
    socketRef.current.emit("channel:permissions:update", {
      channelId: selectedChannelId,
      readOnly: current.readOnly,
      invitePolicy: current.invitePolicy === "admin" ? "member" : "admin",
    });
  };

  const leaveVoice = async () => {
    if (activeCallRef.current)
      socketRef.current.emit("call:leave", {
        channelId: activeCallRef.current,
      });
    const realtimeKitLeave =
      callEngineRef.current === "realtimekit"
        ? realtimeKitRef.current.leave().catch(() => undefined)
        : Promise.resolve();
    peerConnectionsRef.current.forEach(peer => peer.close());
    peerConnectionsRef.current.clear();
    pendingIceCandidatesRef.current.clear();
    peerAudioSnapshotsRef.current.clear();
    // Sem isto um reinicio de ICE agendado disparava depois de a pessoa sair.
    restartTimersRef.current.forEach(timer => window.clearTimeout(timer));
    restartTimersRef.current.clear();
    videoSendersRef.current.clear();
    screenAudioSendersRef.current.clear();
    negotiationRef.current.clear();
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    if (callEngineRef.current !== "realtimekit")
      screenStream?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;
    activeCallRef.current = null;
    callEngineRef.current = null;
    setActiveCallChannelId(null);
    setCallEngine(null);
    setLocalStream(null);
    setScreenStream(null);
    setScreenSharer(null);
    setScreenSharerId(null);
    setRemoteStreams([]);
    setCallPeers({});
    setCallStageOpen(false);
    setMusicOpen(false);
    setMusicState(null);
    setHandRaised(false);
    await realtimeKitLeave;
  };

  const requestMusicState = useCallback(() => {
    if (!activeCallRef.current) return;
    socketRef.current.emit("music:get", { channelId: activeCallRef.current });
  }, []);

  const enqueueMusic = useCallback(
    (source: YouTubeMusicSourceInput, playNow: boolean) => {
      if (!activeCallRef.current) return;
      socketRef.current.emit("music:enqueue", {
        channelId: activeCallRef.current,
        source,
        playNow,
      });
    },
    []
  );

  const claimMusicDj = useCallback(() => {
    if (!activeCallRef.current) return;
    socketRef.current.emit("music:claim-dj", {
      channelId: activeCallRef.current,
    });
  }, []);

  const controlMusic = useCallback(
    (action: string, payload: Record<string, unknown> = {}) => {
      if (!activeCallRef.current) return;
      socketRef.current.emit("music:control", {
        channelId: activeCallRef.current,
        action,
        ...payload,
      });
    },
    []
  );

  useEffect(() => {
    if (
      callEngine !== "realtimekit" ||
      !activeCallChannelId ||
      realtimeKit.status !== "idle"
    )
      return;
    setNotice(
      "A chamada foi encerrada pelo serviço de mídia. Entre novamente para reconectar."
    );
    void leaveVoice();
  }, [activeCallChannelId, callEngine, realtimeKit.status]);

  const joinLegacyVoice = async (
    channelId: number,
    selection: CallDeviceSelection = {}
  ) => {
    const { stream, mode } = await getCallMedia(
      navigator.mediaDevices,
      selection
    );
    localStreamRef.current = stream;
    activeCallRef.current = channelId;
    callEngineRef.current = "legacy";
    setCallEngine("legacy");
    setLocalStream(stream);
    setActiveCallChannelId(channelId);
    const somenteEscuta = mode === "listen-only";
    setMicrophoneOn(!somenteEscuta);
    setCameraOn(false);
    setSelectedAudioInput(selection.audioInputId ?? "");
    setHandRaised(false);
    setNotice(
      somenteEscuta
        ? "Nenhum microfone disponível: você entrou só para ouvir. Conecte um microfone e entre de novo para falar."
        : mode === "audio-only"
          ? "Você entrou somente por áudio no modo de compatibilidade."
          : "Modo de compatibilidade P2P ativo."
    );
    setCallStageOpen(true);
    setMobileSidebarOpen(false);
    socketRef.current.emit("call:join", { channelId, mediaEngine: "legacy" });
  };
  useEffect(() => {
    localStorage.setItem(AUDIO_CONFIG_KEY, JSON.stringify(audioConfig));
  }, [audioConfig]);

  const joinVoice = async (
    channelId: number,
    selection: CallDeviceSelection = {}
  ) => {
    if (activeCallRef.current === channelId) return setCallStageOpen(true);
    try {
      if (activeCallRef.current) await leaveVoice();
      const preference = callEnginePreferenceRef.current;
      if (preference === "legacy") {
        await joinLegacyVoice(channelId, selection);
        return;
      }

      if (!profile) return;
      setNotice("Preparando a sala no Cloudflare RealtimeKit…");
      let session;
      try {
        session = await requestRealtimeKitSession({
          workerUrl: String(import.meta.env.VITE_REALTIME_WORKER_URL ?? ""),
          channelId,
          roomName: findExternalChannel(channelId)?.name ?? `Sala ${channelId}`,
          workspaceCode,
          user: profile,
        });
      } catch (error) {
        if (shouldFallbackToLegacy(preference, error)) {
          await joinLegacyVoice(channelId, selection);
          return;
        }
        throw error;
      }

      await realtimeKit.join({
        authToken: session.authToken,
        audioInputId: selection.audioInputId,
        videoInputId: selection.videoInputId,
        screenQuality,
        audioConfig,
      });
      activeCallRef.current = channelId;
      callEngineRef.current = "realtimekit";
      setCallEngine("realtimekit");
      setActiveCallChannelId(channelId);
      setSelectedAudioInput(selection.audioInputId ?? "");
      setHandRaised(false);
      setNotice("Chamada conectada pelo Cloudflare SFU.");
      setCallStageOpen(true);
      setMobileSidebarOpen(false);
      socketRef.current.emit("call:join", {
        channelId,
        mediaEngine: "realtimekit",
      });
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : getCallMediaErrorMessage(error)
      );
    }
  };

  const prepareVoice = (channelId: number) => {
    if (activeCallRef.current === channelId) return setCallStageOpen(true);
    setPreflightChannelId(channelId);
  };

  const toggleMic = () => {
    if (callEngineRef.current === "realtimekit") {
      const next = !realtimeKitRef.current.microphoneOn;
      void realtimeKitRef.current
        .setMicrophoneEnabled(next)
        .then(() => {
          if (activeCallRef.current)
            socketRef.current.emit("call:audio-state", {
              channelId: activeCallRef.current,
              isMuted: !next,
              isSpeaking: false,
            });
        })
        .catch(error =>
          setNotice(
            error instanceof Error
              ? error.message
              : "Não foi possível alterar o microfone."
          )
        );
      return;
    }
    if (!localStreamRef.current?.getAudioTracks().length) {
      return setNotice(
        "Você está só ouvindo: nenhum microfone foi encontrado neste dispositivo."
      );
    }
    const next = !microphoneOn;
    localStreamRef.current.getAudioTracks().forEach(track => {
      track.enabled = next;
    });
    setMicrophoneOn(next);
    if (activeCallRef.current)
      socketRef.current.emit("call:audio-state", {
        channelId: activeCallRef.current,
        isMuted: !next,
        isSpeaking: false,
      });
  };

  const changeAudioDevice = async (deviceId: string) => {
    setSelectedAudioInput(deviceId);
    if (callEngineRef.current === "realtimekit") {
      void realtimeKitRef.current.changeAudioInput(deviceId).catch(error => {
        setNotice(error instanceof Error ? error.message : "Não foi possível trocar o microfone.");
      });
    }
  };

  const changeVideoDevice = async (deviceId: string) => {
    setSelectedVideoInput(deviceId);
    if (callEngineRef.current === "realtimekit") {
      void realtimeKitRef.current.changeVideoInput(deviceId).catch(error => {
        setNotice(error instanceof Error ? error.message : "Não foi possível trocar a câmera.");
      });
    }
  };

  const unblockAudio = () => {
    if (callEngineRef.current === "realtimekit") {
      void realtimeKitRef.current.retryAudio().catch(() => undefined);
      document.querySelectorAll<HTMLAudioElement>("audio").forEach(element => {
        void element.play().catch(() => undefined);
      });
      setAudioBlocked(false);
      return;
    }
    document.querySelectorAll<HTMLAudioElement>("audio").forEach(element => {
      void element.play().catch(() => undefined);
    });
    setAudioBlocked(false);
  };

  const toggleHandRaise = () => {
    if (!activeCallRef.current) return;
    const next = !handRaised;
    setHandRaised(next);
    socketRef.current.emit("call:hand-raise", {
      channelId: activeCallRef.current,
      active: next,
    });
  };

  const toggleCamera = async () => {
    if (!activeCallRef.current) return;
    if (callEngineRef.current === "realtimekit") {
      try {
        await realtimeKitRef.current.toggleCamera();
      } catch (error) {
        setNotice(
          error instanceof Error
            ? error.message
            : "Não foi possível alterar a câmera."
        );
      }
      return;
    }
    if (screenStream)
      return setNotice("Pare de compartilhar a tela antes de ligar a câmera.");

    const atual = localStreamRef.current?.getVideoTracks()[0];
    if (cameraOn && atual) {
      // Desligar de verdade: solta o dispositivo em vez de so silenciar, para a
      // luz da camera apagar.
      atual.stop();
      localStreamRef.current?.removeTrack(atual);
      videoSendersRef.current.forEach(sender => {
        void sender.replaceTrack(null).catch(() => undefined);
      });
      setLocalStream(
        localStreamRef.current
          ? new MediaStream(localStreamRef.current.getTracks())
          : null
      );
      setCameraOn(false);
      return;
    }

    try {
      // A camera so e ligada agora, a pedido. O sender de video ja existe desde
      // a criacao da conexao, entao isto e um replaceTrack — sem renegociar.
      const { track } = await getCameraTrack(navigator.mediaDevices);
      localStreamRef.current?.addTrack(track);
      await Promise.all(
        Array.from(videoSendersRef.current.values()).map(sender =>
          sender.replaceTrack(track).catch(() => undefined)
        )
      );
      track.onended = () => {
        setCameraOn(false);
      };
      setLocalStream(
        localStreamRef.current
          ? new MediaStream(localStreamRef.current.getTracks())
          : new MediaStream([track])
      );
      setCameraOn(true);
    } catch (error) {
      setNotice(getCallMediaErrorMessage(error));
    }
  };

  const changeAudioInput = async (deviceId: string) => {
    setSelectedAudioInput(deviceId);
    if (callEngineRef.current === "realtimekit") {
      try {
        await realtimeKitRef.current.changeAudioInput(deviceId);
        setNotice("Microfone atualizado para esta chamada.");
      } catch (error) {
        setNotice(
          error instanceof Error
            ? error.message
            : "Não foi possível trocar o microfone."
        );
      }
      return;
    }
    if (!deviceId || !localStreamRef.current) return;
    try {
      const { track } = await getSelectedAudioTrack(
        navigator.mediaDevices,
        deviceId
      );
      track.enabled = microphoneOn;
      const previousTrack = localStreamRef.current.getAudioTracks()[0];
      if (previousTrack) localStreamRef.current.removeTrack(previousTrack);
      localStreamRef.current.addTrack(track);
      previousTrack?.stop();
      await Promise.all(
        Array.from(peerConnectionsRef.current.values()).map(peer =>
          peer
            .getSenders()
            .find(sender => sender.track?.kind === "audio")
            ?.replaceTrack(track)
        )
      );
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      setNotice("Microfone atualizado para esta chamada.");
    } catch (error) {
      setNotice(getCallMediaErrorMessage(error));
    }
  };

  const shareScreen = async () => {
    if (!activeCallRef.current) return;
    if (callEngineRef.current === "realtimekit") {
      try {
        await realtimeKitRef.current.toggleScreenShare(screenQuality);
        setCallStageOpen(true);
      } catch (error) {
        setNotice(
          error instanceof Error
            ? error.message
            : "Não foi possível compartilhar a tela."
        );
      }
      return;
    }
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      const cameraTrack = localStreamRef.current?.getVideoTracks()[0] ?? null;
      videoSendersRef.current.forEach(sender => {
        void sender.replaceTrack(cameraTrack).catch(() => undefined);
      });
      screenAudioSendersRef.current.forEach(sender => {
        void sender.replaceTrack(null).catch(() => undefined);
      });
      socketRef.current.emit("call:screen-share", {
        channelId: activeCallRef.current,
        active: false,
      });
      setScreenStream(null);
      setScreenSharer(null);
      setScreenSharerId(null);
      setNotice("Você parou de compartilhar a tela.");
      return;
    }
    if (
      !navigator.mediaDevices ||
      !("getDisplayMedia" in navigator.mediaDevices)
    ) {
      setNotice("O compartilhamento de tela não é suportado no seu dispositivo/navegador.");
      return;
    }
    try {
      // Sem restricao o navegador entregava resolucao alta com poucos quadros:
      // otimo para texto parado, travado para video.
      const stream = await navigator.mediaDevices.getDisplayMedia(
        getScreenConstraints(screenQuality)
      );
      const track = stream.getVideoTracks()[0];
      // O som da tela vai por uma linha propria: substituir o microfone deixaria
      // a pessoa muda enquanto compartilha.
      const audioDaTela = stream.getAudioTracks()[0] ?? null;
      // Diz ao codificador o que a imagem e: sem isto ele trata a tela como
      // video comum e derruba a resolucao para segurar os quadros, deixando
      // texto ilegivel.
      track.contentHint = SCREEN_ENCODING[screenQuality].contentHint;
      await Promise.all(
        Array.from(peerConnectionsRef.current.entries()).map(
          async ([peerId, connection]) => {
            try {
              const senderDeVideo = videoSendersRef.current.get(peerId);
              await senderDeVideo?.replaceTrack(track);
              if (senderDeVideo)
                await applyScreenEncoding(senderDeVideo, screenQuality);
              await screenAudioSendersRef.current
                .get(peerId)
                ?.replaceTrack(audioDaTela);
              // A linha nasce sem track e o outro lado a responde como "so recebo".
              // Sem reabrir os dois sentidos, a tela nunca chega la.
              for (const transceiver of connection.getTransceivers()) {
                const ehDaTela =
                  transceiver.sender === videoSendersRef.current.get(peerId) ||
                  transceiver.sender ===
                    screenAudioSendersRef.current.get(peerId);
                if (ehDaTela && transceiver.direction !== "sendrecv")
                  transceiver.direction = "sendrecv";
              }
              await renegociar(peerId, connection);
            } catch (error) {
              // Um par com problema nao pode derrubar o compartilhamento dos outros.
              console.warn(
                "[VybeChat] nao foi possivel enviar a tela para um participante",
                { peerId, error }
              );
            }
          }
        )
      );
      setScreenStream(stream);
      setScreenSharer(profile?.name ?? "Você");
      // Compartilhar pela barra lateral nao mudava nada na tela de quem
      // compartilha: sem ver a propria transmissao, parecia que nao funcionou.
      setCallStageOpen(true);
      setNotice(
        "Você está compartilhando sua tela. Toque em “Parar transmissão” para encerrar."
      );
      socketRef.current.emit("call:screen-share", {
        channelId: activeCallRef.current,
        active: true,
      });
      track.onended = () => {
        const cameraTrack = localStreamRef.current?.getVideoTracks()[0] ?? null;
        videoSendersRef.current.forEach(sender => {
          void sender.replaceTrack(cameraTrack).catch(() => undefined);
        });
        screenAudioSendersRef.current.forEach(sender => {
          void sender.replaceTrack(null).catch(() => undefined);
        });
        if (activeCallRef.current)
          socketRef.current.emit("call:screen-share", {
            channelId: activeCallRef.current,
            active: false,
          });
        setScreenStream(null);
        setScreenSharer(null);
        setScreenSharerId(null);
      };
    } catch {
      setNotice("O compartilhamento de tela foi cancelado.");
    }
  };

  if (!profile) {
    return (
      <TeamLogin
        workerUrl={String(import.meta.env.VITE_REALTIME_WORKER_URL ?? "")}
        codigoInicial={workspaceCode}
        erroExterno={authError}
        onEntrar={entrarComoMembro}
        onEntrarPorNome={entrarPorNome}
      />
    );
  }

  const currentRole =
    presence.find(member => member.userId === profile.id)?.role ?? "member";
  const visibleMusicState = isContextPreview
    ? (musicState ?? PREVIEW_MUSIC_STATE)
    : musicState;
  const directUnreadCount = directThreads.reduce(
    (count, thread) => count + thread.unreadCount,
    0
  );
  const openDecisionCount = decisions.filter(
    decision => decision.status === "open"
  ).length;
  const isCallNotice = Boolean(
    activeCallChannelId && notice && CALL_NOTICE_PATTERN.test(notice)
  );
  const sidebar = (
    <aside
      className={`${mobileSidebarOpen ? "fixed inset-y-0 left-0 z-40 flex shadow-2xl" : "hidden"} vybe-sidebar flex-col md:relative md:flex md:shrink-0`}
    >
      <div className="vybe-sidebar-brand border-b px-5 py-5">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-orange-500 text-sm font-extrabold text-black">
              V
            </span>
            <div>
              <p className="cyber-label">Equipe Vybe</p>
              <h2 className="mt-1 font-sans text-lg font-semibold tracking-tight text-white">
                VybeChat
              </h2>
            </div>
          </div>
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="grid size-8 place-items-center rounded-lg text-stone-400 hover:bg-white/5 hover:text-white md:hidden"
            aria-label="Fechar canais"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-stone-400">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          Todos os sistemas online
        </div>
      </div>

      <div className="vybe-sidebar-scroll flex-1 overflow-y-auto">
        <CommandNavigation
          unread={unread}
          groups={workspace}
          selectedChannelId={selectedChannelId}
          voiceRooms={voiceRooms}
          onSelectText={selectChannel}
          onJoinVoice={prepareVoice}
        />
        {currentRole === "admin" && (
          <div className="mt-2">
            <ChannelManager workspace={workspace} onSave={saveWorkspace} />
          </div>
        )}
      </div>

      <WorkspaceUtilities
        unreadDirectCount={directUnreadCount}
        openDecisionCount={openDecisionCount}
        onOpenCommands={() => {
          setMobileSidebarOpen(false);
          openWorkspaceSurface("commands");
        }}
        onOpenDirects={() => {
          setMobileSidebarOpen(false);
          setDirectOpen(true);
        }}
        onOpenDecisions={() => {
          setMobileSidebarOpen(false);
          openWorkspaceSurface("decisions");
        }}
        onOpenDetails={() => {
          setMobileSidebarOpen(false);
          openWorkspaceSurface("collaboration");
        }}
      />

      {activeCallChannelId && (
        <div className="max-h-[48vh] overflow-y-auto border-t border-white/10 p-3">
          <VoiceContextDock
            roomName={
              findExternalChannel(activeCallChannelId)?.name ?? "Sala de voz"
            }
            participantCount={activeRoomMembers.length}
            microphoneOn={callMicrophoneOn}
            cameraOn={callCameraOn}
            screenSharing={callScreenSharing}
            audioInputs={audioInputs}
            selectedAudioInput={selectedAudioInput}
            onAudioInputChange={changeAudioInput}
            gateSensitivity={gateSensitivity}
            onGateSensitivityChange={setGateSensitivity}
            micLevel={micLevel}
            screenQuality={screenQuality}
            onScreenQualityChange={setScreenQuality}
            onToggleMic={toggleMic}
            onToggleCamera={toggleCamera}
            onShareScreen={shareScreen}
            onOpenMusic={() => setMusicOpen(true)}
            musicActive={Boolean(visibleMusicState?.queue.length)}
            onOpenFocus={() => setCallStageOpen(true)}
            onLeave={leaveVoice}
          />
          {isCallNotice && (
            <div className="mt-2 flex items-start gap-2 rounded-lg bg-orange-500/10 p-2.5 text-[11px] leading-4 text-orange-100">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-orange-400" />
              <span className="min-w-0 flex-1">{notice}</span>
              <button
                onClick={() => setNotice(null)}
                className="shrink-0 text-orange-200/60 hover:text-white"
                aria-label="Dispensar aviso"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-white/10 p-3">
        <Avatar className="size-9">
          {profile.photo ? (
            <AvatarImage
              src={profile.photo}
              alt=""
              className="rounded-xl object-cover"
            />
          ) : null}
          <AvatarFallback className={`rounded-xl text-xs ${avatarColorClass(profile?.name || "Vybe")}`}>
            {initials(profile?.name || "")}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-white">
            {profile.name}
          </p>
          <p className="text-[11px] text-emerald-400">Online</p>
        </div>
        <NotificationControl
          preferences={notificationPreferences}
          onRequestPermission={() => {
            void requestPermission();
          }}
          onToggleQuiet={toggleQuiet}
        />
        <button
          onClick={() => {
            leaveVoice();
            localStorage.removeItem(PROFILE_KEY);
            setProfile(null);
          }}
          className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-white/5 hover:text-white"
          aria-label="Sair"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </aside>
  );

  return (
    <main className="vybe-app flex min-h-screen text-foreground">
      <CallPreflightDialog
        gateSensitivity={gateSensitivity}
        onGateSensitivityChange={setGateSensitivity}
        open={preflightChannelId !== null}
        roomName={findExternalChannel(preflightChannelId ?? 0)?.name ?? "sala"}
        onOpenChange={open => {
          if (!open) setPreflightChannelId(null);
        }}
        onJoin={selection => {
          const channelId = preflightChannelId;
          setPreflightChannelId(null);
          if (channelId !== null) void joinVoice(channelId, selection);
        }}
      />
      <DirectMessagesDrawer
        hideTrigger
        open={directOpen}
        profileId={profile.id}
        threads={directThreads}
        messages={directMessages}
        presence={presence}
        activeThreadId={activeDirectThreadId}
        onOpenChange={setDirectOpen}
        onOpenThread={openDirectMessage}
        onSend={sendDirectMessage}
      />
      <VybeCommandPalette
        hideTrigger
        channels={workspace.flatMap(category => category.channels)}
        members={presence.filter(member => member.userId !== profile.id)}
        onSelectChannel={selectChannel}
        onJoinVoice={prepareVoice}
        onOpenDirect={openDirectMessage}
        onOpenCentral={() => openWorkspaceSurface("collaboration")}
        status={status}
        onSetStatus={setStatus}
        microphoneOn={microphoneOn}
        onToggleMic={toggleMic}
      />
      <DecisionsDrawer
        hideTrigger
        decisions={decisions}
        profileName={profile.name}
        onCreate={createDecision}
        onUpdate={updateDecision}
      />

      <section className="vybe-shell flex min-w-0 flex-1 overflow-hidden">
        {mobileSidebarOpen && (
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-black/75 md:hidden"
            aria-label="Fechar navegação"
          />
        )}
        {sidebar}

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="vybe-channel-header flex items-center gap-3 border-b px-4 sm:px-6">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="grid size-9 place-items-center rounded-lg text-stone-300 hover:bg-white/5 md:hidden"
              aria-label="Abrir canais"
            >
              <Menu className="size-5" />
            </button>
            <Hash className="size-5 shrink-0 text-orange-400" />
            <div className="min-w-0">
              <h1 className="truncate font-sans text-sm font-semibold">
                {selectedChannel?.name}
              </h1>
              <p className="hidden truncate text-[11px] text-stone-500 sm:block">
                Conversa e contexto da equipe
              </p>
            </div>
            <div className="vybe-channel-actions ml-auto flex items-center gap-2">
              {activeCallChannelId && (
                <button
                  onClick={() => setCallStageOpen(true)}
                  className="vybe-primary-action rounded-xl border px-3 py-2 text-xs font-semibold"
                >
                  Expandir chamada
                </button>
              )}
              <button
                onClick={() => openWorkspaceSurface("collaboration")}
                className="hidden rounded-xl border px-3 py-2 text-xs font-semibold lg:block"
              >
                Detalhes
              </button>
              <span className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs text-stone-300">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                {presence.length} online
              </span>
            </div>
          </header>

          <section className="vybe-channel-content flex min-h-0 min-w-0 flex-1 flex-col">
            {activeCallChannelId && callStageOpen && (
              <CallStage
                mode="split"
                roomName={findExternalChannel(activeCallChannelId)?.name ?? "Chamada"}
                participants={stageParticipants}
                microphoneOn={callMicrophoneOn}
                cameraOn={callCameraOn}
                sharingScreen={callScreenSharing}
                handRaised={handRaised}
                diagnostics={callDiagnostics}
                canModerate={currentRole === "admin" || currentRole === "moderator"}
                onMuteParticipant={muteParticipant}
                gateSensitivity={gateSensitivity}
                onGateSensitivityChange={setGateSensitivity}
                micLevel={micLevel}
                onToggleMic={toggleMic}
                onToggleCamera={toggleCamera}
                onChangeAudioDevice={changeAudioDevice}
                onChangeVideoDevice={changeVideoDevice}
                activeAudioDeviceId={selectedAudioInput}
                activeVideoDeviceId={selectedVideoInput}
                audioConfig={audioConfig}
                onAudioConfigChange={setAudioConfig}
                onShareScreen={shareScreen}
                onOpenMusic={() => setMusicOpen(true)}
                musicActive={Boolean(visibleMusicState?.queue.length)}
                onToggleHandRaise={toggleHandRaise}
                onLeave={leaveVoice}
                onMinimize={() => setCallStageOpen(false)}
              />
            )}
            <div className="vybe-timeline-scroll flex-1 overflow-y-auto">
              <div className="vybe-channel-container mx-auto">
                {channelMessages.length ? (
                  <div className="vybe-message-list">
                    {channelMessages.map((message, index) => (
                      <Fragment key={message.id}>
                        {needsDaySeparator(
                          message.createdAt,
                          channelMessages[index - 1]?.createdAt
                        ) && (
                          <div className="my-4 flex items-center gap-3 px-2">
                            <span className="h-px flex-1 bg-white/10" />
                            <span className="text-[10px] uppercase tracking-wider text-stone-600">
                              {dayLabel(message.createdAt)}
                            </span>
                            <span className="h-px flex-1 bg-white/10" />
                          </div>
                        )}
                        <article className="vybe-message flex gap-3">
                          <Avatar className="size-9 shrink-0">
                            <AvatarFallback className={`rounded-xl text-xs ${avatarColorClass(message.authorName)}`}>
                              {initials(message.authorName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-baseline gap-x-2 text-xs font-semibold text-stone-100">
                              {message.authorName}
                              <span className="text-[10px] font-normal text-stone-600">
                                {formatMessageTime(message.createdAt)}
                              </span>
                              {message.editedAt && (
                                <span className="text-[10px] font-normal text-stone-600">
                                  (editada)
                                </span>
                              )}
                            </p>
                            {editingId === message.id ? (
                              <form
                                onSubmit={event => {
                                  event.preventDefault();
                                  const texto = editingText.trim();
                                  if (texto && texto !== message.content)
                                    editMessage(message.id, texto);
                                  setEditingId(null);
                                }}
                                className="mt-1 flex gap-2"
                              >
                                <input
                                  autoFocus
                                  value={editingText}
                                  onChange={event =>
                                    setEditingText(event.target.value)
                                  }
                                  onKeyDown={event => {
                                    if (event.key === "Escape")
                                      setEditingId(null);
                                  }}
                                  className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-2 text-sm text-white outline-none focus:border-orange-400/50"
                                />
                                <button className="rounded-lg bg-orange-500 px-2.5 text-xs font-bold text-black">
                                  Salvar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  className="px-1.5 text-xs text-stone-400"
                                >
                                  Cancelar
                                </button>
                              </form>
                            ) : (
                              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-6 text-stone-300">
                                {normalizeExternalMessage(message.content)}
                              </p>
                            )}
                          </div>
                          {editingId !== message.id &&
                            (message.userId === profile.id ||
                              currentRole === "admin") && (
                              <div className="vybe-message-actions flex shrink-0 gap-1 self-start">
                                {message.userId === profile.id && (
                                  <button
                                    onClick={() => {
                                      setEditingId(message.id);
                                      setEditingText(message.content);
                                    }}
                                    className="rounded p-1.5 text-stone-500 hover:bg-white/5 hover:text-white"
                                    aria-label="Editar mensagem"
                                  >
                                    <Pencil className="size-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    if (
                                      confirm(
                                        "Apagar esta mensagem? As respostas na thread saem junto."
                                      )
                                    )
                                      deleteMessage(message.id);
                                  }}
                                  className="rounded p-1.5 text-stone-500 hover:bg-white/5 hover:text-rose-300"
                                  aria-label="Apagar mensagem"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            )}
                        </article>
                      </Fragment>
                    ))}
                  </div>
                ) : (
                  <div className="vybe-empty-state relative mt-8 flex flex-col items-center justify-center px-4 py-12 text-center sm:px-8">
                    <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-b from-orange-500/5 to-transparent blur-2xl" />
                    <div className="grid size-16 place-items-center rounded-3xl border border-orange-500/20 bg-gradient-to-b from-orange-400/20 to-orange-500/5 text-orange-400 shadow-xl shadow-orange-900/20">
                      <Hash className="size-8" />
                    </div>
                    <h2 className="mt-6 text-2xl font-bold tracking-tight text-white">
                      Bem-vindo a <span className="text-orange-400">#{selectedChannel?.name}</span>
                    </h2>
                    <p className="mt-3 max-w-md text-sm leading-relaxed text-stone-400">
                      Este é o início do canal. Envie a primeira mensagem para a equipe, compartilhe atualizações ou inicie uma chamada de voz para alinhar os próximos passos.
                    </p>
                    <div className="mt-8">
                      <button
                        onClick={() => {
                          if (selectedChannel && activeCallChannelId !== selectedChannel.id) {
                            setPreflightChannelId(selectedChannel.id);
                          }
                        }}
                        className="flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-orange-400"
                      >
                        <Phone className="size-4" />
                        Iniciar Chamada
                      </button>
                    </div>
                  </div>
                )}

                {typingNames.length > 0 && (
                  <p className="mt-3 px-2 text-xs text-orange-300">
                    {typingNames.join(", ")} digitando…
                  </p>
                )}
                {notice && !isCallNotice && (
                  <div className="vybe-notice mt-4 p-3 text-xs">
                    <span>{notice}</span>
                    <button
                      onClick={() => setNotice(null)}
                      className="shrink-0 text-orange-100/60 hover:text-white"
                      aria-label="Dispensar aviso"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {selectedChannel &&
              (selectedChannel.type === "text" ||
                activeCallChannelId === selectedChannelId) && (
                <form
                  onSubmit={sendMessage}
                  className="vybe-composer mx-auto flex w-full gap-2"
                >
                  <div className="min-w-0 flex-1">
                    {threadParent && (
                      <p className="mb-1 truncate px-1 text-xs text-orange-300">
                        Respondendo a {threadParent.authorName} ·{" "}
                        <button
                          type="button"
                          onClick={() => setThreadParent(null)}
                          className="underline"
                        >
                          cancelar
                        </button>
                      </p>
                    )}
                    <Textarea
                      value={draft}
                      onChange={event => {
                        setDraft(event.target.value);
                        socketRef.current.emit("typing", {
                          channelId: selectedChannelId,
                          active: Boolean(event.target.value.trim()),
                        });
                      }}
                      placeholder={`Mensagem para #${selectedChannel.name}`}
                      className="resize-none"
                      rows={1}
                    />
                  </div>
                  <Button
                    type="submit"
                    size="icon"
                    aria-label="Enviar mensagem"
                  >
                    <SendHorizontal className="size-4" />
                  </Button>
                </form>
              )}
          </section>
        </section>
      </section>

      <CollaborationDrawer
        hideTrigger
        messages={messages[selectedChannelId] ?? []}
        pinnedIds={pinnedIds[selectedChannelId] ?? []}
        presence={presence}
        profileId={profile.id}
        profileName={profile.name}
        status={status}
        statusMessage={statusMessage}
        searchQuery={searchQuery}
        searchResults={searchResults}
        activeCall={Boolean(activeCallChannelId)}
        pushToTalkEnabled={pushToTalkEnabled}
        pushToTalkKey={pushToTalkKey}
        isTransmitting={isTransmitting}
        canManage={currentRole === "admin"}
        readOnly={channelPermissions[selectedChannelId]?.readOnly ?? false}
        invitePolicy={
          channelPermissions[selectedChannelId]?.invitePolicy ?? "member"
        }
        onStatusChange={updateStatus}
        onSearch={searchMessages}
        onReact={reactToMessage}
        onPin={togglePin}
        onReply={message => {
          setThreadParent(message);
          setNotice(`Respondendo em thread a ${message.authorName}.`);
        }}
        onInvite={inviteToCall}
        onTogglePushToTalk={() => setPushToTalkEnabled(current => !current)}
        onPushToTalkKeyChange={setPushToTalkKey}
        onToggleReadOnly={toggleReadOnly}
        onSetRole={setMemberRole}
        onToggleInvitePolicy={toggleInvitePolicy}
      />

      {activeCallChannelId && (
        <CallAudioSink
          streams={callRemoteStreams}
          volumes={remoteVolumes}
          onBlocked={blocked => setAudioBlocked(blocked)}
        />
      )}
      {activeCallChannelId && callAudioBlocked && (
        <button
          onClick={unblockAudio}
          className="fixed inset-x-0 top-3 z-[60] mx-auto flex w-[min(92vw,420px)] items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black shadow-lg"
        >
          <Volume2 className="size-4" />
          Toque para ouvir a chamada
        </button>
      )}
      {activeCallChannelId && !callStageOpen && visualPreviewParticipant && (
        <button
          onClick={() => setCallStageOpen(true)}
          className="vybe-call-mini fixed bottom-[92px] right-5 z-20 p-3 text-left"
          aria-label="Expandir chamada"
        >
          <span className="flex items-center gap-2 text-xs font-semibold text-stone-200">
            <MonitorUp className="size-4 text-orange-400" />
            Expandir chamada
          </span>
          <div className="mt-3 h-28 overflow-hidden rounded-xl">
            <MediaTile
              {...visualPreviewParticipant}
              className="h-full min-h-0 rounded-xl"
            />
          </div>
        </button>
      )}

      {activeCallChannelId && (
        <MusicRoomPanel
          open={musicOpen}
          channelId={activeCallChannelId}
          roomName={
            findExternalChannel(activeCallChannelId)?.name ?? "Sala de voz"
          }
          userId={profile.id}
          musicState={visibleMusicState}
          canModerate={currentRole === "admin" || currentRole === "moderator"}
          onClose={() => setMusicOpen(false)}
          onRequestState={requestMusicState}
          onEnqueue={enqueueMusic}
          onClaimDj={claimMusicDj}
          onControl={controlMusic}
        />
      )}
    </main>
  );
}
