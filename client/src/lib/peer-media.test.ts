import { describe, expect, it, vi } from "vitest";
import { attachLocalMedia } from "./peer-media";

type FakeTrack = { kind: string; id: string };

function fakeConnection() {
  const senders: { track: FakeTrack | null }[] = [];
  const transceivers: { kind: string; direction?: string }[] = [];
  return {
    senders,
    transceivers,
    addTrack: (track: FakeTrack) => {
      const sender = { track };
      senders.push(sender);
      return sender;
    },
    getSenders: () => senders,
    addTransceiver: (kind: string, init?: { direction?: string }) => {
      transceivers.push({ kind, direction: init?.direction });
      const sender = { track: null };
      senders.push(sender);
      return { sender };
    },
  };
}

function fakeStream(kinds: string[]) {
  const tracks = kinds.map((kind, index) => ({ kind, id: `${kind}-${index}` }));
  return { getTracks: () => tracks } as unknown as MediaStream;
}

describe("linhas de mídia da conexão", () => {
  it("com câmera, reaproveita o sender do próprio track de vídeo", () => {
    const connection = fakeConnection();
    const stream = fakeStream(["audio", "video"]);
    const { video: sender } = attachLocalMedia(connection as never, stream);
    expect(sender?.track).toMatchObject({ kind: "video" });
    // Os dois tracks locais já criam vídeo e microfone; sobra só a linha
    // reservada ao som da tela compartilhada.
    expect(connection.transceivers).toEqual([{ kind: "audio", direction: "sendrecv" }]);
  });

  it("sem câmera, ainda entrega um sender de vídeo utilizável", () => {
    const connection = fakeConnection();
    const { video: sender } = attachLocalMedia(connection as never, fakeStream(["audio"]));
    // Este é o caso que quebrava: sem sender de vídeo, compartilhar tela caía
    // numa renegociação no meio da chamada e derrubava a voz.
    expect(sender).not.toBeNull();
    expect(connection.transceivers).toEqual([
      { kind: "video", direction: "sendrecv" },
      { kind: "audio", direction: "sendrecv" },
    ]);
  });

  it("em modo de escuta, cria vídeo enviável e áudio só de recepção", () => {
    const connection = fakeConnection();
    const { video: sender } = attachLocalMedia(connection as never, fakeStream([]));
    expect(sender).not.toBeNull();
    expect(connection.transceivers).toEqual([
      { kind: "video", direction: "sendrecv" },
      { kind: "audio", direction: "recvonly" },
      { kind: "audio", direction: "sendrecv" },
    ]);
  });

  it("sem stream nenhum não quebra e ainda prepara as duas linhas", () => {
    const connection = fakeConnection();
    expect(attachLocalMedia(connection as never, null).video).not.toBeNull();
    expect(connection.transceivers.map(item => item.kind)).toEqual(["video", "audio", "audio"]);
  });

  it("com microfone presente não cria linha de recepção sobrando", () => {
    const connection = fakeConnection();
    attachLocalMedia(connection as never, fakeStream(["audio"]));
    expect(connection.transceivers.some(item => item.direction === "recvonly")).toBe(false);
  });

  it("reserva uma linha própria para o som da tela compartilhada", () => {
    const connection = fakeConnection();
    // Sem ela o áudio da aba era capturado e descartado, e quem compartilhava um
    // vídeo chegava mudo do outro lado.
    const { screenAudio } = attachLocalMedia(connection as never, fakeStream(["audio", "video"]));
    expect(screenAudio).not.toBeNull();
    expect(screenAudio?.track).toBeNull();
  });

  it("o sender de vídeo continua servindo depois de um replaceTrack(null)", () => {
    const connection = fakeConnection();
    const { video: sender } = attachLocalMedia(connection as never, fakeStream(["audio"]));
    // Parar de compartilhar zera o track. Antes disso o sender sumia da busca
    // por `track?.kind` e o próximo compartilhamento renegociava de novo.
    (sender as { track: FakeTrack | null }).track = null;
    const guardado = new Map([["par-1", sender]]);
    expect(guardado.get("par-1")).toBe(sender);
  });

  it("adiciona ao peer todos os tracks locais", () => {
    const connection = fakeConnection();
    const addTrack = vi.spyOn(connection, "addTrack");
    attachLocalMedia(connection as never, fakeStream(["audio", "video"]));
    expect(addTrack).toHaveBeenCalledTimes(2);
  });
});
