/**
 * Inline-SVG charts for the settlement dashboard. Two series only —
 * Received (North Bay slate blue) and Sold (North Bay coral) — validated as a
 * categorical pair (CVD ΔE 17.1, normal 30.1, both ≥3:1 on white). Marks wear
 * the series colors; all text wears neutral text tokens. Full values live in
 * the product movement table below the charts (the table view).
 */
import { ReactNode, useState } from "react";
import { Text, tokens } from "@fluentui/react-components";
import type { PeriodDayActivity, PeriodItemActivity } from "../api/periodReportCalc";

export const SERIES = {
  received: "#3a6ea5", // brand slate blue, chroma-snapped to pass the palette gates
  sold: "#ef6b51", // brand coral accent
} as const;

const GRID = "#e1e0d9";
const BASELINE = "#c3c2b7";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function compact(n: number): string {
  return Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

function full(n: number): string {
  return n.toLocaleString("en-US");
}

/** ~4 clean ticks: 0..niceMax with a 1/2/2.5/5×10^k step. */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? rough;
  const ticks: number[] = [];
  for (let t = 0; t < max + step; t += step) ticks.push(Math.round(t * 100) / 100);
  return ticks;
}

/** Column with a 4px-rounded data-end and a square baseline. */
function column(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, h, w / 2);
  return `M ${x} ${y + h} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} L ${x + w - r} ${y} Q ${x + w} ${y} ${x + w} ${y + r} L ${x + w} ${y + h} Z`;
}

/** Horizontal bar with a 4px-rounded data-end and a square baseline. */
function bar(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w, h / 2);
  return `M ${x} ${y} L ${x + w - r} ${y} Q ${x + w} ${y} ${x + w} ${y + r} L ${x + w} ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} L ${x} ${y + h} Z`;
}

export function ChartLegend() {
  const swatch = (color: string): ReactNode => (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: 2,
        backgroundColor: color,
        marginRight: 6,
      }}
    />
  );
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>
        {swatch(SERIES.received)}Received
      </Text>
      <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>
        {swatch(SERIES.sold)}Sold (invoiced)
      </Text>
    </div>
  );
}

interface TooltipState {
  x: number;
  y: number;
  lines: string[];
}

function Tooltip({ tip }: { tip: TooltipState | null }) {
  if (!tip) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: tip.x,
        top: tip.y,
        transform: "translate(-50%, -100%)",
        backgroundColor: tokens.colorNeutralBackground1,
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        borderRadius: 4,
        boxShadow: tokens.shadow8,
        padding: "6px 10px",
        pointerEvents: "none",
        whiteSpace: "nowrap",
        zIndex: 10,
      }}
    >
      {tip.lines.map((line, i) => (
        <Text key={i} block size={200} weight={i === 0 ? "semibold" : "regular"}>
          {line}
        </Text>
      ))}
    </div>
  );
}

