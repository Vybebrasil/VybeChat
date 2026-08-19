export type CallStageView = "stage" | "grid";

export function getNextCallStageView(current: CallStageView): CallStageView {
  return current === "stage" ? "grid" : "stage";
}

export function togglePinnedParticipant(currentPinnedId: string | null, participantId: string): string | null {
  return currentPinnedId === participantId ? null : participantId;
}
