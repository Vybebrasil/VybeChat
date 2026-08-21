export type ExternalChannel = {
  id: number;
  name: string;
  type: "text" | "voice";
};

export type ExternalCategory = {
  name: string;
  channels: ExternalChannel[];
};

export const EXTERNAL_WORKSPACE: ExternalCategory[] = [
  { name: "OPERAÇÃO", channels: [{ id: 1, name: "geral", type: "text" }, { id: 2, name: "entregas", type: "text" }] },
  { name: "CRIAÇÃO", channels: [{ id: 3, name: "direção-de-arte", type: "text" }, { id: 4, name: "conteúdo", type: "text" }] },
  { name: "ENCONTROS", channels: [{ id: 5, name: "sala-geral", type: "voice" }, { id: 6, name: "war-room", type: "voice" }] },
  { name: "PESSOAL", channels: ["paulo", "vinícius", "ewerton", "reriston", "deivid", "beatriz", "tainara", "breno", "eduardo", "jady", "mizinho"].map((name, index) => ({ id: index + 7, name, type: "voice" })) },
];

/**
 * Estrutura em uso agora. Comeca igual ao padrao e e substituida pela que vem do
 * Worker assim que a pessoa entra — antes os canais eram fixos no codigo e mudar
 * qualquer coisa exigia publicar de novo.
 */
let workspaceAtual: ExternalCategory[] = EXTERNAL_WORKSPACE;

export function setExternalWorkspace(workspace: ExternalCategory[]) {
  workspaceAtual = workspace.length ? workspace : EXTERNAL_WORKSPACE;
}

export function getExternalWorkspace() {
  return workspaceAtual;
}

export function findExternalChannel(channelId: number) {
  return workspaceAtual.flatMap(category => category.channels).find(channel => channel.id === channelId) ?? null;
}
