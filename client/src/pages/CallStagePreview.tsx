import React, { useState } from "react";
import { CallStage } from "@/components/CallStage";

export default function CallStagePreview() {
  const [microphoneOn, setMicrophoneOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [sharingScreen, setSharingScreen] = useState(true);
  return <CallStage
    roomName="sala-geral"
    participants={[
      { id: "paulo", stream: null, label: "Paulo", isLocal: true, cameraOn, microphoneOn, sharingScreen, accent: true },
      { id: "vinicius", stream: null, label: "Vinícius", microphoneOn: true, speaking: true },
      { id: "beatriz", stream: null, label: "Beatriz", microphoneOn: false },
    ]}
    microphoneOn={microphoneOn}
    cameraOn={cameraOn}
    sharingScreen={sharingScreen}
    onToggleMic={() => setMicrophoneOn(current => !current)}
    onToggleCamera={() => setCameraOn(current => !current)}
    onShareScreen={() => setSharingScreen(current => !current)}
    onLeave={() => undefined}
    onMinimize={() => undefined}
  />;
}
