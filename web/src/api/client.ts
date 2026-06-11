import { useMemo } from "react";
import { apiBaseUrl } from "../auth/authConfig";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "./ApiError";
import { staticGet } from "./staticClient";

export { ApiError };

export interface ApiClient {
  get<T>(path: string): Promise<T>;
}

/** "static" serves baked-in demo JSON (GitHub Pages, no backend);
 *  "api" (default) calls the Functions API with auth headers attached. */
const dataMode: "static" | "api" = import.meta.env.VITE_DATA_MODE === "static" ? "static" : "api";

export function useApi(): ApiClient {
  const { getAuthHeaders, user } = useAuth();

  return useMemo<ApiClient>(
    () => ({
      async get<T>(path: string): Promise<T> {
        if (dataMode === "static") {
          return staticGet<T>(path, user);
        }
        const headers = await getAuthHeaders();
        const res = await fetch(`${apiBaseUrl}${path}`, { headers });
        if (!res.ok) {
          let message = `${res.status} ${res.statusText}`;
          try {
            const body = (await res.json()) as { error?: string };
            if (body.error) message = body.error;
          } catch {
            // non-JSON error body — keep the status text
          }
          throw new ApiError(res.status, message);
        }
        return (await res.json()) as T;
      },
    }),
    [getAuthHeaders, user]
  );
}