/** Grouped columns: received vs sold per day, Sunday through Saturday. */
export function DailyActivityChart({ days }: { days: PeriodDayActivity[] }) {
  const [tip, setTip] = useState<TooltipState | null>(null);

  const width = 640;
  const height = 240;
  const pad = { top: 12, right: 12, bottom: 28, left: 48 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const max = Math.max(1, ...days.map((d) => Math.max(d.receivedQty, d.soldQty)));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] ?? 1;
  const yFor = (v: number): number => pad.top + plotH * (1 - v / top);

  const slot = plotW / days.length;
  const barW = Math.min(24, (slot - 16) / 2);

  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", maxWidth: 720, display: "block" }}
        role="img"
        aria-label="Quantity received and sold by day"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={yFor(t)}
              y2={yFor(t)}
              stroke={t === 0 ? BASELINE : GRID}
              strokeWidth={1}
            />
            <text
              x={pad.left - 6}
              y={yFor(t) + 3.5}
              textAnchor="end"
              fontSize={11}
              fill={tokens.colorNeutralForeground3}
            >
              {compact(t)}
            </text>
          </g>
        ))}
        {days.map((d, i) => {
          const cx = pad.left + slot * i + slot / 2;
          // 2px surface gap between the paired bars.
          const rx = cx - barW - 1;
          const sx = cx + 1;
          const rh = (d.receivedQty / top) * plotH;
          const sh = (d.soldQty / top) * plotH;
          const weekday = WEEKDAYS[new Date(`${d.date}T00:00:00Z`).getUTCDay()];
          return (
            <g key={d.date}>
              {d.receivedQty > 0 && (
                <path d={column(rx, yFor(d.receivedQty), barW, rh)} fill={SERIES.received} />
              )}
              {d.soldQty > 0 && (
                <path d={column(sx, yFor(d.soldQty), barW, sh)} fill={SERIES.sold} />
              )}
              <text
                x={cx}
                y={height - 10}
                textAnchor="middle"
                fontSize={11}
                fill={tokens.colorNeutralForeground3}
              >
                {weekday} {Number(d.date.slice(8, 10))}
              </text>
              <rect
                x={pad.left + slot * i}
                y={pad.top}
                width={slot}
                height={plotH}
                fill="transparent"
                onMouseEnter={(e) => {
                  const box = e.currentTarget.closest("div")!.getBoundingClientRect();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTip({
                    x: rect.left - box.left + rect.width / 2,
                    y: rect.top - box.top,
                    lines: [
                      `${weekday} ${d.date}`,
                      `Received: ${full(d.receivedQty)} lb`,
                      `Sold: ${full(d.soldQty)} lb`,
                    ],
                  });
                }}
                onMouseLeave={() => setTip(null)}
              />
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

/** Horizontal paired bars: top items by quantity received, with sold overlay. */
export function ItemActivityChart({ items, maxRows = 8 }: { items: PeriodItemActivity[]; maxRows?: number }) {
  const [tip, setTip] = useState<TooltipState | null>(null);

  const shown = items.filter((i) => i.receivedQty > 0 || i.soldQty > 0).slice(0, maxRows);
  if (shown.length === 0) return null;

  const width = 640;
  const rowH = 44;
  const pad = { top: 4, right: 56, bottom: 4, left: 170 };
  const height = pad.top + pad.bottom + rowH * shown.length;
  const plotW = width - pad.left - pad.right;
  const max = Math.max(1, ...shown.map((i) => Math.max(i.receivedQty, i.soldQty)));
  const wFor = (v: number): number => (v / max) * plotW;

  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", maxWidth: 720, display: "block" }}
        role="img"
        aria-label="Quantity received and sold by product"
      >
        <line
          x1={pad.left}
          x2={pad.left}
          y1={pad.top}
          y2={height - pad.bottom}
          stroke={BASELINE}
          strokeWidth={1}
        />
        {shown.map((item, i) => {
          const y = pad.top + rowH * i;
          const rw = wFor(item.receivedQty);
          const sw = wFor(item.soldQty);
          return (
            <g key={item.itemNumber}>
              <text
                x={pad.left - 8}
                y={y + rowH / 2 + 3.5}
                textAnchor="end"
                fontSize={12}
                fill={tokens.colorNeutralForeground1}
              >
                {item.itemName.length > 24 ? `${item.itemName.slice(0, 23)}…` : item.itemName}
              </text>
              {/* 2px surface gap between the paired bars */}
              {item.receivedQty > 0 && (
                <path d={bar(pad.left, y + rowH / 2 - 15, rw, 14)} fill={SERIES.received} />
              )}
              {item.soldQty > 0 && (
                <path d={bar(pad.left, y + rowH / 2 + 1, sw, 14)} fill={SERIES.sold} />
              )}
              {/* direct label on the story series (received) only; sold lives in tooltip + table */}
              {item.receivedQty > 0 && (
                <text
                  x={pad.left + rw + 6}
                  y={y + rowH / 2 - 4}
                  fontSize={11}
                  fill={tokens.colorNeutralForeground3}
                >
                  {compact(item.receivedQty)}
                </text>
              )}
              <rect
                x={0}
                y={y}
                width={width}
                height={rowH}
                fill="transparent"
                onMouseEnter={(e) => {
                  const box = e.currentTarget.closest("div")!.getBoundingClientRect();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTip({
                    x: rect.left - box.left + rect.width / 2,
                    y: rect.top - box.top + 6,
                    lines: [
                      item.itemName,
                      `Received: ${full(item.receivedQty)} ${item.uom}`,
                      `Sold: ${full(item.soldQty)} ${item.uom}`,
                      ...(item.sellThroughPct !== null
                        ? [`Sell-through: ${item.sellThroughPct.toFixed(0)}%`]
                        : []),
                      `Revenue: $${full(Math.round(item.soldRevenue))}`,
                    ],
                  });
                }}
                onMouseLeave={() => setTip(null)}
              />
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}
