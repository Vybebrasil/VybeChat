import { CALL_AUDIO_CONSTRAINTS } from "./call-media";

export type AudioInput = { deviceId: string; label: string };

type MediaDevicesWithEnumeration = Pick<MediaDevices, "enumerateDevices" | "getUserMedia">;

export async function listAudioInputs(mediaDevices: Pick<MediaDevices, "enumerateDevices">): Promise<AudioInput[]> {
  const devices = await mediaDevices.enumerateDevices();
  return devices
    .filter(device => device.kind === "audioinput")
    .map((device, index) => ({ deviceId: device.deviceId, label: device.label || `Microfone ${index + 1}` }));
}

export async function getSelectedAudioTrack(mediaDevices: Pick<MediaDevices, "getUserMedia">, deviceId: string) {
  const stream = await mediaDevices.getUserMedia({
    audio: { ...CALL_AUDIO_CONSTRAINTS, deviceId: { exact: deviceId } },
    video: false,
  });
  const track = stream.getAudioTracks()[0];
  if (!track) throw new Error("Nenhum track de áudio foi retornado pelo dispositivo.");
  return { stream, track };
}
