import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./command-deck.css";
import { isCloudflareRuntime } from "./lib/runtime-mode";

document.getElementById("safari-fallback")?.remove();

const root = createRoot(document.getElementById("root")!);

if (isCloudflareRuntime(import.meta.env.VITE_DEPLOY_TARGET, window.location.pathname, window.location.hostname)) {
  root.render(<App />);
} else {
void Promise.all([
  import("@tanstack/react-query"),
  import("@trpc/client"),
  import("./lib/trpc"),
  import("./const"),
  import("@shared/const"),
  import("superjson"),
]).then(([queryModule, trpcModule, trpcBinding, constModule, sharedConst, superjsonModule]) => {
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
  root.render(<trpcBinding.trpc.Provider client={trpcClient} queryClient={queryClient}><queryModule.QueryClientProvider client={queryClient}><App /></queryModule.QueryClientProvider></trpcBinding.trpc.Provider>);
}).catch(error => {
  document.body.innerHTML = `<main style="min-height:100vh;display:grid;place-items:center;background:#08090d;color:#ff9f1c;font:600 16px system-ui;padding:24px"><section><b>VybeChat</b><p>Não foi possível iniciar esta interface.</p><button onclick="location.reload()">Tentar novamente</button></section></main>`;
  console.error(error);
});
}
