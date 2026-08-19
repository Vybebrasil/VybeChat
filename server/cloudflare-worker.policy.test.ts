import { describe, expect, it } from "vitest";
import { canInvite, canManagePermissions, canModerate, canPost, normalizePermissions } from "../cloudflare-worker/vybechat-realtime/src/policy.js";

describe("cloudflare collaboration policy", () => {
  it("restricts channel policy management to administrators", () => {
    expect(canManagePermissions("admin")).toBe(true);
    expect(canManagePermissions("moderator")).toBe(false);
    expect(canManagePermissions("member")).toBe(false);
  });

  it("permits pins to moderators and administrators but not members", () => {
    expect(canModerate("admin")).toBe(true);
    expect(canModerate("moderator")).toBe(true);
    expect(canModerate("member")).toBe(false);
  });

  it("enforces read-only and invitation policies", () => {
    const locked = normalizePermissions({ readOnly: true, invitePolicy: "admin" });
    expect(canPost("member", locked)).toBe(false);
    expect(canPost("moderator", locked)).toBe(true);
    expect(canInvite("member", locked)).toBe(false);
    expect(canInvite("admin", locked)).toBe(true);
  });
});
