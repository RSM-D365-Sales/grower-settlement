import { ReactNode, useMemo } from "react";
import { AppUser, AuthContext, AuthContextValue } from "./AuthContext";

/**
 * Demo identity, auto-signed-in: the app lands straight on the dashboard with
 * full access until Entra/D365 are wired up (then VITE_AUTH_MODE=entra brings
 * back the real sign-in). signIn/signOut are no-ops; the Layout hides the
 * sign-out button in mock mode.
 */
const DEMO_USER: AppUser = { id: "mock:demo-user", name: "Demo User", roles: ["Admin"] };

export function MockAuthProvider({ children }: { children: ReactNode }) {
  const value = useMemo<AuthContextValue>(
    () => ({
      mode: "mock",
      user: DEMO_USER,
      signIn: () => undefined,
      signOut: () => undefined,
      getAuthHeaders: async (): Promise<Record<string, string>> => ({
        "x-mock-user": DEMO_USER.name,
        "x-mock-roles": DEMO_USER.roles.join(","),
      }),
    }),
    []
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
