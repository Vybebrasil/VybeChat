export type FullscreenDocumentLike = {
  fullscreenElement?: Element | null;
  webkitFullscreenElement?: Element | null;
  exitFullscreen?: () => Promise<void> | void;
  webkitExitFullscreen?: () => Promise<void> | void;
};

export type FullscreenElementLike = {
  requestFullscreen?: () => Promise<void> | void;
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export function isFullscreenActive(documentLike: FullscreenDocumentLike): boolean {
  return Boolean(documentLike.fullscreenElement || documentLike.webkitFullscreenElement);
}

export async function toggleFullscreen(documentLike: FullscreenDocumentLike, element: FullscreenElementLike): Promise<void> {
  if (isFullscreenActive(documentLike)) {
    await (documentLike.exitFullscreen?.() ?? documentLike.webkitExitFullscreen?.());
    return;
  }
  await (element.requestFullscreen?.() ?? element.webkitRequestFullscreen?.());
}
