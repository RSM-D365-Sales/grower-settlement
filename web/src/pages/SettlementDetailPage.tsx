import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink, useParams } from "react-router-dom";
import {
  Badge,
  Card,
  Tab,
  TabList,
  Text,
  Title2,
  Title3,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useApi } from "../api/client";
import { useTableStyles } from "../components/tableStyles";
import { formatMoney, growerLabel, type SettlementDoc } from "../api/settlementData";

const useStyles = makeStyles({
  tiles: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "12px",
    marginTop: "16px",
    maxWidth: "1100px",
  },
  tile: { padding: "14px 16px" },
  tileValue: { display: "block", marginTop: "4px", fontSize: "22px", fontWeight: 600, lineHeight: 1.2 },
  netTile: { borderLeft: `4px solid ${tokens.colorBrandForeground1}` },
  section: { marginTop: "24px", maxWidth: "1100px" },
  totalCell: { fontWeight: 600, borderTop: `2px solid ${tokens.colorNeutralStroke1}` },
});

const STATUS_COLOR: Record<SettlementDoc["status"], "success" | "brand" | "warning"> = {
  Settled: "success",
  "In process": "brand",
  Open: "warning",
};

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  const styles = useStyles();
  return (
    <Card className={`${styles.tile} ${accent ? styles.netTile : ""}`}>
      <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
        {label}
      </Text>
      <Text className={styles.tileValue}>{value}</Text>
    </Card>
  );
}

type TabKey = "receipts" | "sales" | "adjustments" | "advances";

/**
 * Settlement drill-in mirroring the D365 grower-accounting settlement form:
 * header + summary, one line per grower (settlement reference), and the line
 * details behind tabs — receipts, sales invoices, premiums & deductions,
 * advances. Data is the real-ID workbook register (GET /settlements/:id);
 * route-gated to Accountant/Admin like every settlement surface.
 */
