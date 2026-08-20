import { describe, expect, it } from "vitest";
import { drainIceCandidates, queueIceCandidate, type PendingIceCandidates } from "./ice-candidates";

describe("fila de candidates ICE", () => {
  it("mantém candidates por peer até a descrição remota estar disponível", () => {
    const queue: PendingIceCandidates = new Map();
    queueIceCandidate(queue, "paulo", { candidate: "candidate-a" });
    queueIceCandidate(queue, "paulo", { candidate: "candidate-b" });
    queueIceCandidate(queue, "mari", { candidate: "candidate-c" });

    expect(drainIceCandidates(queue, "paulo")).toEqual([{ candidate: "candidate-a" }, { candidate: "candidate-b" }]);
    expect(drainIceCandidates(queue, "paulo")).toEqual([]);
    expect(drainIceCandidates(queue, "mari")).toEqual([{ candidate: "candidate-c" }]);
  });
});
