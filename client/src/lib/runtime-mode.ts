export function isCloudflareRuntime(target: string | undefined, pathname: string) {
  return target === "cloudflare" || pathname === "/cloudflare-preview";
}
