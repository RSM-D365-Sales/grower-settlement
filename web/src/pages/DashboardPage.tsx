import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  Dropdown,
  Option,
  Text,
  Title2,
  Title3,
  Tooltip,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { ChevronLeftRegular, ChevronRightRegular, CalendarTodayRegular } from "@fluentui/react-icons";
import { useApi } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { hasAccess } from "../auth/roles";
import { useTableStyles } from "../components/tableStyles";
import {
  ChartLegend,
  DailyActivityChart,
  ItemActivityChart,
  SERIES,
} from "../components/PeriodCharts";
import type { PeriodReport, PeriodSettlementStatus } from "../api/periodReportCalc";
import { BLUESTEM } from "../theme";
import {
  FiscalPeriod,
  periodForDate,
  periodRangeLabel,
  periodsInYear,
  shiftPeriod,
  shortDate,
} from "../lib/fiscalWeek";
import { loadSavedPeriod, savePeriod } from "../lib/savedView";

const useStyles = makeStyles({
  headerRow: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "12px",
  },
  picker: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" },
  tiles: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "12px",
    marginTop: "16px",
    maxWidth: "1100px",
  },
  tile: { padding: "16px" },
  tileValue: { display: "block", marginTop: "4px", fontSize: "26px", fontWeight: 600, lineHeight: 1.2 },
  charts: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
    gap: "16px",
    marginTop: "16px",
    maxWidth: "1100px",
  },
  chartCard: { padding: "16px" },
  chartHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: "8px",
    marginBottom: "8px",
  },
  section: { marginTop: "28px", maxWidth: "1100px" },
  meterTrack: {
    display: "inline-block",
    width: "110px",
    height: "8px",
    borderRadius: "4px",
    backgroundColor: BLUESTEM.lightSky, // meter track (RSM Blue at 10%)
    verticalAlign: "middle",
    marginRight: "8px",
    overflow: "hidden",
  },
  meterFill: { display: "block", height: "100%", backgroundColor: SERIES.received },
  clickableRow: { cursor: "pointer", ":hover": { backgroundColor: tokens.colorNeutralBackground1Hover } },
  totalCell: { fontWeight: 600, borderTop: `2px solid ${tokens.colorNeutralStroke1}` },
});

const STATUS_COLOR: Record<PeriodSettlementStatus, "success" | "brand" | "informative"> = {
  Posted: "success",
  "In progress": "brand",
  Scheduled: "informative",
};

function usd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function usd0(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function qty(n: number): string {
  return Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  const styles = useStyles();
  return (
    <Card className={styles.tile}>
      <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
        {label}
      </Text>
      <Text className={styles.tileValue}>{value}</Text>
      {sub && (
        <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: 2 }}>
          {sub}
        </Text>
      )}
    </Card>
  );
}

/**
 * Grower settlement dashboard (Docs/DECISIONS.md 0.17): pick a fiscal week
 * (Sunday–Saturday), see receiving, sell-through, collections and the weekly
 * settlement run. The selected period is remembered per browser and restored
 * on the next visit. Settlement figures are Accountant/Admin only — the API
 * shapes them out for other roles; the UI check is convenience.
 */
