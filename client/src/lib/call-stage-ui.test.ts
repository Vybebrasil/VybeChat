import { describe, expect, it } from "vitest";
import { getNextCallStageView, togglePinnedParticipant } from "./call-stage-ui";

describe("CallStage UI interactions", () => {
  it("alterna a ação do botão entre palco e grade", () => {
    expect(getNextCallStageView("stage")).toBe("grid");
    expect(getNextCallStageView("grid")).toBe("stage");
  });

  it("fixa e desafixa um participante ao repetir a ação da interface", () => {
    expect(togglePinnedParticipant(null, "remote-1")).toBe("remote-1");
    expect(togglePinnedParticipant("remote-1", "remote-1")).toBeNull();
  });

  it("troca o participante fixado quando o usuário escolhe outra miniatura", () => {
    expect(togglePinnedParticipant("remote-1", "remote-2")).toBe("remote-2");
  });
});
