export type LocalProfile = { id: string; name: string };

export function normalizeUsername(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 80);
}

export function createLocalProfile(value: string, token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`): LocalProfile | null {
  const name = normalizeUsername(value);
  if (!name) return null;
  const slug = name.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "operador";
  return { id: `${slug}-${token}`, name };
}
