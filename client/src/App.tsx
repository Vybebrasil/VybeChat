import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import { lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import CloudflareHome from "./pages/CloudflareHome";

const Home = lazy(() => import("./pages/Home"));
const NotFound = lazy(() => import("./pages/NotFound"));

function Router() {
  if (import.meta.env.VITE_DEPLOY_TARGET === "cloudflare" || window.location.pathname === "/cloudflare-preview") return <CloudflareHome />;
  // make sure to consider if you need authentication for certain routes
  return <Suspense fallback={<main className="grid min-h-screen place-items-center bg-[#100d16] text-sm text-violet-100">Carregando VybeChat…</main>}><Switch>
    <Route path={"/"} component={Home} />
    <Route path={"/404"} component={NotFound} />
    {/* Final fallback route */}
    <Route component={NotFound} />
  </Switch></Suspense>;
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
