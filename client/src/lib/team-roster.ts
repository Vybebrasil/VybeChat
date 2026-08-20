export type TeamMember = {
  id: string;
  name: string;
  photo: string;
};

export type RosterResult =
  | { ok: true; team: TeamMember[]; degraded: boolean }
  | { ok: false; message: string };

export const MONDAY_PREFIX = "monday-";

/** O id do perfil carrega a origem, para o Worker saber que veio do seletor. */
export function toProfileId(mondayId: string) {
  return `${MONDAY_PREFIX}${mondayId}`;
}

export function primeiroNome(nome: string) {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

export function iniciais(nome: string) {
  return nome
    .split(/\s+/)
    .map(parte => parte[0] ?? "")
    .slice(0, 2)
    .join("")
    .toLocaleUpperCase() || "V";
}

/** Busca sem acento e por qualquer parte do nome — "vini" acha "Vinícius". */
export function filtrarEquipe(equipe: TeamMember[], busca: string) {
  const termo = busca.trim().toLocaleLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (!termo) return equipe;
  return equipe.filter(pessoa =>
    pessoa.name.toLocaleLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(termo),
  );
}

export async function fetchTeamRoster(workerUrl: string, workspaceCode: string, fetchImpl = fetch): Promise<RosterResult> {
  let response: Response;
  try {
    response = await fetchImpl(new URL("/roster", workerUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceCode }),
    });
  } catch {
    return { ok: false, message: "Não foi possível falar com o VybeChat. Confira sua conexão e tente de novo." };
  }

  if (response.status === 401) {
    return { ok: false, message: "O código de acesso da equipe não foi aceito." };
  }
  if (!response.ok) {
    return { ok: false, message: "O VybeChat não respondeu agora. Tente novamente em instantes." };
  }

  try {
    const body = (await response.json()) as { team?: TeamMember[]; degraded?: boolean };
    return { ok: true, team: Array.isArray(body.team) ? body.team : [], degraded: Boolean(body.degraded) };
  } catch {
    return { ok: false, message: "O VybeChat enviou uma resposta inválida." };
  }
}
