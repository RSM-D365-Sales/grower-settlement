import { ReactNode } from "react";
import { authMode } from "./authConfig";
import { EntraAuthProvider } from "./EntraAuthProvider";
import { MockAuthProvider } from "./MockAuthProvider";

export function AuthProvider({ children }: { children: ReactNode }) {
  return authMode === "mock" ? (
    <MockAuthProvider>{children}</MockAuthProvider>
  ) : (
    <EntraAuthProvider>{children}</EntraAuthProvider>
  );
}
