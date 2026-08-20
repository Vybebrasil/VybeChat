import { Component, type ReactNode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import CloudflareHome from "./pages/CloudflareHome";
import "./index.css";
import "./command-deck.css";
import "./modern-vybe.css";
import "./apple-vybe.css";

function reportStartupFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const bootstrap = (window as Window & { __vybechatBootstrap?: { fail?: (title: string, detail: string) => void } }).__vybechatBootstrap;
  bootstrap?.fail?.("Não foi possível iniciar o painel neste navegador.", `Código: VYBE-SAFARI-REACT · ${message}`);
}

function confirmStartup() {
  const bootstrap = (window as Window & { __vybechatBootstrap?: { ready?: () => void } }).__vybechatBootstrap;
  bootstrap?.ready?.();
  window.dispatchEvent(new Event("vybechat:ready"));
}

function PublicMountProbe({ children }: { children: ReactNode }) {
  useEffect(() => {
    const timer = window.setTimeout(confirmStartup, 120);
    return () => window.clearTimeout(timer);
  }, []);

  return <>{children}</>;
}

class PublicErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    reportStartupFailure(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="public-shell-error" role="alert">
          <section>
            <p className="eyebrow">VYBECHAT</p>
            <h1>Não foi possível abrir o painel.</h1>
            <p>A interface encontrou uma falha inesperada. Atualize a página; se persistir, avise a equipe.</p>
            <button type="button" onClick={() => window.location.reload()}>Atualizar página</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("O elemento raiz do VybeChat não foi encontrado.");
}

createRoot(rootElement).render(
  <PublicErrorBoundary>
    <PublicMountProbe>
      <CloudflareHome />
    </PublicMountProbe>
  </PublicErrorBoundary>,
);
