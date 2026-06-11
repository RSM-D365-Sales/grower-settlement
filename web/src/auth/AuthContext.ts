import { createContext, useContext } from "react";
import type { AuthMode } from "./authConfig";
import type { Role } from "./roles";

export interface AppUser {
  id: string;
  name: string;
  roles: Role[];
}

export interface AuthContextValue {
  mode: AuthMode;
  user: AppUser | null;
  /** Entra mode ignores the argument; mock mode requires it. */
  signIn: (mockIdentity?: { name: string; roles: Role[] }) => void;
  signOut: () => void;
  /** Headers to attach to API calls: bearer token (entra) or x-mock-* (mock). */
  getAuthHeaders: () => Promise<Record<string, string>>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
