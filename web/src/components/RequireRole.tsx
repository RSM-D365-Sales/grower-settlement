import { ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import { hasAccess, RoleRequirement } from "../auth/roles";
import { NotAuthorizedPage } from "../pages/NotAuthorizedPage";

/**
 * Route guard. Convenience only — the API independently enforces roles on
 * every request (never rely on this for security).
 */
export function RequireRole({ allowed, children }: { allowed: RoleRequirement; children: ReactNode }) {
  const { user } = useAuth();
  if (!user || !hasAccess(user.roles, allowed)) return <NotAuthorizedPage />;
  return <>{children}</>;
}
