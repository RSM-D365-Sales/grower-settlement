/**
 * Backend-free data source (VITE_DATA_MODE=static). Serves the JSON exported
 * by api/src/scripts/exportDemoData.ts from /demo/*.json and mirrors the API
 * routes' filtering. Used for the GitHub Pages demo where no Functions app is
 * deployed. The API remains the real implementation — keep filter behavior in
 * sync with api/src/functions/*.
 */
import { ApiError } from "./ApiError";
import type { AppUser } from "../auth/AuthContext";

interface Vendorish {
  vendorAccount: string;
  name: string;
}
interface Itemish {
  itemNumber: string;
  name: string;
  commodityCode: string | null;
}
interface Contractish {
  contractNumber: string;
  vendorAccount: string;
  vendorName: string;
}
interface Receiptish {
  receiptDate: string;
  vendorAccount: string;
  contractNumber: string;
}
interface SalesOrderish {
  orderDate: string;
}

const cache = new Map<string, unknown>();

async function load<T>(file: string): Promise<T> {
  if (!cache.has(file)) {
    const res = await fetch(`${import.meta.env.BASE_URL}demo/${file}`);
    if (!res.ok) throw new ApiError(res.status, `Demo data file missing: ${file}`);
    cache.set(file, await res.json());
  }
  return cache.get(file) as T;
}

/** Trailing-N-days window anchored to the newest date in the dataset, so the
 *  baked-in demo keeps working days after it was generated. */
function inWindow(dates: string[], dateStr: string, days: number): boolean {
  const newest = dates.reduce((a, b) => (a > b ? a : b), "");
  if (!newest) return true;
  const cutoff = new Date(`${newest}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - (days - 1));
  return dateStr >= cutoff.toISOString().slice(0, 10);
}

function contains(haystack: string | null | undefined, needle: string): boolean {
  return (haystack ?? "").toLowerCase().includes(needle);
}

export async function staticGet<T>(path: string, user: AppUser | null): Promise<T> {
  const [route = "", queryString = ""] = path.split("?");
  const q = new URLSearchParams(queryString);
  const search = q.get("search")?.trim().toLowerCase() ?? "";
  const days = Math.min(Math.max(Number(q.get("days") ?? 7) || 7, 1), 31);
  const vendor = q.get("vendor")?.trim() ?? "";
  const contract = q.get("contract")?.trim() ?? "";

  // Contract drill-in: /contracts/<number>
  if (route.startsWith("/contracts/")) {
    const number = decodeURIComponent(route.slice("/contracts/".length));
    const all = await load<Contractish[]>("contracts.json");
    const found = all.find((c) => c.contractNumber === number);
    if (!found) throw new ApiError(404, `Contract ${number} not found`);
    return found as T;
  }

  switch (route) {
    case "/health":
      return {
        status: "ok",
        authMode: "mock",
        d365Mode: "static",
        timestamp: new Date().toISOString(),
      } as T;

    case "/me": {
      if (!user) throw new ApiError(401, "Unauthenticated");
      return { id: user.id, name: user.name, roles: user.roles } as T;
    }

    case "/vendors": {
      const all = await load<Vendorish[]>("vendors.json");
      const value = search
        ? all.filter((v) => contains(v.vendorAccount, search) || contains(v.name, search))
        : all;
      return { value } as T;
    }

    case "/items": {
      const all = await load<Itemish[]>("items.json");
      const value = search
        ? all.filter(
            (i) =>
              contains(i.itemNumber, search) ||
              contains(i.name, search) ||
              contains(i.commodityCode, search)
          )
        : all;
      return { value } as T;
    }

    case "/commodities":
      return { value: await load("commodities.json") } as T;

    case "/units":
      return { value: await load("units.json") } as T;

    case "/contracts": {
      let value = await load<Contractish[]>("contracts.json");
      if (vendor) value = value.filter((c) => c.vendorAccount === vendor);
      if (search) {
        value = value.filter(
          (c) => contains(c.contractNumber, search) || contains(c.vendorName, search)
        );
      }
      return { value } as T;
    }

    case "/receipts": {
      const all = await load<Receiptish[]>("receipts.json");
      const dates = all.map((r) => r.receiptDate);
      let value = all.filter((r) => inWindow(dates, r.receiptDate, days));
      if (vendor) value = value.filter((r) => r.vendorAccount === vendor);
      if (contract) value = value.filter((r) => r.contractNumber === contract);
      value = [...value].sort((a, b) => b.receiptDate.localeCompare(a.receiptDate));
      return { value } as T;
    }

    case "/salesorders": {
      const all = await load<SalesOrderish[]>("salesorders.json");
      const dates = all.map((s) => s.orderDate);
      const value = all
        .filter((s) => inWindow(dates, s.orderDate, days))
        .sort((a, b) => b.orderDate.localeCompare(a.orderDate));
      return { value } as T;
    }

    case "/settlement/batches": {
      // Mirror the API's hard gate (demo only — the real check is server-side).
      const allowed = user?.roles.some((r) => r === "Accountant" || r === "Admin") ?? false;
      if (!allowed) throw new ApiError(403, "Insufficient role");
      return { value: [], note: "Settlement engine arrives in Phase 6" } as T;
    }

    default:
      throw new ApiError(404, `No static route for ${route}`);
  }
}
