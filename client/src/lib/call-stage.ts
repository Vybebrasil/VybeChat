export type CallStageTile = {
  id: string;
  sharingScreen?: boolean;
};

export function getStageTile<T extends CallStageTile>(tiles: T[], pinnedId: string | null): T | null {
  return tiles.find(tile => tile.id === pinnedId) ?? tiles.find(tile => tile.sharingScreen) ?? tiles[0] ?? null;
}

export function getThumbnailTiles<T extends CallStageTile>(tiles: T[], selectedId: string | null): T[] {
  return tiles.filter(tile => tile.id !== selectedId);
}
