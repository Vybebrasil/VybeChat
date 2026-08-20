import { Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import CloudflareHome from "./pages/CloudflareHome";
import "./index.css";
import "./command-deck.css";
import "./modern-vybe.css";
import "./apple-vybe.css";

class PublicErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
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
    <CloudflareHome />
  </PublicErrorBoundary>,
);

document.getElementById("safari-fallback")?.remove();
window.dispatchEvent(new Event("vybechat:ready"));
