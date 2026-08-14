/**
 * North Bay Produce demo branding (Docs/DECISIONS.md 0.17). Brand ramp built
 * around the palette on northbayproduce.com — deep navy #0F2436, slate blue
 * #425B76, coral accent #EF6B51 — snapped to a chromatic blue so interactive
 * elements stay legible. Chart series colors live in components/PeriodCharts.
 */
import { BrandVariants, createLightTheme, Theme } from "@fluentui/react-components";

export const NORTH_BAY = {
  navy: "#0f2436",
  slate: "#425b76",
  coral: "#ef6b51",
  offWhite: "#f8fafc",
} as const;

const northBayRamp: BrandVariants = {
  10: "#061019",
  20: "#0a1a29",
  30: "#0f2436",
  40: "#142e45",
  50: "#193954",
  60: "#1f4363",
  70: "#254e72",
  80: "#2c5881",
  90: "#33628f",
  100: "#3a6ea5",
  110: "#4a7cb1",
  120: "#6291bf",
  130: "#82a9cd",
  140: "#a3c0db",
  150: "#c3d6e9",
  160: "#e2ebf4",
};

export const northBayTheme: Theme = createLightTheme(northBayRamp);
