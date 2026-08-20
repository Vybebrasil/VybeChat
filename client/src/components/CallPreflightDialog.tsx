import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getCallConstraints, type CallDeviceSelection } from "@/lib/call-media";
import { AudioLines, CheckCircle2, Mic, Video, VideoOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type InputDevice = { deviceId: string; label: string };

type CallPreflightDialogProps = {
  open: boolean;
  roomName: string;
  onOpenChange: (open: boolean) => void;
  onJoin: (selection: CallDeviceSelection) => void;
};

export function CallPreflightDialog({ open, roomName, onOpenChange, onJoin }: CallPreflightDialogProps) {
  const [audioInputs, setAudioInputs] = useState<InputDevice[]>([]);
  const [videoInputs, setVideoInputs] = useState<InputDevice[]>([]);
  const [audioInputId, setAudioInputId] = useState("");
  const [videoInputId, setVideoInputId] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "ready" | "error">("idle");
  const [message, setMessage] = useState("Escolha seus dispositivos e teste antes de entrar.");
  const [audioLevel, setAudioLevel] = useState(0);
  const previewRef = useRef<HTMLVideoElement>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);

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
      const samples = new Uint8Array(analyser.fftSize);
      let frame = 0;
      const updateLevel = () => {
        analyser.getByteTimeDomainData(samples);
        const average = samples.reduce((sum, value) => sum + Math.abs(value - 128), 0) / samples.length;
        setAudioLevel(Math.min(100, Math.round(average * 4.5)));
        frame = requestAnimationFrame(updateLevel);
      };
      updateLevel();
      stream.getTracks().forEach(track => { track.onended = () => { cancelAnimationFrame(frame); void context.close(); }; });
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

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="vybe-preflight max-w-xl border-orange-300/25 bg-[#101116] p-0 text-orange-50" showCloseButton={false}><div className="p-5 sm:p-6"><DialogHeader><p className="cyber-label">Pré-checagem da chamada</p><DialogTitle className="text-xl text-orange-50">Entrar em {roomName}</DialogTitle><DialogDescription className="text-stone-400">Confirme seus dispositivos antes de entrar. Você poderá alterá-los durante a chamada.</DialogDescription></DialogHeader><div className="mt-5 grid gap-4 sm:grid-cols-[1.1fr_.9fr]"><div className="relative min-h-44 overflow-hidden rounded-2xl border border-orange-300/20 bg-black/40"><video ref={previewRef} autoPlay muted playsInline className="h-full w-full object-cover" />{status !== "ready" && <div className="absolute inset-0 grid place-items-center text-center"><div><VideoOff className="mx-auto size-7 text-orange-300" /><p className="mt-2 text-xs text-stone-400">Preview da câmera</p></div></div>}</div><div className="space-y-3"><label className="block text-xs text-stone-400"><span className="mb-1.5 flex items-center gap-1.5"><Mic className="size-3.5 text-orange-300" />Microfone</span><select value={audioInputId} onChange={event => setAudioInputId(event.target.value)} className="h-10 w-full rounded-xl border border-orange-300/20 bg-black/40 px-3 text-sm text-orange-50 outline-none"><option value="">Padrão do sistema</option>{audioInputs.map(input => <option key={input.deviceId} value={input.deviceId}>{input.label}</option>)}</select></label><label className="block text-xs text-stone-400"><span className="mb-1.5 flex items-center gap-1.5"><Video className="size-3.5 text-orange-300" />Câmera</span><select value={videoInputId} onChange={event => setVideoInputId(event.target.value)} className="h-10 w-full rounded-xl border border-orange-300/20 bg-black/40 px-3 text-sm text-orange-50 outline-none"><option value="">Padrão do sistema</option>{videoInputs.map(input => <option key={input.deviceId} value={input.deviceId}>{input.label}</option>)}</select></label><div className="rounded-xl border border-orange-300/15 bg-orange-400/5 p-3"><span className="flex items-center gap-1.5 text-xs font-medium text-orange-100"><AudioLines className="size-3.5 text-orange-300" />Nível do microfone</span><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/50"><div className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-orange-300 to-orange-500 transition-[width] duration-100" style={{ width: `${Math.max(4, audioLevel)}%` }} /></div></div></div></div><div className={`mt-4 flex items-start gap-2 rounded-xl border p-3 text-xs ${status === "error" ? "border-rose-400/30 bg-rose-500/10 text-rose-100" : status === "ready" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100" : "border-orange-300/15 bg-black/20 text-stone-400"}`}>{status === "ready" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <AudioLines className="mt-0.5 size-4 shrink-0" />}<span>{message}</span></div><div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" onClick={() => onOpenChange(false)} className="border-orange-300/25 text-orange-100">Cancelar</Button><Button variant="outline" onClick={checkDevices} className="border-orange-300/30 text-orange-100">Testar dispositivos</Button><Button onClick={() => { stopPreview(); onOpenChange(false); onJoin({ audioInputId: audioInputId || undefined, videoInputId: videoInputId || undefined }); }} className="bg-orange-500 text-black hover:bg-orange-400">Entrar na sala</Button></div></div></DialogContent></Dialog>;
}
