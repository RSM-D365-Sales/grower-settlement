import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FluentProvider } from "@fluentui/react-components";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter } from "react-router-dom";
import { App } from "./App";
import { AuthProvider } from "./auth/AuthProvider";
import { bluestemTheme } from "./theme";
import "@fontsource/poppins/600.css";
import "./brand.css";

// Hash routing keeps deep links working on GitHub Pages, which has no
// server-side rewrites (Docs/PLAN.md §3 hosting note).
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FluentProvider theme={bluestemTheme}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <HashRouter>
            <App />
          </HashRouter>
        </AuthProvider>
      </QueryClientProvider>
    </FluentProvider>
  </StrictMode>
);
