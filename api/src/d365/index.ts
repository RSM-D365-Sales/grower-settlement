import { D365Client } from "./D365Client";
import { MockD365Client } from "./mockD365Client";
import { LiveD365Client } from "./liveD365Client";

let instance: D365Client | undefined;

/** D365_MODE=mock|live (defaults to mock — fail-safe for local dev and CI). */
export function getD365Client(): D365Client {
  if (!instance) {
    instance = process.env.D365_MODE === "live" ? new LiveD365Client() : new MockD365Client();
  }
  return instance;
}

/** Test hook. */
export function resetD365Client(): void {
  instance = undefined;
}

export type { D365Client };
