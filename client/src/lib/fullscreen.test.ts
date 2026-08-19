import { describe, expect, it, vi } from "vitest";
import { isFullscreenActive, toggleFullscreen } from "./fullscreen";

describe("fullscreen controls", () => {
  it("detecta a API padrão e a variação WebKit", () => {
    expect(isFullscreenActive({ fullscreenElement: {} as Element })).toBe(true);
    expect(isFullscreenActive({ webkitFullscreenElement: {} as Element })).toBe(true);
    expect(isFullscreenActive({})).toBe(false);
  });

  it("solicita tela cheia quando o palco não está expandido", async () => {
    const requestFullscreen = vi.fn();
    await toggleFullscreen({}, { requestFullscreen });
    expect(requestFullscreen).toHaveBeenCalledOnce();
  });

  it("sai da tela cheia ativa antes de solicitar uma nova expansão", async () => {
    const exitFullscreen = vi.fn();
    const requestFullscreen = vi.fn();
    await toggleFullscreen({ fullscreenElement: {} as Element, exitFullscreen }, { requestFullscreen });
    expect(exitFullscreen).toHaveBeenCalledOnce();
    expect(requestFullscreen).not.toHaveBeenCalled();
  });
});