export function DashboardPage() {
  const styles = useStyles();
  const tableStyles = useTableStyles();
  const api = useApi();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canSeeSettlements = user ? hasAccess(user.roles, ["Admin", "Accountant"]) : false;

  const [selected, setSelected] = useState<FiscalPeriod>(
    () => loadSavedPeriod() ?? periodForDate(new Date().toISOString().slice(0, 10))
  );
  const hadSavedView = useRef(loadSavedPeriod() !== null);
  const snapChecked = useRef(false);

  useEffect(() => {
    savePeriod(selected);
  }, [selected]);

  const report = useQuery({
    queryKey: ["period-report", selected.start, selected.end],
    queryFn: () =>
      api.get<PeriodReport>(`/reports/period?from=${selected.start}&to=${selected.end}`),
  });

  // Stale-data guard: with no saved view we default to today's period; if the
  // dataset ends before that week (demo rebuilt a while ago), snap once to the
  // period containing the newest data so the first paint isn't empty.
  useEffect(() => {
    const r = report.data;
    if (!r || snapChecked.current) return;
    snapChecked.current = true;
    if (!hadSavedView.current && r.receiptCount === 0 && r.asOfDate && r.asOfDate < selected.start) {
      setSelected(periodForDate(r.asOfDate));
    }
  }, [report.data, selected.start]);

  const fiscalYears = report.data
    ? [
        ...new Set([
          periodForDate(report.data.dataStartDate || selected.start).fiscalYear,
          periodForDate(report.data.asOfDate || selected.end).fiscalYear,
          selected.fiscalYear,
        ]),
      ].sort()
    : [selected.fiscalYear];

  const periods = periodsInYear(selected.fiscalYear);
  const periodLabel = (p: FiscalPeriod) => `P${p.period} · ${shortDate(p.start)} – ${shortDate(p.end)}`;
  const currentPeriod = periodForDate(
    report.data?.asOfDate ?? new Date().toISOString().slice(0, 10)
  );
  const r = report.data;
  const hasActivity = Boolean(r && (r.receiptCount > 0 || r.invoicedOrderCount > 0));

  return (
    <div>
      <div className={styles.headerRow}>
        <div>
          <Title2>Settlement dashboard</Title2>
          <Text block size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: 4 }}>
            Fiscal weeks run Sunday – Saturday · FY{selected.fiscalYear} period {selected.period} ·{" "}
            {periodRangeLabel(selected)} · your last-viewed period is restored on this device
          </Text>
        </div>
        <div className={styles.picker}>
          <Dropdown
            value={`FY${selected.fiscalYear}`}
            selectedOptions={[String(selected.fiscalYear)]}
            onOptionSelect={(_, d) => {
              if (!d.optionValue) return;
              const fy = Number(d.optionValue);
              const list = periodsInYear(fy);
              setSelected(list[Math.min(selected.period, list.length) - 1]!);
            }}
            style={{ minWidth: 110 }}
          >
            {fiscalYears.map((fy) => (
              <Option key={fy} value={String(fy)} text={`FY${fy}`}>
                FY{fy}
              </Option>
            ))}
          </Dropdown>
          <Dropdown
            value={periodLabel(selected)}
            selectedOptions={[String(selected.period)]}
            onOptionSelect={(_, d) => {
              const p = periods[Number(d.optionValue) - 1];
              if (p) setSelected(p);
            }}
            style={{ minWidth: 210 }}
          >
            {periods.map((p) => (
              <Option key={p.period} value={String(p.period)} text={periodLabel(p)}>
                {periodLabel(p)}
              </Option>
            ))}
          </Dropdown>
          <Tooltip content="Previous period" relationship="label">
            <Button
              icon={<ChevronLeftRegular />}
              onClick={() => setSelected(shiftPeriod(selected, -1))}
            />
          </Tooltip>
          <Tooltip content="Next period" relationship="label">
            <Button
              icon={<ChevronRightRegular />}
              onClick={() => setSelected(shiftPeriod(selected, 1))}
            />
          </Tooltip>
          <Button
            icon={<CalendarTodayRegular />}
            appearance="secondary"
            disabled={
              selected.fiscalYear === currentPeriod.fiscalYear &&
              selected.period === currentPeriod.period
            }
            onClick={() => setSelected(currentPeriod)}
          >
            Current period
          </Button>
        </div>
      </div>

      {report.isLoading && <Text block style={{ marginTop: 16 }}>Loading period…</Text>}
      {report.isError && (
        <Text block style={{ marginTop: 16 }}>
          API error: {(report.error as Error).message}
        </Text>
      )}

      {r && (
        <>
          <div className={styles.tiles}>
            <StatTile
              label="Product received"
              value={`${qty(r.receivedQty)} lb`}
              sub={`${r.receiptCount.toLocaleString()} receipts`}
            />
            <StatTile
              label="Product sold"
              value={`${qty(r.soldQty)} lb`}
              sub={`${r.invoicedOrderCount.toLocaleString()} invoiced sales orders`}
            />
            <StatTile
              label="Collected"
              value={usd0(r.collectedAmount)}
              sub="Invoiced sales revenue"
            />
            {canSeeSettlements && r.settlements ? (
              <StatTile
                label="Net grower payable"
                value={usd0(r.settlements.netPayable)}
                sub={`${r.settlements.count} settlements · ${r.settlements.status}`}
              />
            ) : (
              <StatTile label="Net grower payable" value="—" sub="Visible to Accountant/Admin" />
            )}
          </div>

          {!hasActivity && (
            <Text block style={{ marginTop: 20 }}>
              No receiving or sales activity in this period. The demo dataset covers{" "}
              {r.dataStartDate} through {r.asOfDate}.
            </Text>
          )}

          {hasActivity && (
            <div className={styles.charts}>
              <Card className={styles.chartCard}>
                <div className={styles.chartHead}>
                  <Title3>Daily activity</Title3>
                  <ChartLegend />
                </div>
                <DailyActivityChart days={r.byDay} />
                <details style={{ marginTop: 8 }}>
                  <summary>
                    <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                      View as table
                    </Text>
                  </summary>
                  <table className={tableStyles.table} style={{ marginTop: 4 }}>
                    <thead>
                      <tr>
                        <th className={tableStyles.cell}>Date</th>
                        <th className={`${tableStyles.cell} ${tableStyles.num}`}>Received (lb)</th>
                        <th className={`${tableStyles.cell} ${tableStyles.num}`}>Sold (lb)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.byDay.map((d) => (
                        <tr key={d.date}>
                          <td className={tableStyles.cell}>{d.date}</td>
                          <td className={`${tableStyles.cell} ${tableStyles.num}`}>
                            {d.receivedQty.toLocaleString()}
                          </td>
                          <td className={`${tableStyles.cell} ${tableStyles.num}`}>
                            {d.soldQty.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </Card>
              <Card className={styles.chartCard}>
                <div className={styles.chartHead}>
                  <Title3>Top products</Title3>
                  <ChartLegend />
                </div>
                <ItemActivityChart items={r.byItem} />
                <Text block size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: 8 }}>
                  All {r.byItem.length} products with their full figures are in the product movement
                  table below.
                </Text>
              </Card>
            </div>
          )}

          {canSeeSettlements && r.settlements && r.settlements.rows.length > 0 && (
            <div className={styles.section}>
              <Title3>
                Weekly settlement run · week ending {shortDate(selected.end)} ·{" "}
                {usd(r.settlements.netPayable)} net payable
              </Title3>
              <Text block size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: 4 }}>
                One settlement per grower with settleable activity this period. Click a row to open
                the grower statement and generate the PDF.
              </Text>
              <table className={tableStyles.table} style={{ marginTop: 8 }}>
                <thead>
                  <tr>
                    <th className={tableStyles.cell}>Settlement</th>
                    <th className={tableStyles.cell}>Grower</th>
                    <th className={tableStyles.cell}>Basis</th>
                    <th className={`${tableStyles.cell} ${tableStyles.num}`}>Docs</th>
                    <th className={`${tableStyles.cell} ${tableStyles.num}`}>Gross payable</th>
                    <th className={`${tableStyles.cell} ${tableStyles.num}`}>Commission</th>
                    <th className={`${tableStyles.cell} ${tableStyles.num}`}>Net grower return</th>
                    <th className={tableStyles.cell}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {r.settlements.rows.map((row) => (
                    <tr
                      key={row.settlementNumber}
                      className={styles.clickableRow}
                      onClick={() =>
                        navigate(
                          `/settlement/statement/${row.vendorAccount}?fy=${selected.fiscalYear}&p=${selected.period}&status=${encodeURIComponent(row.status)}`
                        )
                      }
                    >
                      <td className={tableStyles.cell}>
                        <Text className={tableStyles.link}>{row.settlementNumber}</Text>
                      </td>
                      <td className={tableStyles.cell}>{row.vendorName}</td>
                      <td className={tableStyles.cell}>
                        {row.settlementTypes.map((t) => (
                          <Badge
                            key={t}
                            appearance="tint"
                            color={t === "TradeAgreement" ? "brand" : "informative"}
                            style={{ marginRight: 4 }}
                          >
                            {t === "TradeAgreement" ? "Flat rate" : "Commission"}
                          </Badge>
                        ))}
                      </td>
                      <td className={`${tableStyles.cell} ${tableStyles.num}`}>
                        {row.eligibleDocuments}
                      </td>
                      <td className={`${tableStyles.cell} ${tableStyles.num}`}>
                        {usd(row.grossAmount)}
                      </td>
                      <td className={`${tableStyles.cell} ${tableStyles.num}`}>
                        {row.commissionAmount > 0 ? `−${usd(row.commissionAmount)}` : "—"}
                      </td>
                      <td className={`${tableStyles.cell} ${tableStyles.num}`}>
                        {usd(row.netPayable)}
                      </td>
                      <td className={tableStyles.cell}>
                        <Badge appearance="tint" color={STATUS_COLOR[row.status]}>
                          {row.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className={`${tableStyles.cell} ${styles.totalCell}`} colSpan={4}>
                      {r.settlements.count} settlements
                    </td>
                    <td className={`${tableStyles.cell} ${tableStyles.num} ${styles.totalCell}`}>
                      {usd(r.settlements.grossAmount)}
                    </td>
                    <td className={`${tableStyles.cell} ${tableStyles.num} ${styles.totalCell}`}>
                      −{usd(r.settlements.commissionAmount)}
                    </td>
                    <td className={`${tableStyles.cell} ${tableStyles.num} ${styles.totalCell}`}>
                      {usd(r.settlements.netPayable)}
                    </td>
                    <td className={`${tableStyles.cell} ${styles.totalCell}`} />
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {!canSeeSettlements && (
            <div className={styles.section}>
              <Text block size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                The weekly settlement run (per-grower payables) is visible to Accountant and Admin
                roles only.
              </Text>
            </div>
          )}

          {hasActivity && (
            <div className={styles.section}>
              <Title3>Product movement</Title3>
              <Text block size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: 4 }}>
                Product received this period against sales invoiced in the same period, matched by
                item.
              </Text>
              <table className={tableStyles.table} style={{ marginTop: 8 }}>
                <thead>
                  <tr>
                    <th className={tableStyles.cell}>Item</th>
                    <th className={`${tableStyles.cell} ${tableStyles.num}`}>Received</th>
                    <th className={`${tableStyles.cell} ${tableStyles.num}`}>Sold</th>
                    <th className={tableStyles.cell}>Sell-through</th>
                    <th className={`${tableStyles.cell} ${tableStyles.num}`}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {r.byItem.map((item) => (
                    <tr key={item.itemNumber}>
                      <td className={tableStyles.cell}>{item.itemName}</td>
                      <td className={`${tableStyles.cell} ${tableStyles.num}`}>
                        {item.receivedQty.toLocaleString()} {item.uom}
                      </td>
                      <td className={`${tableStyles.cell} ${tableStyles.num}`}>
                        {item.soldQty.toLocaleString()} {item.uom}
                      </td>
                      <td className={tableStyles.cell}>
                        {item.sellThroughPct === null ? (
                          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                            not received this period
                          </Text>
                        ) : (
                          <>
                            <span className={styles.meterTrack}>
                              <span
                                className={styles.meterFill}
                                style={{ width: `${Math.min(100, item.sellThroughPct)}%` }}
                              />
                            </span>
                            <Text size={200}>{item.sellThroughPct.toFixed(0)}%</Text>
                          </>
                        )}
                      </td>
                      <td className={`${tableStyles.cell} ${tableStyles.num}`}>
                        {usd(item.soldRevenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className={styles.section}>
            {r.notes.map((note) => (
              <Text
                key={note}
                block
                size={200}
                style={{ color: tokens.colorNeutralForeground3, marginTop: 4, maxWidth: 880 }}
              >
                ⓘ {note}
              </Text>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
