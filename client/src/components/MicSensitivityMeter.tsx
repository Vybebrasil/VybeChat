import React from "react";
import { passesGate } from "@/lib/mic-preview";

type MicSensitivityMeterProps = {
  /** Nível do microfone agora, 0 a 100, na mesma escala do corte. */
  level: number;
  /** Posição do corte, 0 a 100. Zero desliga. */
  sensitivity: number;
  onSensitivityChange: (value: number) => void;
  /** Sem stream ativo a barra fica parada; o texto explica em vez de mentir. */
  live?: boolean;
  className?: string;
};

/**
 * Barra única com o corte em cima dela, no formato do Discord.
 *
 * Antes eram duas coisas separadas — um medidor numa escala e um controle em
 * outra — e não dava para saber se a sua voz passava do corte. Aqui o mesmo
 * eixo serve para os dois: o preenchimento é a sua voz, o marcador é o corte, e
 * a cor diz se está transmitindo.
 *
 * A escala é em decibéis. Em escala linear a fala normal mal saía do canto e a
 * barra parecia morta.
 */
export function MicSensitivityMeter({ level, sensitivity, onSensitivityChange, live = true, className = "" }: MicSensitivityMeterProps) {
  const transmitindo = live && passesGate(level, sensitivity);
  const desligado = sensitivity <= 0;

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-orange-100">Sensibilidade do microfone</span>
        <span className={`font-mono text-[10px] ${transmitindo ? "text-emerald-300" : "text-stone-400"}`}>
          {!live ? "sem sinal" : desligado ? "sempre aberto" : transmitindo ? "transmitindo" : "silenciado"}
        </span>
      </div>

      <div className="relative mt-2 h-6">
        <div className="absolute inset-x-0 top-1.5 h-3 overflow-hidden rounded-full bg-black/70">
          <div
            className={`h-full rounded-full transition-[width] duration-75 ${transmitindo ? "bg-gradient-to-r from-emerald-500 to-emerald-300" : "bg-stone-600/80"}`}
            style={{ width: `${Math.max(0, Math.min(100, level))}%` }}
          />
          {/* Régua discreta, como referência de quanto falta para o corte. */}
          {[25, 50, 75].map(marca => (
            <span key={marca} aria-hidden className="absolute inset-y-0 w-px bg-white/10" style={{ left: `${marca}%` }} />
          ))}
        </div>

        {!desligado && (
          <span
            aria-hidden
            className="pointer-events-none absolute -top-0.5 h-7 w-0.5 rounded bg-orange-400 shadow-[0_0_8px_rgba(255,138,0,.9)]"
            style={{ left: `${sensitivity}%` }}
          />
        )}

        <input
          aria-label="Sensibilidade do microfone"
          type="range"
          min="0"
          max="100"
          value={sensitivity}
          onChange={event => onSensitivityChange(Number(event.target.value))}
          className="absolute inset-x-0 top-0 h-6 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-orange-950 [&::-webkit-slider-thumb]:bg-orange-400 [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-orange-950 [&::-moz-range-thumb]:bg-orange-400"
        />
      </div>

      <p className="mt-1 text-[10px] leading-4 text-stone-500">
        {desligado
          ? "Tudo que o microfone captar é transmitido, inclusive som de fundo."
          : "Arraste a marca até logo abaixo do seu nível de voz: acima dela você transmite, abaixo fica em silêncio."}
      </p>
    </div>
  );
}
