import { describe, expect, it } from "vitest";
import { getStageTile, getThumbnailTiles } from "./call-stage";

const tiles = [
  { id: "local" },
  { id: "screen", sharingScreen: true },
  { id: "remote" },
];

describe("call stage layout", () => {
  it("prioriza uma tela compartilhada quando ninguém está fixado", () => {
    expect(getStageTile(tiles, null)?.id).toBe("screen");
  });

  it("mantém o participante escolhido pelo usuário como palco principal", () => {
    expect(getStageTile(tiles, "remote")?.id).toBe("remote");
  });

  it("remove o palco principal da faixa de miniaturas", () => {
    expect(getThumbnailTiles(tiles, "screen").map(tile => tile.id)).toEqual(["local", "remote"]);
  });
});
