import { describe, expect, it } from "vitest";
import { EXTERNAL_WORKSPACE, findExternalChannel } from "./external-workspace";

describe("external VybeChat workspace", () => {
  it("preserves the fixed rooms used by the internal VybeChat", () => {
    expect(EXTERNAL_WORKSPACE.flatMap(category => category.channels).map(channel => channel.name)).toEqual(expect.arrayContaining(["geral", "sala-geral", "mizinho"]));
  });

  it("retrieves a channel from its stable room identifier", () => {
    expect(findExternalChannel(5)).toMatchObject({ name: "sala-geral", type: "voice" });
    expect(findExternalChannel(999)).toBeNull();
  });
});
