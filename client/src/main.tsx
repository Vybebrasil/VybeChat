import { isCloudflareRuntime } from "./lib/runtime-mode";

const root = document.getElementById("root");
const isCloudflarePages = isCloudflareRuntime(
  import.meta.env.VITE_DEPLOY_TARGET,
  window.location.pathname,
  window.location.hostname,
);

const showPublicStartupError = () => {
  const bootstrap = (window as Window & { __vybechatBootstrap?: { fail?: (title: string, detail: string) => void } }).__vybechatBootstrap;
  bootstrap?.fail?.("Não foi possível carregar o painel público.", "Código: VYBE-SAFARI-MODULE · O módulo inicial não foi avaliado.");
  if (root) root.setAttribute("data-vybechat-startup", "failed");
};

if (isCloudflarePages) {
  void import("./cloudflare-main").catch(showPublicStartupError);
} else {
  void import("./internal-main");
}
