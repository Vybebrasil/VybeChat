import type RTKClient from "@cloudflare/realtimekit";
import type { RTKParticipant } from "@cloudflare/realtimekit";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PeerAudioDiagnostics } from "@/lib/peer-audio-diagnostics";
import type { ScreenQuality } from "@/lib/screen-share";

export type RealtimeKitCallStatus = "idle" | "joining" | "joined" | "leaving" | "error";

export type RealtimeKitCallParticipant = {
  id: string;
  userId: string;
  label: string;
  picture?: string;
  stream: MediaStream | null;
  audioStream: MediaStream;
  isLocal: boolean;
  cameraOn: boolean;
  microphoneOn: boolean;
  sharingScreen: boolean;
  speaking: boolean;
};

type JoinOptions = {
  authToken: string;
  audioInputId?: string;
  videoInputId?: string;
  audioConfig?: any;
  screenQuality: ScreenQuality;
};

type StreamPair = { display: MediaStream; audio: MediaStream };

function liveTrack(track: MediaStreamTrack | null | undefined): track is MediaStreamTrack {
  return Boolean(track && track.readyState !== "ended");
}

function updateStream(stream: MediaStream, tracks: Array<MediaStreamTrack | null | undefined>) {
  const desired = tracks.filter(liveTrack);
  const ids = new Set(desired.map(track => track.id));
  stream.getTracks().forEach(track => { if (!ids.has(track.id)) stream.removeTrack(track); });
  desired.forEach(track => { if (!stream.getTracks().some(current => current.id === track.id)) stream.addTrack(track); });
  return stream;
}

function screenConstraints(quality: ScreenQuality) {
  return quality === "fluida"
    ? { width: { max: 1280 }, height: { max: 720 }, frameRate: { ideal: 30, max: 30 } }
    : { width: { max: 1920 }, height: { max: 1080 }, frameRate: { ideal: 15, max: 30 } };
}

function errorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "NotAllowedError") return "Permita o acesso ao microfone ou à câmera para entrar na chamada.";
  if (error instanceof Error && error.message) return error.message;
  return "Não foi possível conectar ao serviço de chamadas.";
}

