import React, { useState } from "react";
import { Activity, AudioLines, ChevronRight, Hash, Radio, ShieldCheck } from "lucide-react";

type Props = {
  channelName: string;
  onlineCount: number;
  voiceCount: number;
  messageCount: number;
  activeCall: boolean;
  operators: Array<{ userId: string; name: string; status: string; role?: string }>;
};

export function CommandTelemetryRail({ channelName, onlineCount, voiceCount, messageCount, activeCall, operators }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  return <aside className={`command-telemetry-rail ${collapsed ? "is-collapsed" : ""}`} aria-label="Telemetria operacional">
    <header><span>ATIVIDADE</span><button onClick={() => setCollapsed(current => !current)} aria-label={collapsed ? "Expandir atividade" : "Recolher atividade"}><ChevronRight className="size-3" /></button><i /></header>
    {!collapsed && <>
    <section className="command-telemetry-channel"><Hash className="size-4" /><div><small>CANAL ATUAL</small><strong>#{channelName}</strong></div></section>
    <div className="command-telemetry-stats">
      <article><small>PESSOAS</small><b>{onlineCount}</b><i className="bg-emerald-400" /></article>
      <article><small>MENSAGENS</small><b>{messageCount}</b><i className="bg-orange-400" /></article>
      <article><small>EM VOZ</small><b>{voiceCount}</b><i className={activeCall ? "bg-orange-300" : "bg-stone-700"} /></article>
      <article><small>QUALIDADE</small><b>99<em>%</em></b><i className="bg-sky-400" /></article>
    </div>
    <section className="command-telemetry-signal"><div><span><Radio className="size-3.5" />PULSO DE REDE</span><strong>ESTÁVEL</strong></div><p>▁▂▄▅▃▆▂▅▇▄▃▆▂▅▃▁</p><footer><span>VYBE MESH</span><span>12 MS</span></footer></section>
    <section className="command-telemetry-protocol"><ShieldCheck className="size-4" /><div><small>PROTOCOLO ATIVO</small><strong>{activeCall ? "SINC. DE MÍDIA" : "ESCUTA PASSIVA"}</strong></div></section>
    <section className="command-operator-panel"><header><span>OPERADORES</span><b>{operators.length}</b></header>{operators.slice(0, 4).map(operator => <div key={operator.userId}><i className={operator.status === "online" ? "is-online" : ""} /><span>{operator.name}</span><em>{operator.role === "admin" ? "CTRL" : operator.status === "meeting" ? "CALL" : "ON"}</em></div>)}</section>
    <footer className="command-telemetry-footer"><Activity className="size-3.5" /><span>LINK CRIPTOGRAFADO</span><AudioLines className="ml-auto size-3.5" /></footer>
    </>}
  </aside>;
}
