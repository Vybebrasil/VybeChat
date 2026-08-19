export function getEntrypointForTarget(target: string | undefined) {
  return target === "cloudflare" ? "/src/cloudflare-main.tsx" : "/src/main.tsx";
}

export function shouldIncludeSafariFallback(target: string | undefined) {
  return target === "cloudflare";
}
