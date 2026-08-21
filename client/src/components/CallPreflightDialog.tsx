import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getCallConstraints, type CallDeviceSelection } from "@/lib/call-media";
import { judgePeak, passesGate, recordMicSample, toMeterPercent, VERDICT_TEXT, type PreviewVerdict } from "@/lib/mic-preview";
import { createNoiseGate, sensitivityToThreshold } from "@/lib/noise-gate";
import { getAudioLevel } from "@/lib/speaking-detector";
import { AudioLines, CheckCircle2, Loader2, Mic, Play, Video, VideoOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type InputDevice = { deviceId: string; label: string };

type CallPreflightDialogProps = {
  open: boolean;
  roomName: string;
  onOpenChange: (open: boolean) => void;
  onJoin: (selection: CallDeviceSelection) => void;
  gateSensitivity: number;
  onGateSensitivityChange: (value: number) => void;
};

export function CallPreflightDialog({ open, roomName, onOpenChange, onJoin, gateSensitivity, onGateSensitivityChange }: CallPreflightDialogProps) {
  const [audioInputs, setAudioInputs] = useState<InputDevice[]>([]);
  const [videoInputs, setVideoInputs] = useState<InputDevice[]>([]);
  const [audioInputId, setAudioInputId] = useState("");
  const [videoInputId, setVideoInputId] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "ready" | "error">("idle");
  const [message, setMessage] = useState("Escolha seus dispositivos e teste antes de entrar.");
  const [audioLevel, setAudioLevel] = useState(0);
  const [peak, setPeak] = useState(0);
  const [gravando, setGravando] = useState(false);
  const [previaUrl, setPreviaUrl] = useState("");
  const previewRef = useRef<HTMLVideoElement>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const gateSensitivityRef = useRef(gateSensitivity);
  useEffect(() => { gateSensitivityRef.current = gateSensitivity; }, [gateSensitivity]);

  // O medidor e o controle usam a mesma escala: se a barra passa da marca, sua
  // voz esta sendo transmitida. Era isso que faltava para o numero ter sentido.
  const transmitindo = passesGate(audioLevel, gateSensitivity);
  const veredito: PreviewVerdict = judgePeak(peak);

  const ouvirMinhaVoz = async () => {
    const stream = previewStreamRef.current;
    if (!stream) return setMessage("Toque em “Testar dispositivos” antes de ouvir sua voz.");
    setGravando(true);
    setPreviaUrl("");
    setMessage("Gravando 4 segundos… fale normalmente.");
    try {
      const url = await recordMicSample({ stream: new MediaStream(stream.getAudioTracks()), durationMs: 4000 });
      setPreviaUrl(url);
      setMessage("Esta é a sua voz como os outros ouvem, já com o corte aplicado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível gravar a prévia.");
    } finally {
      setGravando(false);
    }
  };

  const stopPreview = () => {
    previewStreamRef.current?.getTracks().forEach(track => track.stop());
    previewStreamRef.current = null;
    if (previewRef.current) previewRef.current.srcObject = null;
  };

  const checkDevices = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setMessage("Este navegador não liberou acesso aos dispositivos de chamada.");
      return;
    }
    stopPreview();
    setStatus("checking");
    setMessage("Testando microfone e câmera…");
    try {
      const constraints = getCallConstraints({ audioInputId, videoInputId });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints.audio, video: constraints.video });
      previewStreamRef.current = stream;
      if (previewRef.current) previewRef.current.srcObject = stream;
      setStatus("ready");
      setMessage("Dispositivos prontos. Seu microfone e sua câmera estão disponíveis.");
      const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass || !stream.getAudioTracks().length) return;
      const context = new AudioContextClass();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.frequencyBinCount);
      let frame = 0;
      const updateLevel = () => {
        analyser.getByteTimeDomainData(samples);
        // Mesma medida usada pelo portao na chamada, na mesma escala do controle.
        const nivel = toMeterPercent(getAudioLevel(samples));
        setAudioLevel(nivel);
        setPeak(anterior => Math.max(anterior, nivel));
        frame = requestAnimationFrame(updateLevel);
      };
      updateLevel();
      // O portao roda tambem aqui: a previa mostra e grava exatamente o que os
      // outros recebem, nao o microfone cru.
      const soltarPortao = createNoiseGate({
        stream,
        getThreshold: () => sensitivityToThreshold(gateSensitivityRef.current),
        isEnabled: () => true,
      });
      stream.getTracks().forEach(track => { track.onended = () => { cancelAnimationFrame(frame); soltarPortao?.(); void context.close(); }; });
    } catch (error) {
      setStatus("error");
      const name = error instanceof DOMException ? error.name : "";
      setMessage(name === "NotAllowedError" ? "Permita o microfone e a câmera para testar a chamada." : "Não foi possível testar os dispositivos selecionados.");
    }
  };

  useEffect(() => {
    if (!open) { stopPreview(); setAudioLevel(0); return; }
    void navigator.mediaDevices?.enumerateDevices?.().then(devices => {
      setAudioInputs(devices.filter(device => device.kind === "audioinput").map((device, index) => ({ deviceId: device.deviceId, label: device.label || `Microfone ${index + 1}` })));
      setVideoInputs(devices.filter(device => device.kind === "videoinput").map((device, index) => ({ deviceId: device.deviceId, label: device.label || `Câmera ${index + 1}` })));
    });
    return stopPreview;
  }, [open]);

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="vybe-preflight max-w-xl border-orange-300/25 bg-[#101116] p-0 text-orange-50" showCloseButton={false}><div className="p-5 sm:p-6"><DialogHeader><p className="cyber-label">Pré-checagem da chamada</p><DialogTitle className="text-xl text-orange-50">Entrar em {roomName}</DialogTitle><DialogDescription className="text-stone-400">Confirme seus dispositivos antes de entrar. Você poderá alterá-los durante a chamada.</DialogDescription></DialogHeader><div className="mt-5 grid gap-4 sm:grid-cols-[1.1fr_.9fr]"><div className="relative min-h-44 overflow-hidden rounded-2xl border border-orange-300/20 bg-black/40"><video ref={previewRef} autoPlay muted playsInline className="h-full w-full object-cover" />{status !== "ready" && <div className="absolute inset-0 grid place-items-center text-center"><div><VideoOff className="mx-auto size-7 text-orange-300" /><p className="mt-2 text-xs text-stone-400">Preview da câmera</p></div></div>}</div><div className="space-y-3"><label className="block text-xs text-stone-400"><span className="mb-1.5 flex items-center gap-1.5"><Mic className="size-3.5 text-orange-300" />Microfone</span><select value={audioInputId} onChange={event => setAudioInputId(event.target.value)} className="h-10 w-full rounded-xl border border-orange-300/20 bg-black/40 px-3 text-sm text-orange-50 outline-none"><option value="">Padrão do sistema</option>{audioInputs.map(input => <option key={input.deviceId} value={input.deviceId}>{input.label}</option>)}</select></label><label className="block text-xs text-stone-400"><span className="mb-1.5 flex items-center gap-1.5"><Video className="size-3.5 text-orange-300" />Câmera</span><select value={videoInputId} onChange={event => setVideoInputId(event.target.value)} className="h-10 w-full rounded-xl border border-orange-300/20 bg-black/40 px-3 text-sm text-orange-50 outline-none"><option value="">Padrão do sistema</option>{videoInputs.map(input => <option key={input.deviceId} value={input.deviceId}>{input.label}</option>)}</select></label><div className="rounded-xl border border-orange-300/15 bg-orange-400/5 p-3"><span className="flex items-center gap-1.5 text-xs font-medium text-orange-100"><AudioLines className="size-3.5 text-orange-300" />Nível do microfone</span><div className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-black/60">
  <div className={`h-full rounded-full transition-[width] duration-75 ${transmitindo ? "bg-gradient-to-r from-emerald-400 to-emerald-300" : "bg-stone-600"}`} style={{ width: `${Math.max(2, audioLevel)}%` }} />
  {gateSensitivity > 0 && <span aria-hidden className="absolute inset-y-0 w-0.5 bg-orange-400 shadow-[0_0_6px_rgba(255,138,0,.9)]" style={{ left: `${gateSensitivity}%` }} />}
