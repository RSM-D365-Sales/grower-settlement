export interface ScaleReading {
  gross: number;
  uom: string;
  deviceId: string;
  capturedAt: string;
}

/** Phase 4 replaces this with a serial/TCP driver for the station's scale. */
export async function readScaleWeight(): Promise<ScaleReading> {
  return {
    gross: Math.round((900 + Math.random() * 300) * 100) / 100,
    uom: "lb",
    deviceId: process.env.DEVICE_ID ?? "dev-station-01",
    capturedAt: new Date().toISOString(),
  };
}
