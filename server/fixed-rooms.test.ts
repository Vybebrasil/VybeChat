import { describe, expect, it } from "vitest";
import { FIXED_CHANNELS, FIXED_CATEGORIES, getMissingFixedChannels } from "./fixed-rooms";

describe("fixed Vybe voice rooms", () => {
  it("includes the shared room and every personal room in the fixed workspace", () => {
    expect(FIXED_CATEGORIES).toContain("PESSOAL");
    expect(FIXED_CHANNELS.filter(channel => channel.type === "voice").map(channel => channel.name)).toEqual(expect.arrayContaining([
      "sala-geral", "paulo", "vinícius", "ewerton", "reriston", "deivid", "beatriz", "tainara", "breno", "eduardo", "jady", "mizinho",
    ]));
  });

  it("returns only rooms that have not yet been provisioned", () => {
    const missing = getMissingFixedChannels([
      { category: "OPERAÇÃO", name: "geral" },
      { category: "ENCONTROS", name: "sala-geral" },
      { category: "PESSOAL", name: "paulo" },
    ]);

    expect(missing.map(channel => channel.name)).not.toContain("geral");
    expect(missing.map(channel => channel.name)).not.toContain("sala-geral");
    expect(missing.map(channel => channel.name)).toContain("vinícius");
  });
});
