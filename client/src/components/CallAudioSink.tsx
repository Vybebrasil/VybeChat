import React, { useEffect, useRef } from "react";
import { toMediaElementVolume } from "@/lib/participant-volume";

type RemoteAudio = {
  socketId: string;
  stream: MediaStream;
};

type CallAudioSinkProps = {
  streams: RemoteAudio[];
  volumes: Record<string, number>;
  onBlocked?: (blocked: boolean) => void;
};

/**
 * Reproduz o áudio de todos os participantes remotos.
 *
 * Antes o <audio> vivia dentro do MediaTile, que só é montado quando a tela
 * cheia da chamada está aberta — e, com ela fechada, o único tile renderizado é
 * o local, que por definição não tem áudio. Na prática ninguém ouvia ninguém até
 * abrir o palco, e minimizar deixava a pessoa surda de novo. Alternar palco/grade
 * ou fixar alguém também remontava o elemento e podia perder o play().
 *
 * Este sink fica montado enquanto a chamada existir, independente da interface,
 * e nunca é remontado por mudança de layout.
 */
export function CallAudioSink({ streams, volumes, onBlocked }: CallAudioSinkProps) {
  return (
    <div aria-hidden="true" className="sr-only">
      {streams.map(item => (
        <PeerAudio
          key={item.socketId}
          stream={item.stream}
          volume={volumes[item.socketId] ?? 100}
          onBlocked={onBlocked}
        />
      ))}
    </div>
  );
}

function PeerAudio({ stream, volume, onBlocked }: { stream: MediaStream; volume: number; onBlocked?: (blocked: boolean) => void }) {
  const ref = useRef<HTMLAudioElement>(null);
  // `onBlocked` chega como função nova a cada render do app. Se ela entrar nas
  // dependências do efeito, todo render reatribui o srcObject e chama play() de
  // novo — o que interrompe a reprodução. Como a tela re-renderiza várias vezes
  // por segundo (métricas da chamada, nível do microfone, presença), a voz de
  // todo mundo era picotada continuamente. Guardada num ref, ela não dispara
  // mais nada.
  const onBlockedRef = useRef(onBlocked);
  useEffect(() => { onBlockedRef.current = onBlocked; }, [onBlocked]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    // Reatribuir o mesmo stream reinicia a reprodução à toa.
    if (element.srcObject !== stream) element.srcObject = stream;
    let cancelled = false;
    const attempt = () => {
      // Já tocando: mexer aqui só causaria falha.
      if (!element.paused) return;
      const playback = element.play();
      if (!playback || typeof playback.catch !== "function") return;
      // O navegador pode recusar o autoplay. Antes o erro era engolido e o áudio
      // sumia em silêncio; agora avisamos para a interface poder pedir um clique.
      void playback.then(
        () => { if (!cancelled) onBlockedRef.current?.(false); },
        (error: unknown) => {
          // AbortError não é bloqueio: é uma reprodução substituída por outra.
          const abortada = error instanceof DOMException && error.name === "AbortError";
          if (!cancelled && !abortada) onBlockedRef.current?.(true);
        },
      );
    };
    attempt();
    // Streams em mesh recebem tracks depois da conexão abrir; sem isso o
    // elemento fica preso num stream que ainda estava vazio no primeiro play.
    stream.addEventListener("addtrack", attempt);
    return () => {
      cancelled = true;
      stream.removeEventListener("addtrack", attempt);
    };
  }, [stream]);

  useEffect(() => {
    if (ref.current) ref.current.volume = toMediaElementVolume(volume);
  }, [volume]);

  return <audio ref={ref} autoPlay playsInline />;
}
