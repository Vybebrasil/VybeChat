import { describe, expect, it } from "vitest";
import { getScreenConstraints, resolveStageFocus, SCREEN_QUALITY_HINT, SCREEN_QUALITY_LABEL } from "./screen-share";

describe("qualidade do compartilhamento", () => {
  it("fluida prioriza quadros, para vídeo não travar", () => {
    const { video } = getScreenConstraints("fluida") as { video: MediaTrackConstraints };
    expect((video.frameRate as { ideal: number }).ideal).toBe(60);
    expect((video.height as { ideal: number }).ideal).toBe(720);
  });

  it("nítida prioriza definição, para texto e arte", () => {
    const { video } = getScreenConstraints("nitida") as { video: MediaTrackConstraints };
    expect((video.height as { ideal: number }).ideal).toBe(1080);
    expect((video.frameRate as { max: number }).max).toBeLessThanOrEqual(30);
  });

  it("as duas levam o áudio da aba junto", () => {
    // Sem isso um vídeo compartilhado chega mudo do outro lado.
    expect(getScreenConstraints("nitida").audio).toBe(true);
    expect(getScreenConstraints("fluida").audio).toBe(true);
  });

  it("toda qualidade tem nome e explicação", () => {
    for (const q of ["nitida", "fluida"] as const) {
      expect(SCREEN_QUALITY_LABEL[q].length).toBeGreaterThan(3);
      expect(SCREEN_QUALITY_HINT[q].length).toBeGreaterThan(20);
    }
  });
});

describe("quem ocupa o centro do palco", () => {
  it("quem compartilha vai para o centro sozinho", () => {
    // Antes a tela ficava numa miniatura até alguém clicar em "Fixar".
    expect(resolveStageFocus({ pinnedId: null, sharingId: "vinicius" })).toBe("vinicius");
  });

  it("fixar na mão vence o compartilhamento", () => {
    expect(resolveStageFocus({ pinnedId: "jady", sharingId: "vinicius" })).toBe("jady");
  });

  it("sem ninguém compartilhando nem fixado, o palco decide sozinho", () => {
    expect(resolveStageFocus({ pinnedId: null, sharingId: null })).toBeNull();
  });

  it("parar de compartilhar devolve o palco", () => {
    const durante = resolveStageFocus({ pinnedId: null, sharingId: "vinicius" });
    const depois = resolveStageFocus({ pinnedId: null, sharingId: null });
    expect(durante).toBe("vinicius");
    expect(depois).toBeNull();
  });
});
