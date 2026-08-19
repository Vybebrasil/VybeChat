export function normalizeExternalMessage(content: unknown): string {
  return typeof content === "string" ? content : "";
}
