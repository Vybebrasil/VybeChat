export function normalizeLabel(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeChannelName(value: string) {
  return normalizeLabel(value)
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export function isPresenceStatus(value: unknown): value is "online" | "away" | "offline" {
  return value === "online" || value === "away" || value === "offline";
}