</div>
<p className={`mt-1.5 text-[11px] font-semibold ${transmitindo ? "text-emerald-300" : "text-stone-500"}`}>{transmitindo ? "Transmitindo agora" : "Silenciado — abaixo do corte"}</p>
<p className="mt-0.5 text-[10px] leading-4 text-stone-500">{VERDICT_TEXT[veredito]}</p>
<label className="mt-3 block border-t border-orange-300/10 pt-2.5"><span className="flex items-center justify-between gap-2 text-xs font-medium text-orange-100"><span>Cortar som de fundo</span><span className="font-mono text-[10px] text-stone-400">{gateSensitivity === 0 ? "desligado" : `${gateSensitivity}%`}</span></span><input aria-label="Cortar som de fundo" type="range" min="0" max="60" value={gateSensitivity} onChange={event => onGateSensitivityChange(Number(event.target.value))} className="mt-2 h-1 w-full accent-orange-400" /><span className="mt-1 block text-[10px] leading-4 text-stone-500">A marca laranja é o corte. Sua voz precisa passar dela para ser transmitida.</span></label>
<button type="button" onClick={ouvirMinhaVoz} disabled={gravando} className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border border-orange-300/25 py-2 text-[11px] font-semibold text-orange-100 hover:bg-orange-400/10 disabled:opacity-60">
  {gravando ? <><Loader2 className="size-3.5 animate-spin" />Gravando…</> : <><Play className="size-3.5" />Ouvir minha voz</>}
</button>
{previaUrl && <audio src={previaUrl} controls autoPlay className="mt-2 w-full" />}</div></div></div><div className={`mt-4 flex items-start gap-2 rounded-xl border p-3 text-xs ${status === "error" ? "border-rose-400/30 bg-rose-500/10 text-rose-100" : status === "ready" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100" : "border-orange-300/15 bg-black/20 text-stone-400"}`}>{status === "ready" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <AudioLines className="mt-0.5 size-4 shrink-0" />}<span>{message}</span></div><div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" onClick={() => onOpenChange(false)} className="border-orange-300/25 text-orange-100">Cancelar</Button><Button variant="outline" onClick={checkDevices} className="border-orange-300/30 text-orange-100">Testar dispositivos</Button><Button onClick={() => { stopPreview(); onOpenChange(false); onJoin({ audioInputId: audioInputId || undefined, videoInputId: videoInputId || undefined }); }} className="bg-orange-500 text-black hover:bg-orange-400">Entrar na sala</Button></div></div></DialogContent></Dialog>;
}
