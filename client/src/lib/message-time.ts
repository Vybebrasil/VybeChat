/**
 * Horário das mensagens.
 *
 * A conversa mostrava só autor e texto. Sem hora não dá para saber se algo foi
 * dito há dois minutos ou há dois dias — e numa equipe que trabalha por turnos
 * isso muda como a mensagem é lida.
 */

const HOJE = "Hoje";
const ONTEM = "Ontem";

function mesmoDia(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function formatMessageTime(iso: string, agora = new Date()) {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  const hora = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (mesmoDia(data, agora)) return hora;

  const ontem = new Date(agora);
  ontem.setDate(agora.getDate() - 1);
  if (mesmoDia(data, ontem)) return `${ONTEM} ${hora}`;

  // Fora desta semana a data importa mais que o dia da semana.
  const dias = Math.floor((agora.getTime() - data.getTime()) / 86_400_000);
  if (dias < 7 && dias > 0) return `${data.toLocaleDateString("pt-BR", { weekday: "short" })} ${hora}`;
  return `${data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${hora}`;
}

/** Rótulo do separador de dia, quando a conversa muda de data. */
export function dayLabel(iso: string, agora = new Date()) {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  if (mesmoDia(data, agora)) return HOJE;
  const ontem = new Date(agora);
  ontem.setDate(agora.getDate() - 1);
  if (mesmoDia(data, ontem)) return ONTEM;
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

/** Precisa de separador antes desta mensagem? */
export function needsDaySeparator(atual: string, anterior?: string) {
  if (!anterior) return true;
  const a = new Date(atual);
  const b = new Date(anterior);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false;
  return !mesmoDia(a, b);
}
