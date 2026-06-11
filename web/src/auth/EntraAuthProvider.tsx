import { ReactNode, useMemo } from "react";
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider, useMsal } from "@azure/msal-react";
import { apiScope, msalConfig } from "./authConfig";
import { AppUser, AuthContext, AuthContextValue } from "./AuthContext";
import { isRole, Role } from "./roles";

const msalInstance = new PublicClientApplication(msalConfig);

function Bridge({ children }: { children: ReactNode }) {
  const { instance, accounts } = useMsal();
  const account = accounts[0] ?? null;

  const value = useMemo<AuthContextValue>(() => {
    let user: AppUser | null = null;
    if (account) {
      const claims = (account.idTokenClaims ?? {}) as { roles?: unknown; oid?: unknown };
      const roles: Role[] = Array.isArray(claims.roles)
        ? claims.roles.filter((r): r is Role => typeof r === "string" && isRole(r))
        : [];
      user = {
        id: typeof claims.oid === "string" ? claims.oid : account.homeAccountId,
        name: account.name ?? account.username,
        roles,
      };
    }
    const scopes = apiScope ? [apiScope] : [];
    return {
      mode: "entra",
      user,
      signIn: () => {
        void instance.loginRedirect({ scopes });
      },
      signOut: () => {
        void instance.logoutRedirect();
      },
      getAuthHeaders: async (): Promise<Record<string, string>> => {
        if (!account || scopes.length === 0) return {};
        try {
          const result = await instance.acquireTokenSilent({ scopes, account });
          return { authorization: `Bearer ${result.accessToken}` };
        } catch {
          await instance.acquireTokenRedirect({ scopes, account });
          return {};
        }
      },
    };
  }, [instance, account]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function EntraAuthProvider({ children }: { children: ReactNode }) {
  return (
    <MsalProvider instance={msalInstance}>
      <Bridge>{children}</Bridge>
    </MsalProvider>
  );
}
