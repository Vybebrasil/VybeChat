import { Component, type ReactNode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import CloudflareHome from "./pages/CloudflareHome";
import "./index.css";

class CloudflareBootBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <main className="grid min-h-screen place-items-center p-6 text-center"><section className="cyber-panel cyber-corner max-w-md p-8"><p className="cyber-label">VybeChat / recuperação</p><h1 className="mt-3 [font-family:Orbitron] text-xl font-bold text-orange-100">NÚCLEO EM REINICIALIZAÇÃO</h1><p className="mt-3 text-sm text-stone-400">A interface encontrou uma interrupção local. Atualize para restabelecer a conexão.</p><button onClick={() => window.location.reload()} className="mt-6 border border-orange-300/40 bg-orange-500 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wide text-black">Recarregar sistema</button></section></main>;
    }
    return this.props.children;
  }
}

function CloudflareShell() {
  useEffect(() => {
    document.getElementById("safari-fallback")?.remove();
  }, []);

  return <CloudflareBootBoundary><CloudflareHome /></CloudflareBootBoundary>;
}

try {
  const mount = document.getElementById("root");
  if (!mount) throw new Error("Root element not found");
  createRoot(mount).render(<CloudflareShell />);
} catch (error) {
  console.error("VybeChat bootstrap failed", error);
}
