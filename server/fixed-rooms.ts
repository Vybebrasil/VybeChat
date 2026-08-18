export type FixedChannel = {
  category: string;
  name: string;
  type: "text" | "voice";
  position: number;
};

export const FIXED_CATEGORIES = ["OPERAÇÃO", "CRIAÇÃO", "ENCONTROS", "PESSOAL"] as const;

export const FIXED_CHANNELS: FixedChannel[] = [
  { category: "OPERAÇÃO", name: "geral", type: "text", position: 1 },
  { category: "OPERAÇÃO", name: "entregas", type: "text", position: 2 },
  { category: "CRIAÇÃO", name: "direção-de-arte", type: "text", position: 1 },
  { category: "CRIAÇÃO", name: "conteúdo", type: "text", position: 2 },
  { category: "ENCONTROS", name: "sala-geral", type: "voice", position: 1 },
  { category: "ENCONTROS", name: "war-room", type: "voice", position: 2 },
  { category: "PESSOAL", name: "paulo", type: "voice", position: 1 },
  { category: "PESSOAL", name: "vinícius", type: "voice", position: 2 },
  { category: "PESSOAL", name: "ewerton", type: "voice", position: 3 },
  { category: "PESSOAL", name: "reriston", type: "voice", position: 4 },
  { category: "PESSOAL", name: "deivid", type: "voice", position: 5 },
  { category: "PESSOAL", name: "beatriz", type: "voice", position: 6 },
  { category: "PESSOAL", name: "tainara", type: "voice", position: 7 },
  { category: "PESSOAL", name: "breno", type: "voice", position: 8 },
  { category: "PESSOAL", name: "eduardo", type: "voice", position: 9 },
  { category: "PESSOAL", name: "jady", type: "voice", position: 10 },
  { category: "PESSOAL", name: "mizinho", type: "voice", position: 11 },
];

export function getMissingFixedChannels(existing: Array<{ category: string; name: string }>) {
  const existingKeys = new Set(existing.map(channel => `${channel.category}:${channel.name}`));
  return FIXED_CHANNELS.filter(channel => !existingKeys.has(`${channel.category}:${channel.name}`));
}
