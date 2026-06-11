/**
 * Edge agent stub (Phase 0). Built out in Phase 4 (Docs/PLAN.md §8):
 *  - read scale weights over serial/TCP (browsers cannot reach COM ports)
 *  - render + print ZPL to Zebra printers
 *  - register with the cloud API using a device key, then poll/receive jobs
 */
import { readScaleWeight } from "./scale";
import { printZpl } from "./printer";

const config = {
  cloudApiUrl: process.env.CLOUD_API_URL ?? "http://localhost:7071/api",
  deviceId: process.env.DEVICE_ID ?? "dev-station-01",
  deviceKey: process.env.DEVICE_KEY ?? "",
  heartbeatSeconds: Number(process.env.HEARTBEAT_SECONDS ?? 30),
};

async function main(): Promise<void> {
  console.log(`[edge-agent] starting — device ${config.deviceId}, api ${config.cloudApiUrl}`);
  if (!config.deviceKey) {
    console.warn("[edge-agent] DEVICE_KEY not set — running in disconnected stub mode");
  }

  // Stub demonstration: simulated scale read + label render.
  const weight = await readScaleWeight();
  console.log(`[edge-agent] simulated scale read: ${weight.gross} ${weight.uom} gross`);
  printZpl("^XA^FO50,50^ADN,36,20^FDStub label^FS^XZ");

  setInterval(() => {
    console.log(`[edge-agent] heartbeat ${new Date().toISOString()}`);
  }, config.heartbeatSeconds * 1000);
}

void main();
