import { ReactNode, useMemo } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { AppUser, AuthContext, AuthContextValue } from "./AuthContext";
import type { Role } from "./roles";

interface MockAuthState {
  user: AppUser | null;
  signIn: (name: string, roles: Role[]) => void;
  signOut: () => void;
}

const useMockAuthStore = create<MockAuthState>()(
  persist(
    (set) => ({
      user: null,
      signIn: (name, roles) => set({ user: { id: `mock:${name}`, name, roles } }),
      signOut: () => set({ user: null }),
    }),
    { name: "grower-mock-auth", storage: createJSONStorage(() => sessionStorage) }
  )
);

/**
 * Local-dev auth: pick a name + roles on the sign-in screen; the API's mock
 * mode reads them from x-mock-* headers and still enforces roles server-side.
 */
export function MockAuthProvider({ children }: { children: ReactNode }) {
  const { user, signIn, signOut } = useMockAuthStore();

  const value = useMemo<AuthContextValue>(
    () => ({
      mode: "mock",
      user,
      signIn: (mockIdentity) => {
        if (mockIdentity) signIn(mockIdentity.name, mockIdentity.roles);
      },
      signOut,
      getAuthHeaders: async (): Promise<Record<string, string>> =>
        user
          ? { "x-mock-user": user.name, "x-mock-roles": user.roles.join(",") }
          : {},
    }),
    [user, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