export function SettlementDetailPage() {
  const styles = useStyles();
  const table = useTableStyles();
  const api = useApi();
  const { settlementId = "" } = useParams();
  const [tab, setTab] = useState<TabKey>("receipts");

  const query = useQuery({
    queryKey: ["settlement", settlementId],
    queryFn: () => api.get<SettlementDoc>(`/settlements/${encodeURIComponent(settlementId)}`),
  });

  if (query.isLoading) return <Text block>Loading settlement…</Text>;
  if (query.isError || !query.data) {
    return (
      <div>
        <RouterLink to="/settlement" className={table.link}>
          ← Back to Settlement
        </RouterLink>
        <Text block style={{ marginTop: 12 }}>
          {(query.error as Error | undefined)?.message ?? `Settlement ${settlementId} not found.`}
        </Text>
      </div>
    );
  }

  const s = query.data;
  const money = (n: number) => formatMoney(n, s.currency);
  const multiGrower = s.lines.length > 1;
  const premiums = s.adjustments.filter((a) => a.kind === "premium");
  const deductions = s.adjustments.filter((a) => a.kind === "deduction");
  const period =
    s.fromDate || s.toDate ? `${s.fromDate ?? "…"} – ${s.toDate ?? "…"}` : null;

  return (
    <div>
      <RouterLink to="/settlement" className={table.link}>
        ← Back to Settlement
      </RouterLink>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
        <Title2>
          {s.settlementId}
          {s.description !== s.settlementId ? ` · ${s.description}` : ""}
        </Title2>
        <Badge appearance="tint" color={STATUS_COLOR[s.status]}>
          {s.status}
        </Badge>
        <Badge appearance="tint" color={s.basis === "Sales invoice based" ? "informative" : "brand"}>
          {s.basis}
        </Badge>
        {s.pooled && (
          <Badge appearance="tint" color="severe">
            Pooled{s.poolId ? ` · ${s.poolId}` : ""}
          </Badge>
        )}
      </div>
      <Text block className={table.muted} style={{ marginTop: 4 }}>
        {s.growerId || s.lines.length === 1
          ? `Grower ${growerLabel(s)}`
          : `${s.lines.length} growers in pool`}
        {period ? ` · Period ${period}` : ""} · {s.currency} · Net = gross + premiums − deductions
        − commissions − advances
      </Text>

      <div className={styles.tiles}>
        <Tile label="Gross payable" value={money(s.totals.gross)} />
        <Tile label="Premiums" value={money(s.totals.premiums)} />
        <Tile label="Deductions" value={money(s.totals.deductions)} />
        <Tile label="Advances settled" value={money(s.totals.advances)} />
        <Tile label="Commissions" value={money(s.totals.commissions)} />
        <Tile label="Net grower return" value={money(s.totals.net)} accent />
      </div>

      <div className={styles.section}>
        <Title3>Grower lines</Title3>
        <table className={table.table} style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th className={table.cell}>Grower</th>
              <th className={table.cell}>Name</th>
              <th className={`${table.cell} ${table.num}`}>Gross payable</th>
              <th className={`${table.cell} ${table.num}`}>Premiums</th>
              <th className={`${table.cell} ${table.num}`}>Deductions</th>
              <th className={`${table.cell} ${table.num}`}>Advances</th>
              <th className={`${table.cell} ${table.num}`}>Commissions</th>
              <th className={`${table.cell} ${table.num}`}>Net grower return</th>
            </tr>
          </thead>
          <tbody>
            {s.lines.map((l) => (
              <tr key={l.growerId}>
                <td className={table.cell}>{l.growerId}</td>
                <td className={table.cell}>{l.growerName ?? "—"}</td>
                <td className={`${table.cell} ${table.num}`}>{money(l.gross)}</td>
                <td className={`${table.cell} ${table.num}`}>{l.premiums ? money(l.premiums) : "—"}</td>
                <td className={`${table.cell} ${table.num}`}>{l.deductions ? `−${money(l.deductions)}` : "—"}</td>
                <td className={`${table.cell} ${table.num}`}>{l.advances ? `−${money(l.advances)}` : "—"}</td>
                <td className={`${table.cell} ${table.num}`}>{l.commissions ? `−${money(l.commissions)}` : "—"}</td>
                <td className={`${table.cell} ${table.num}`}>{money(l.net)}</td>
              </tr>
            ))}
            {multiGrower && (
              <tr>
                <td className={`${table.cell} ${styles.totalCell}`} colSpan={2}>
                  Total
                </td>
                <td className={`${table.cell} ${table.num} ${styles.totalCell}`}>{money(s.totals.gross)}</td>
                <td className={`${table.cell} ${table.num} ${styles.totalCell}`}>{money(s.totals.premiums)}</td>
                <td className={`${table.cell} ${table.num} ${styles.totalCell}`}>−{money(s.totals.deductions)}</td>
                <td className={`${table.cell} ${table.num} ${styles.totalCell}`}>−{money(s.totals.advances)}</td>
                <td className={`${table.cell} ${table.num} ${styles.totalCell}`}>−{money(s.totals.commissions)}</td>
                <td className={`${table.cell} ${table.num} ${styles.totalCell}`}>{money(s.totals.net)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.section}>
        <Title3>Line details</Title3>
        <TabList
          selectedValue={tab}
          onTabSelect={(_, d) => setTab(d.value as TabKey)}
          style={{ marginTop: 4 }}
        >
          <Tab value="receipts">Receipts ({s.receipts.length})</Tab>
          <Tab value="sales">Sales invoices ({s.sales.length})</Tab>
          <Tab value="adjustments">Premiums &amp; deductions ({s.adjustments.length})</Tab>
          <Tab value="advances">Advances ({s.advances.length})</Tab>
        </TabList>

        {tab === "receipts" && (
          <ReceiptsTab s={s} money={money} multiGrower={multiGrower} />
        )}
        {tab === "sales" && <SalesTab s={s} multiGrower={multiGrower} />}
        {tab === "adjustments" && (
          <AdjustmentsTab
            s={s}
            money={money}
            multiGrower={multiGrower}
            premiums={premiums.length}
            deductions={deductions.length}
          />
        )}
        {tab === "advances" && <AdvancesTab s={s} money={money} multiGrower={multiGrower} />}
      </div>
    </div>
  );
}

function ReceiptsTab({
  s,
  money,
  multiGrower,
}: {
  s: SettlementDoc;
  money: (n: number) => string;
  multiGrower: boolean;
}) {
  const table = useTableStyles();
  const isReceiptBasis = s.basis === "Receipt based";
  if (s.receipts.length === 0) {
    return (
      <Text block className={table.muted} style={{ marginTop: 12 }}>
        No receipts on this settlement.
      </Text>
    );
  }
  return (
    <>
      <table className={table.table} style={{ marginTop: 8 }}>
        <thead>
          <tr>
            <th className={table.cell}>Receipt</th>
            <th className={table.cell}>Contract</th>
            <th className={table.cell}>Date</th>
            {multiGrower && <th className={table.cell}>Grower</th>}
            <th className={table.cell}>Item</th>
            <th className={table.cell}>Product</th>
            <th className={`${table.cell} ${table.num}`}>Receipt qty</th>
            <th className={`${table.cell} ${table.num}`}>Settlement qty</th>
            <th className={`${table.cell} ${table.num}`}>Price</th>
            {isReceiptBasis && <th className={`${table.cell} ${table.num}`}>Amount</th>}
          </tr>
        </thead>
        <tbody>
          {s.receipts.map((r) => (
            <tr key={`${r.receiptId}-${r.itemNumber}`}>
              <td className={table.cell}>{r.receiptId}</td>
              <td className={table.cell}>{r.contractId}</td>
              <td className={table.cell}>{r.receiptDate ?? "—"}</td>
              {multiGrower && <td className={table.cell}>{r.growerId}</td>}
              <td className={table.cell}>{r.itemNumber}</td>
              <td className={table.cell}>{r.itemName}</td>
              <td className={`${table.cell} ${table.num}`}>
                {r.receiptQuantity.toLocaleString()} {r.receiptUnit}
              </td>
              <td className={`${table.cell} ${table.num}`}>
                {r.settlementQuantity.toLocaleString()} {r.settlementUnit}
              </td>
              <td className={`${table.cell} ${table.num}`}>
                {r.settlementPrice.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 5,
                })}
                /{r.settlementUnit}
              </td>
              {isReceiptBasis && (
                <td className={`${table.cell} ${table.num}`}>{money(r.amount)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {!isReceiptBasis && (
        <Text block className={table.muted} style={{ marginTop: 6 }}>
          Sales-invoice based settlement — the gross payable comes from the invoiced sales below,
          not from receipt values.
        </Text>
      )}
    </>
  );
}

function SalesTab({ s, multiGrower }: { s: SettlementDoc; multiGrower: boolean }) {
  const table = useTableStyles();
  const styles = useStyles();
  if (s.sales.length === 0) {
    return (
      <Text block className={table.muted} style={{ marginTop: 12 }}>
        No sales invoices linked to this settlement — receipt-based settlement.
      </Text>
    );
  }
  const lineMoney = (n: number, currency: string) => formatMoney(n, currency);
  return (
    <table className={table.table} style={{ marginTop: 8 }}>
      <thead>
        <tr>
          <th className={table.cell}>Order</th>
          <th className={table.cell}>Invoice</th>
          <th className={table.cell}>Date</th>
          <th className={table.cell}>Customer</th>
          {multiGrower && <th className={table.cell}>Grower</th>}
          <th className={table.cell}>Product</th>
          <th className={`${table.cell} ${table.num}`}>Qty</th>
          <th className={`${table.cell} ${table.num}`}>Price</th>
          <th className={`${table.cell} ${table.num}`}>Gross</th>
          <th className={`${table.cell} ${table.num}`}>Commission</th>
          <th className={`${table.cell} ${table.num}`}>Settlement amount</th>
        </tr>
      </thead>
      <tbody>
        {s.sales.map((l) => (
          <tr key={`${l.salesInvoiceId}-${l.salesOrderId}-${l.itemNumber}`}>
            <td className={table.cell}>{l.salesOrderId}</td>
            <td className={table.cell}>{l.salesInvoiceId}</td>
            <td className={table.cell}>{l.invoiceDate ?? "—"}</td>
            <td className={table.cell}>{l.customerName}</td>
            {multiGrower && <td className={table.cell}>{l.growerId}</td>}
            <td className={table.cell}>{l.itemName}</td>
            <td className={`${table.cell} ${table.num}`}>
              {l.invoiceQuantity.toLocaleString()} {l.invoiceUnit}
            </td>
            <td className={`${table.cell} ${table.num}`}>
              {lineMoney(l.invoicePrice, l.currency)}/{l.invoiceUnit}
            </td>
            <td className={`${table.cell} ${table.num}`}>{lineMoney(l.grossAmount, l.currency)}</td>
            <td className={`${table.cell} ${table.num}`}>
              {l.commissionAmount ? `−${lineMoney(l.commissionAmount, l.currency)}` : "—"}
            </td>
            <td className={`${table.cell} ${table.num}`}>
              {lineMoney(l.settlementAmount, l.currency)}
            </td>
          </tr>
        ))}
        <tr>
          <td className={`${table.cell} ${styles.totalCell}`} colSpan={multiGrower ? 8 : 7}>
            {s.sales.length} invoice lines
          </td>
          <td className={`${table.cell} ${table.num} ${styles.totalCell}`}>
            {formatMoney(
              s.sales.reduce((t, l) => t + l.grossAmount, 0),
              s.currency
            )}
          </td>
          <td className={`${table.cell} ${table.num} ${styles.totalCell}`}>
            −
            {formatMoney(
              s.sales.reduce((t, l) => t + l.commissionAmount, 0),
              s.currency
            )}
          </td>
          <td className={`${table.cell} ${table.num} ${styles.totalCell}`}>
            {formatMoney(
              s.sales.reduce((t, l) => t + l.settlementAmount, 0),
              s.currency
            )}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function AdjustmentsTab({
  s,
  money,
  multiGrower,
  premiums,
  deductions,
}: {
  s: SettlementDoc;
  money: (n: number) => string;
  multiGrower: boolean;
  premiums: number;
  deductions: number;
}) {
  const table = useTableStyles();
  if (s.adjustments.length === 0) {
    return (
      <Text block className={table.muted} style={{ marginTop: 12 }}>
        No premiums or deductions on this settlement.
      </Text>
    );
  }
  return (
    <>
      <table className={table.table} style={{ marginTop: 8 }}>
        <thead>
          <tr>
            <th className={table.cell}>Type</th>
            <th className={table.cell}>Category</th>
            <th className={table.cell}>Code</th>
            <th className={table.cell}>Receipt</th>
            {multiGrower && <th className={table.cell}>Grower</th>}
            <th className={`${table.cell} ${table.num}`}>Amount</th>
            <th className={`${table.cell} ${table.num}`}>Impact on net</th>
          </tr>
        </thead>
        <tbody>
          {s.adjustments.map((a, i) => (
            <tr key={`${a.code}-${a.receiptId}-${i}`}>
              <td className={table.cell}>
                <Badge appearance="tint" color={a.kind === "premium" ? "success" : "danger"}>
                  {a.kind === "premium" ? "Premium" : "Deduction"}
                </Badge>
              </td>
              <td className={table.cell}>{a.label}</td>
              <td className={table.cell}>{a.code}</td>
              <td className={table.cell}>{a.receiptId || "—"}</td>
              {multiGrower && <td className={table.cell}>{a.growerId}</td>}
              <td className={`${table.cell} ${table.num}`}>{money(a.amount)}</td>
              <td className={`${table.cell} ${table.num}`}>
                {a.kind === "premium" ? `+${money(a.amount)}` : `−${money(a.amount)}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Text block className={table.muted} style={{ marginTop: 6 }}>
        {premiums} premium{premiums === 1 ? "" : "s"} totalling {money(s.totals.premiums)} ·{" "}
        {deductions} deduction{deductions === 1 ? "" : "s"} totalling {money(s.totals.deductions)}
      </Text>
    </>
  );
}

function AdvancesTab({
  s,
  money,
  multiGrower,
}: {
  s: SettlementDoc;
  money: (n: number) => string;
  multiGrower: boolean;
}) {
  const table = useTableStyles();
  if (s.advances.length === 0) {
    return (
      <Text block className={table.muted} style={{ marginTop: 12 }}>
        No advances applied to this settlement.
      </Text>
    );
  }
  return (
    <>
      <table className={table.table} style={{ marginTop: 8 }}>
        <thead>
          <tr>
            <th className={table.cell}>Advance</th>
            <th className={table.cell}>Type</th>
            <th className={table.cell}>Description</th>
            <th className={table.cell}>Payback method</th>
            <th className={table.cell}>Receipt</th>
            {multiGrower && <th className={table.cell}>Grower</th>}
            <th className={table.cell}>Recovered</th>
            <th className={`${table.cell} ${table.num}`}>Amount settled</th>
            <th className={`${table.cell} ${table.num}`}>Outstanding</th>
          </tr>
        </thead>
        <tbody>
          {s.advances.map((a) => (
            <tr key={a.advanceId}>
              <td className={table.cell}>{a.advanceId}</td>
              <td className={table.cell}>{a.advanceType}</td>
              <td className={table.cell}>{a.description}</td>
              <td className={table.cell}>{a.paybackMethod}</td>
              <td className={table.cell}>{a.receiptId || "—"}</td>
              {multiGrower && <td className={table.cell}>{a.growerId}</td>}
              <td className={table.cell}>
                <Badge appearance="tint" color={a.journalPaid ? "success" : "informative"}>
                  {a.journalPaid ? "Yes" : "Not yet paid"}
                </Badge>
              </td>
              <td className={`${table.cell} ${table.num}`}>{money(a.amountSettled)}</td>
              <td className={`${table.cell} ${table.num}`}>{money(a.outstandingAmount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Text block className={table.muted} style={{ marginTop: 6 }}>
        Advances are recovered from the grower's net return once their advance journal has been
        paid — {money(s.totals.advances)} recovered in this settlement.
      </Text>
    </>
  );
}
