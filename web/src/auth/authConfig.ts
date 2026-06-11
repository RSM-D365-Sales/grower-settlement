import type { Configuration } from "@azure/msal-browser";

export type AuthMode = "mock" | "entra";

export const authMode: AuthMode = import.meta.env.VITE_AUTH_MODE === "mock" ? "mock" : "entra";

export const apiBaseUrl: string = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:7071/api";

/** Scope exposed by the API app registration (api://<api-client-id>/access_as_user). */
export const apiScope: string | undefined = import.meta.env.VITE_API_SCOPE || undefined;

export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_ENTRA_CLIENT_ID ?? "",
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_ENTRA_TENANT_ID ?? "common"}`,
    // GitHub Pages serves under /<repo>/ — BASE_URL tracks Vite's `base`.
    redirectUri: window.location.origin + import.meta.env.BASE_URL,
    postLogoutRedirectUri: window.location.origin + import.meta.env.BASE_URL,
  },
  cache: {
    cacheLocation: "sessionStorage",
  },
};
