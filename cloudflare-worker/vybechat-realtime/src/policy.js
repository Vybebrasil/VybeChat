export const DEFAULT_PERMISSIONS = Object.freeze({ readOnly: false, invitePolicy: "member" });

export function normalizeRole(value) {
  return ["admin", "moderator", "member"].includes(value) ? value : "member";
}

export function normalizePermissions(value = {}) {
  return {
    readOnly: Boolean(value.readOnly),
    invitePolicy: value.invitePolicy === "admin" ? "admin" : "member",
  };
}

export function canModerate(role) {
  return ["admin", "moderator"].includes(normalizeRole(role));
}

export function canManagePermissions(role) {
  return normalizeRole(role) === "admin";
}

export function canPost(role, permissions) {
  return !normalizePermissions(permissions).readOnly || canModerate(role);
}

export function canInvite(role, permissions) {
  return normalizePermissions(permissions).invitePolicy !== "admin" || normalizeRole(role) === "admin";
}
