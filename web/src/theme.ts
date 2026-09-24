/**
 * Bluestem Fresh Produce demo branding (Docs/DECISIONS.md 0.20). Bluestem is a
 * fictional company; its palette is borrowed from rsmus.com so the app reads
 * as RSM-built (see ../../Blustem-company-details/BRAND_GUIDE.md). Fluent brand
 * ramp is built around RSM Blue #009CDE (step 80 = primary buttons / links /
 * active nav); Midnight #00153D is the header bar and headings. Chart series
 * colors live in components/PeriodCharts.
 */
import { BrandVariants, createLightTheme, Theme } from "@fluentui/react-components";

export const BLUESTEM = {
  blue: "#009cde", // RSM Blue — primary actions, links, active nav, chart series 1
  midnight: "#00153d", // Midnight — header bar, headings, dark surfaces
  green: "#3f9c35", // RSM Green — success / positive, chart series 2
  midGrey: "#888b8d", // secondary text, axis labels
  lightSky: "#e5f5fc", // selected rows, info banners (RSM Blue at 10%)
  fog: "#f2f3f4", // page background alt, table stripes
  amber: "#f2a900", // warning / watch
  red: "#d0342c", // errors, negative margin
  /** Secondary text on Midnight surfaces. */
  onMidnightMuted: "#c9d1db",
} as const;

/** Heading stack per the brand guide: Poppins SemiBold; body stays Segoe UI. */
export const HEADING_FONT = "'Poppins', 'Segoe UI', system-ui, sans-serif";

const bluestemRamp: BrandVariants = {
  10: "#001a29",
  20: "#002a42",
  30: "#003a5b",
  40: "#004b75",
  50: "#005c8f",
  60: "#006ea9",
  70: "#0083c2",
  80: "#009cde",
  90: "#1ea7e2",
  100: "#3fb3e6",
  110: "#5fbfea",
  120: "#7ecaee",
  130: "#9cd6f2",
  140: "#b9e1f6",
  150: "#d4ecfa",
  160: "#e5f5fc",
};

export const bluestemTheme: Theme = createLightTheme(bluestemRamp);
