import { createRoot } from "react-dom/client";
import React, { useEffect } from "react";
import "./index.css";
import "./command-deck.css";
import "./modern-vybe.css";
import "./apple-vybe.css";
import { isCloudflareRuntime } from "./lib/runtime-mode";

const root = createRoot(document.getElementById("root")!);
const completeBootstrap = () => document.getElementById("safari-fallback")?.remove();
function BootstrapGate({ children }: { children: React.ReactNode }) {
  useEffect(() => { completeBootstrap(); }, []);
  return <>{children}</>;
}

function PublicShellError() {
  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0a0a0b", color: "#f4f4f5", fontFamily: "Inter, system-ui, sans-serif", padding: 24 }}><section style={{ width: "min(420px, 100%)", border: "1px solid #2a2a2e", borderRadius: 24, background: "#141416", padding: 32 }}><strong style={{ display: "block", fontSize: 22 }}>VybeChat não pôde abrir agora.</strong><p style={{ color: "#a1a1aa", lineHeight: 1.6 }}>Tente atualizar a página. Se o problema continuar, a equipe já terá um diagnóstico para corrigir.</p><button type="button" onClick={() => window.location.reload()} style={{ border: 0, borderRadius: 12, background: "#ff7a1a", color: "#1a0c02", fontWeight: 800, padding: "11px 15px", cursor: "pointer" }}>Atualizar página</button></section></main>;
}

if (isCloudflareRuntime(import.meta.env.VITE_DEPLOY_TARGET, window.location.pathname, window.location.hostname)) {
  completeBootstrap();
  void import("./App").then(({ default: App }) => root.render(<App />)).catch(() => root.render(<PublicShellError />));
} else {
void Promise.all([
  import("./App"),
  import("@tanstack/react-query"),
  import("@trpc/client"),
  import("./lib/trpc"),
  import("./const"),
  import("@shared/const"),
  import("superjson"),
]).then(([appModule, queryModule, trpcModule, trpcBinding, constModule, sharedConst, superjsonModule]) => {
  const App = appModule.default;
  const queryClient = new queryModule.QueryClient();
  const redirectToLoginIfUnauthorized = (error: unknown) => {
    if (!(error instanceof trpcModule.TRPCClientError) || error.message !== sharedConst.UNAUTHED_ERR_MSG) return;
    constModule.startLogin();
  };
  queryClient.getQueryCache().subscribe(event => {
    if (event.type === "updated" && event.action.type === "error") redirectToLoginIfUnauthorized(event.query.state.error);
  });
  queryClient.getMutationCache().subscribe(event => {
    if (event.type === "updated" && event.action.type === "error") redirectToLoginIfUnauthorized(event.mutation.state.error);
  });
  const trpcClient = trpcBinding.trpc.createClient({ links: [trpcModule.httpBatchLink({ url: "/api/trpc", transformer: superjsonModule.default, fetch(input, init) { return globalThis.fetch(input, { ...(init ?? {}), credentials: "include" }); } })] });
  root.render(<BootstrapGate><trpcBinding.trpc.Provider client={trpcClient} queryClient={queryClient}><queryModule.QueryClientProvider client={queryClient}><App /></queryModule.QueryClientProvider></trpcBinding.trpc.Provider></BootstrapGate>);
}).catch(error => {
  document.body.innerHTML = `<main style="min-height:100vh;display:grid;place-items:center;background:#08090d;color:#ff9f1c;font:600 16px system-ui;padding:24px"><section><b>VybeChat</b><p>Não foi possível iniciar esta interface.</p><button onclick="location.reload()">Tentar novamente</button></section></main>`;
  console.error(error);
});
}
