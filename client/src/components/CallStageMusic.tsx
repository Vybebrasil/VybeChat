import { Music2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getRealtimeSocket } from "@/lib/realtime";
import type { MusicControlAction, RoomMusicState } from "@/lib/room-music";
import { RoomMusicPanel } from "@/components/RoomMusicPanel";

type MusicContext = { channelId: number; userId: string; canModerate: boolean; roomName: string } | null;

declare global {
  interface WindowEventMap {
    "vybechat:music-context": CustomEvent<MusicContext>;
  }
}

export function CallStageMusic() {
  const [context, setContext] = useState<MusicContext>(null);
  const [open, setOpen] = useState(false);
  const [musicState, setMusicState] = useState<RoomMusicState | null>(null);

  useEffect(() => {
    const receiveContext = (event: CustomEvent<MusicContext>) => {
      setContext(event.detail);
      if (!event.detail) {
        setOpen(false);
        setMusicState(null);
      }
    };
    window.addEventListener("vybechat:music-context", receiveContext as EventListener);
    return () => window.removeEventListener("vybechat:music-context", receiveContext as EventListener);
  }, []);

  useEffect(() => {
    if (!context) return;
    const socket = getRealtimeSocket();
    const receiveState = ({ channelId, state }: { channelId: number; state: RoomMusicState }) => {
      if (channelId === context.channelId) setMusicState(state);
    };
    socket.on("music:state", receiveState);
    socket.emit("music:get", { channelId: context.channelId });
    return () => { socket.off("music:state", receiveState); };
  }, [context?.channelId]);

  const button = <button onClick={() => setOpen(true)} disabled={!context} className="grid size-11 place-items-center rounded-xl border border-orange-300/25 bg-orange-400/10 text-orange-100 transition-colors hover:bg-orange-400/20 disabled:cursor-not-allowed disabled:opacity-35" aria-label="Abrir música da sala"><Music2 className="size-5" /></button>;
  if (!context) return button;

  const send = (type: string, payload: Record<string, unknown> = {}) => getRealtimeSocket().emit(type, { channelId: context.channelId, ...payload });
  const panel = <RoomMusicPanel open={open} channelId={context.channelId} roomName={context.roomName} userId={context.userId} canModerate={context.canModerate} musicState={musicState} onClose={() => setOpen(false)} onRequestState={() => send("music:get")} onEnqueue={source => send("music:enqueue", source)} onClaimDj={() => send("music:claim-dj")} onControl={(action: MusicControlAction, payload) => send("music:control", { action, ...payload })} />;

  return <>{button}{open ? createPortal(panel, document.body) : null}</>;
}
