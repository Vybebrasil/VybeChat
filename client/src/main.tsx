import { isCloudflareRuntime } from "./lib/runtime-mode";

const root = document.getElementById("root");
const isCloudflarePages = isCloudflareRuntime(
  import.meta.env.VITE_DEPLOY_TARGET,
  window.location.pathname,
  window.location.hostname,
);

const showPublicStartupError = () => {
  document.getElementById("safari-fallback")?.remove();
  if (!root) return;
  root.innerHTML = `
    <main class="public-shell-error" role="alert">
      <section>
        <p class="eyebrow">VYBECHAT</p>
        <h1>Não foi possível iniciar o painel.</h1>
        <p>Atualize a página. Se o problema continuar, avise a equipe com este horário.</p>
        <button type="button" onclick="window.location.reload()">Atualizar página</button>
      </section>
    </main>`;
};

if (isCloudflarePages) {
  void import("./cloudflare-main").catch(showPublicStartupError);
} else {
  void import("./internal-main");
}
