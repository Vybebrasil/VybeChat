export function isCloudflareRuntime(target: string | undefined, pathname: string, hostname = "") {
  return target === "cloudflare" || pathname === "/cloudflare-preview" || hostname.endsWith(".pages.dev");
}