export function useRealtimeKitCall() {
  const meetingRef = useRef<RTKClient | null>(null);
  const streamsRef = useRef(new Map<string, StreamPair>());
  const cleanupRef = useRef<(() => void) | null>(null);
  const screenQualityRef = useRef<ScreenQuality>("nitida");
  const [status, setStatus] = useState<RealtimeKitCallStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<RealtimeKitCallParticipant[]>([]);
  const [diagnostics, setDiagnostics] = useState<Record<string, PeerAudioDiagnostics>>({});
  const [audioBlocked, setAudioBlocked] = useState(false);

  const streamPair = useCallback((id: string) => {
    const existing = streamsRef.current.get(id);
    if (existing) return existing;
    const created = { display: new MediaStream(), audio: new MediaStream() };
    streamsRef.current.set(id, created);
    return created;
  }, []);

  const syncParticipants = useCallback(() => {
    const meeting = meetingRef.current;
    if (!meeting) return;

    const localPair = streamPair("local");
    const localScreen = meeting.self.screenShareEnabled ? meeting.self.screenShareTracks?.video : null;
    updateStream(localPair.display, [localScreen || meeting.self.videoTrack, meeting.self.audioTrack, meeting.self.screenShareTracks?.audio]);
    updateStream(localPair.audio, []);
    const next: RealtimeKitCallParticipant[] = [{
      id: "local",
      userId: meeting.self.customParticipantId || meeting.self.userId || "local",
      label: meeting.self.name,
      picture: meeting.self.picture,
      stream: localPair.display,
      audioStream: localPair.audio,
      isLocal: true,
      cameraOn: meeting.self.screenShareEnabled || meeting.self.videoEnabled,
      microphoneOn: meeting.self.audioEnabled,
      sharingScreen: meeting.self.screenShareEnabled,
      speaking: false,
    }];

    for (const participant of meeting.participants.joined.toArray()) {
      const pair = streamPair(participant.id);
      const screenVideo = participant.screenShareEnabled ? participant.screenShareTracks?.video : null;
      const screenAudio = participant.screenShareEnabled ? participant.screenShareTracks?.audio : null;
      updateStream(pair.display, [screenVideo || participant.videoTrack, participant.audioTrack, screenAudio]);
      updateStream(pair.audio, [participant.audioTrack, screenAudio]);
      next.push({
        id: participant.id,
        userId: participant.customParticipantId || participant.userId,
        label: participant.name,
        picture: participant.picture,
        stream: pair.display,
        audioStream: pair.audio,
        isLocal: false,
        cameraOn: participant.screenShareEnabled || participant.videoEnabled,
        microphoneOn: participant.audioEnabled,
        sharingScreen: participant.screenShareEnabled,
        speaking: meeting.participants.lastActiveSpeaker === participant.id,
      });
    }

    const activeIds = new Set(next.map(participant => participant.id));
    streamsRef.current.forEach((_, id) => { if (!activeIds.has(id)) streamsRef.current.delete(id); });
    setParticipants(next);
  }, [streamPair]);

  const bindMeeting = useCallback((meeting: RTKClient) => {
    const joined = meeting.participants.joined;
    const onRoomJoined = ({ reconnected }: { reconnected: boolean }) => {
      setStatus("joined");
      setError(null);
      if (reconnected) syncParticipants();
    };
    const onRoomLeft = () => {
      streamsRef.current.clear();
      setParticipants([]);
      setDiagnostics({});
      setStatus("idle");
    };
    const onAutoplayError = () => setAudioBlocked(true);
    const onMediaScore = (_participant: RTKParticipant, { participantId, score }: { participantId: string; score: number }) => {
      setDiagnostics(current => ({
        ...current,
        [participantId]: {
          sending: true,
          receiving: true,
          connection: "connected",
          quality: score < 5 ? "degraded" : "stable",
        },
      }));
    };
    const onSelfMediaScore = ({ score }: { score: number }) => {
      setDiagnostics(current => ({
        ...current,
        local: {
          sending: true,
          receiving: true,
          connection: "connected",
          quality: score < 5 ? "degraded" : "stable",
        },
      }));
    };
    const update = () => syncParticipants();

    meeting.self.on("roomJoined", onRoomJoined);
    meeting.self.on("roomLeft", onRoomLeft);
    meeting.self.on("autoplayError", onAutoplayError);
    meeting.self.on("audioUpdate", update);
    meeting.self.on("videoUpdate", update);
    meeting.self.on("screenShareUpdate", update);
    meeting.self.on("mediaScoreUpdate", onSelfMediaScore);
    meeting.participants.on("activeSpeaker", update);
    joined.on("participantJoined", update);
    joined.on("participantLeft", update);
    joined.on("participantsCleared", update);
    joined.on("participantsUpdate", update);
    joined.on("audioUpdate", update);
    joined.on("videoUpdate", update);
    joined.on("screenShareUpdate", update);
    joined.on("mediaScoreUpdate", onMediaScore);

    cleanupRef.current = () => {
      meeting.self.off("roomJoined", onRoomJoined);
      meeting.self.off("roomLeft", onRoomLeft);
      meeting.self.off("autoplayError", onAutoplayError);
      meeting.self.off("audioUpdate", update);
      meeting.self.off("videoUpdate", update);
      meeting.self.off("screenShareUpdate", update);
      meeting.self.off("mediaScoreUpdate", onSelfMediaScore);
      meeting.participants.off("activeSpeaker", update);
      joined.off("participantJoined", update);
      joined.off("participantLeft", update);
      joined.off("participantsCleared", update);
      joined.off("participantsUpdate", update);
      joined.off("audioUpdate", update);
      joined.off("videoUpdate", update);
      joined.off("screenShareUpdate", update);
      joined.off("mediaScoreUpdate", onMediaScore);
    };
  }, [syncParticipants]);

  const leave = useCallback(async () => {
    const meeting = meetingRef.current;
    if (!meeting) {
      setStatus("idle");
      return;
    }
    setStatus("leaving");
    cleanupRef.current?.();
    cleanupRef.current = null;
    meetingRef.current = null;
    try {
      await meeting.leave();
    } finally {
      streamsRef.current.clear();
      setParticipants([]);
      setDiagnostics({});
      setAudioBlocked(false);
      setStatus("idle");
    }
  }, []);

  const join = useCallback(async ({ authToken, audioInputId, videoInputId, screenQuality, audioConfig }: JoinOptions) => {
    if (meetingRef.current) await leave();
    setStatus("joining");
    setError(null);
    screenQualityRef.current = screenQuality;
    let initializedMeeting: RTKClient | null = null;
    try {
      // Carregado apenas quando alguém entra em uma chamada: chat e canais não
      // precisam pagar o custo do SDK WebRTC no primeiro carregamento.
      const { default: RealtimeKitClient } = await import("@cloudflare/realtimekit");
      const meeting = await RealtimeKitClient.init({
        authToken,
        defaults: {
          audio: true,
          video: false,
          autoSwitchAudioDevice: true,
          mediaConfiguration: {
            audio: { 
              echoCancellation: audioConfig?.echoCancellation ?? true, 
              noiseSupression: audioConfig?.noiseSuppression ?? true, 
              autoGainControl: audioConfig?.autoGainControl ?? true, 
              enableStereo: false 
            },
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
            screenshare: screenConstraints(screenQuality),
          },
        },
      });
      initializedMeeting = meeting;
      meetingRef.current = meeting;
      bindMeeting(meeting);

      if (audioInputId || videoInputId) {
        const devices = await meeting.self.getAllDevices();
        const selectedAudio = audioInputId ? devices.find(device => device.deviceId === audioInputId && device.kind === "audioinput") : null;
        const selectedVideo = videoInputId ? devices.find(device => device.deviceId === videoInputId && device.kind === "videoinput") : null;
        if (selectedAudio) await meeting.self.setDevice(selectedAudio);
        if (selectedVideo) await meeting.self.setDevice(selectedVideo);
      }

      await meeting.join();
      setStatus("joined");
      syncParticipants();
      return meeting;
    } catch (caught) {
      cleanupRef.current?.();
      cleanupRef.current = null;
      meetingRef.current = null;
      if (initializedMeeting) await initializedMeeting.leave().catch(() => undefined);
      const message = errorMessage(caught);
      setError(message);
      setStatus("error");
      throw caught instanceof Error ? caught : new Error(message);
    }
  }, [bindMeeting, leave, syncParticipants]);

  const setMicrophoneEnabled = useCallback(async (enabled: boolean) => {
    const meeting = meetingRef.current;
    if (!meeting) return;
    if (enabled) await meeting.self.enableAudio(); else await meeting.self.disableAudio();
    syncParticipants();
  }, [syncParticipants]);

  const toggleMicrophone = useCallback(async () => {
    const meeting = meetingRef.current;
    if (meeting) await setMicrophoneEnabled(!meeting.self.audioEnabled);
  }, [setMicrophoneEnabled]);

  const toggleCamera = useCallback(async () => {
    const meeting = meetingRef.current;
    if (!meeting) return;
    if (meeting.self.videoEnabled) await meeting.self.disableVideo(); else await meeting.self.enableVideo();
    syncParticipants();
  }, [syncParticipants]);

  const setDevice = useCallback(async (deviceId: string, kind: "audioinput" | "videoinput") => {
    const meeting = meetingRef.current;
    if (!meeting) return;
    const devices = await meeting.self.getAllDevices();
    const selected = devices.find(device => device.deviceId === deviceId && device.kind === kind);
    if (selected) {
      await meeting.self.setDevice(selected);
      syncParticipants();
    }
  }, [syncParticipants]);

  const toggleScreenShare = useCallback(async (selectedQuality?: ScreenQuality) => {
    const meeting = meetingRef.current;
    if (!meeting) return;
    if (selectedQuality) screenQualityRef.current = selectedQuality;
    if (meeting.self.screenShareEnabled) {
      await meeting.self.disableScreenShare();
    } else {
      const quality = screenQualityRef.current;
      const constraints = quality === "fluida"
        ? { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
        : { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 15 } };
      await meeting.self.enableScreenShare();
      await meeting.self.updateScreenshareConstraints(constraints).catch(() => undefined);
    }
    syncParticipants();
  }, [syncParticipants]);

  const changeAudioInput = useCallback(async (deviceId: string) => {
    const meeting = meetingRef.current;
    if (!meeting || !deviceId) return;
    const devices = await meeting.self.getAllDevices();
    const device = devices.find(candidate => candidate.deviceId === deviceId && candidate.kind === "audioinput");
    if (!device) throw new Error("O microfone selecionado não está mais disponível.");
    await meeting.self.setDevice(device);
    syncParticipants();
  }, [syncParticipants]);

  const changeVideoInput = useCallback(async (deviceId: string) => {
    const meeting = meetingRef.current;
    if (!meeting) return;
    const devices = await meeting.self.getAllDevices();
    const device = devices.find(candidate => candidate.deviceId === deviceId && candidate.kind === "videoinput");
    if (!device) throw new Error("A câmera selecionada não está mais disponível.");
    await meeting.self.setDevice(device);
    syncParticipants();
  }, [syncParticipants]);

  const muteParticipant = useCallback(async (participantId: string) => {
    const participant = meetingRef.current?.participants.joined.get(participantId) as RTKParticipant | undefined;
    if (participant) await participant.disableAudio();
  }, []);

  const retryAudio = useCallback(async () => {
    const meeting = meetingRef.current;
    if (!meeting) return;
    await meeting.self.playAudio();
    setAudioBlocked(false);
  }, []);

  useEffect(() => () => {
    cleanupRef.current?.();
    const meeting = meetingRef.current;
    meetingRef.current = null;
    if (meeting) void meeting.leave().catch(() => undefined);
  }, []);

  const local = participants.find(participant => participant.isLocal) ?? null;
  return {
    status,
    error,
    participants,
    diagnostics,
    audioBlocked,
    localStream: local?.stream ?? null,
    microphoneOn: local?.microphoneOn ?? false,
    cameraOn: Boolean(local && local.cameraOn && !local.sharingScreen),
    sharingScreen: local?.sharingScreen ?? false,
    remoteStreams: participants.filter(participant => !participant.isLocal).map(participant => ({ socketId: participant.id, stream: participant.audioStream })),
    join,
    leave,
    toggleMicrophone,
    setMicrophoneEnabled,
    toggleCamera,
    toggleScreenShare,
    changeAudioInput,
    changeVideoInput,
    muteParticipant,
    retryAudio,
  };
}
