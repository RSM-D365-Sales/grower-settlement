import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  Spinner,
  Text,
  Title2,
  Title3,
  Toast,
  ToastBody,
  Toaster,
  ToastTitle,
  makeStyles,
  tokens,
  useId,
  useToastController,
} from "@fluentui/react-components";
import { ArrowLeftRegular, ArrowDownloadRegular, MailRegular } from "@fluentui/react-icons";
import { useApi } from "../api/client";
import { useTableStyles } from "../components/tableStyles";
import type { PreviewSection, SettlementPreview } from "../api/settlementPreviewCalc";
import { FiscalPeriod, periodForDate, periodRangeLabel, periodsInYear } from "../lib/fiscalWeek";
import { buildStatementPdf, downloadBlob, type StatementVendor } from "../lib/settlementPdf";

const useStyles = makeStyles({
  meta: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
    marginTop: "16px",
    maxWidth: "980px",
  },
  metaCard: { padding: "16px" },
  actions: { display: "flex", gap: "8px", marginTop: "16px", flexWrap: "wrap" },
  summaryRow: { display: "flex", justifyContent: "space-between", marginTop: "4px" },
  netBand: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#0f2436", // North Bay navy
    color: "#ffffff",
    padding: "10px 14px",
    borderRadius: tokens.borderRadiusMedium,
    marginTop: "10px",
  },
});

interface VendorsResponse {
  value: (StatementVendor & { name: string })[];
}

function usd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function resolvePeriod(fyRaw: string | null, pRaw: string | null): FiscalPeriod {
  const fy = Number(fyRaw);
  const p = Number(pRaw);
  if (Number.isInteger(fy) && Number.isInteger(p)) {
    const found = periodsInYear(fy)[p - 1];
    if (found) return found;
  }
  return periodForDate(new Date().toISOString().slice(0, 10));
}

/**
 * Grower settlement statement for one fiscal week (Docs/DECISIONS.md 0.17):
 * the printable/emailable view behind a settlement-register row. Reuses the
 * settlement preview engine (same figures as the dashboard register) and
 * renders a branded PDF on demand. Route-gated to Accountant/Admin like the
 * rest of /settlement; the API enforces the same gate server-side.
 */
export function SettlementStatementPage() {
  const styles = useStyles();
  const tableStyles = useTableStyles();
  const api = useApi();
  const { vendorAccount = "" } = useParams();
  const [params] = useSearchParams();
  const period = resolvePeriod(params.get("fy"), params.get("p"));
  const statusParam = params.get("status");
  const status =
    statusParam === "Posted" || statusParam === "In progress" || statusParam === "Scheduled"
      ? statusParam
      : period.end < new Date().toISOString().slice(0, 10)
        ? "Posted"
        : "In progress";
  const settlementNumber = `SET-${period.end.replace(/-/g, "")}-${vendorAccount}`;

  const toasterId = useId("statement-toaster");
  const { dispatchToast } = useToastController(toasterId);
  const [busy, setBusy] = useState<"pdf" | "email" | null>(null);

  const vendors = useQuery({
    queryKey: ["vendors"],
    queryFn: () => api.get<VendorsResponse>("/vendors"),
  });
  const vendor = vendors.data?.value.find((v) => v.vendorAccount === vendorAccount);

  const preview = useQuery({
    queryKey: ["settlement-preview", vendorAccount, period.start, period.end],
    enabled: vendorAccount !== "",
    queryFn: () =>
      api.get<SettlementPreview>(
        `/settlement/preview?vendor=${encodeURIComponent(vendorAccount)}&from=${period.start}&to=${period.end}&basis=both`
      ),
  });

  const makePdf = async () => {
    if (!preview.data || !vendor) return null;
    return buildStatementPdf({
      preview: preview.data,
      vendor,
      period,
      settlementNumber,
      status,
    });
  };

  const onDownload = async () => {
    setBusy("pdf");
    try {
      const pdf = await makePdf();
      if (pdf) {
        downloadBlob(pdf.blob, pdf.filename);
        dispatchToast(
          <Toast>
            <ToastTitle>Statement PDF generated</ToastTitle>
            <ToastBody>{pdf.filename}</ToastBody>
          </Toast>,
          { intent: "success" }
        );
      }
    } finally {
      setBusy(null);
    }
  };

  const onEmail = async () => {
    if (!vendor) return;
    setBusy("email");
    try {
      const pdf = await makePdf();
      if (pdf) {
        downloadBlob(pdf.blob, pdf.filename);
        const slug = vendor.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        dispatchToast(
          <Toast>
            <ToastTitle>Queued for delivery (demo)</ToastTitle>
            <ToastBody>
              {pdf.filename} attached to a draft email to ap@{slug}.example — demo only, no email
              is actually sent. Outbound vendor email arrives with the Phase 7 payout integration.
            </ToastBody>
          </Toast>,
          { intent: "info", timeout: 6000 }
        );
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <Toaster toasterId={toasterId} />
      <Link to="/" className={tableStyles.link}>
        <ArrowLeftRegular style={{ verticalAlign: "-3px" }} /> Back to dashboard
      </Link>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
        <Title2>Settlement statement</Title2>
        <Text size={300} style={{ color: tokens.colorNeutralForeground3 }}>
          {settlementNumber}
        </Text>
        <Badge
          appearance="tint"
          color={status === "Posted" ? "success" : status === "In progress" ? "brand" : "informative"}
        >
          {status}
        </Badge>
      </div>

      {(vendors.isLoading || preview.isLoading) && (
        <Spinner size="small" style={{ marginTop: 16 }} label="Building statement…" />
      )}
      {preview.isError && (
        <Text block style={{ marginTop: 16 }}>
          API error: {(preview.error as Error).message}
        </Text>
      )}
      {vendors.data && !vendor && (
        <Text block style={{ marginTop: 16 }}>
          Unknown grower account {vendorAccount}.
        </Text>
      )}

      {vendor && preview.data && (
        <>
          <div className={styles.meta}>
            <Card className={styles.metaCard}>
              <Text size={200} weight="semibold" style={{ color: tokens.colorNeutralForeground3 }}>
                SETTLE TO (GROWER)
              </Text>
              <Text block weight="semibold" style={{ marginTop: 6 }}>
                {vendor.name}
              </Text>
              {vendor.street && <Text block size={200}>{vendor.street}</Text>}
              <Text block size={200}>
                {[vendor.city, vendor.state].filter(Boolean).join(", ")} {vendor.zip ?? ""}
              </Text>
              <Text block size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: 4 }}>
                Account {vendor.vendorAccount} · {vendor.paymentTerms ?? "Net30"} ·{" "}
                {vendor.currency ?? "USD"}
              </Text>
            </Card>
            <Card className={styles.metaCard}>
              <Text size={200} weight="semibold" style={{ color: tokens.colorNeutralForeground3 }}>
                FISCAL PERIOD
              </Text>
              <Text block weight="semibold" style={{ marginTop: 6 }}>
                FY{period.fiscalYear} · Period {period.period}
              </Text>
              <Text block size={200}>{periodRangeLabel(period)}</Text>
              <Text block size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: 4 }}>
                Sunday – Saturday settlement week
              </Text>
            </Card>
            <Card className={styles.metaCard}>
              <Text size={200} weight="semibold" style={{ color: tokens.colorNeutralForeground3 }}>
                SUMMARY
              </Text>
              <div className={styles.summaryRow}>
                <Text size={200}>Gross payable</Text>
                <Text size={200}>
                  {usd(preview.data.sections.reduce((s, x) => s + x.grossAmount, 0))}
                </Text>
              </div>
              <div className={styles.summaryRow}>
                <Text size={200}>Commission</Text>
                <Text size={200}>
                  −{usd(preview.data.sections.reduce((s, x) => s + x.commissionAmount, 0))}
                </Text>
              </div>
              <div className={styles.netBand}>
                <Text weight="semibold" style={{ color: "inherit" }}>
                  Net grower return
                </Text>
                <Text weight="semibold" style={{ color: "inherit" }}>
                  {usd(preview.data.totalEstimatedPayable)}
                </Text>
              </div>
            </Card>
          </div>

          <div className={styles.actions}>
            <Button
              appearance="primary"
              icon={<ArrowDownloadRegular />}
              disabled={busy !== null}
              onClick={onDownload}
            >
              {busy === "pdf" ? "Generating…" : "Download PDF"}
            </Button>
            <Button icon={<MailRegular />} disabled={busy !== null} onClick={onEmail}>
              {busy === "email" ? "Preparing…" : "Email to grower (demo)"}
            </Button>
          </div>

          {preview.data.sections
            .filter((s) => s.transactions.length > 0)
            .map((section) => (
              <StatementSection key={section.contractNumber} section={section} />
            ))}

          <div style={{ marginTop: 24, maxWidth: 880 }}>
            {preview.data.notes.map((note) => (
              <Text
                key={note}
                block
                size={200}
                style={{ color: tokens.colorNeutralForeground3, marginTop: 4 }}
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

function StatementSection({ section }: { section: PreviewSection }) {
  const tableStyles = useTableStyles();
  const isReceipts = section.basis === "Receipts";

  return (
    <div style={{ marginTop: 28, maxWidth: 980 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <Title3>Contract {section.contractNumber}</Title3>
        <Badge appearance="tint" color={isReceipts ? "brand" : "informative"}>
          {isReceipts ? "Receipt-based · flat rate" : "Sales-invoice based · commission"}
        </Badge>
      </div>
      <Text block size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: 4 }}>
        {section.eligibleCount} {isReceipts ? "posted receipts" : "invoiced sales orders"} settled
        {section.excludedCount > 0 &&
          ` · ${section.excludedCount} ${isReceipts ? "open receipts" : "uninvoiced orders"} excluded`}
        {" · subtotal "}
        <strong>{usd(section.estimatedPayable)}</strong>
      </Text>
      <table className={tableStyles.table} style={{ marginTop: 8 }}>
        <thead>
          <tr>
            <th className={tableStyles.cell}>Item</th>
            <th className={`${tableStyles.cell} ${tableStyles.num}`}>
              {isReceipts ? "Qty received" : "Qty sold"}
            </th>
            {isReceipts ? (
              <th className={`${tableStyles.cell} ${tableStyles.num}`}>Rate</th>
            ) : (
              <>
                <th className={`${tableStyles.cell} ${tableStyles.num}`}>Revenue</th>
                <th className={`${tableStyles.cell} ${tableStyles.num}`}>Comm %</th>
                <th className={`${tableStyles.cell} ${tableStyles.num}`}>Commission</th>
              </>
            )}
            <th className={`${tableStyles.cell} ${tableStyles.num}`}>
              {isReceipts ? "Amount payable" : "Net to grower"}
            </th>
          </tr>
        </thead>
        <tbody>
          {section.items.map((item) => (
            <tr key={item.itemNumber}>
              <td className={tableStyles.cell}>{item.itemName}</td>
              <td className={`${tableStyles.cell} ${tableStyles.num}`}>
                {item.quantity.toLocaleString()} {item.uom}
              </td>
              {isReceipts ? (
                <td className={`${tableStyles.cell} ${tableStyles.num}`}>
                  ${(item.ratePerUnit ?? 0).toFixed(2)}/{item.uom}
                </td>
              ) : (
                <>
                  <td className={`${tableStyles.cell} ${tableStyles.num}`}>
                    {usd(item.grossAmount)}
                  </td>
                  <td className={`${tableStyles.cell} ${tableStyles.num}`}>
                    {(item.commissionPercent ?? 0).toFixed(1)}%
                  </td>
                  <td className={`${tableStyles.cell} ${tableStyles.num}`}>
                    −{usd(item.commissionAmount)}
                  </td>
                </>
              )}
              <td className={`${tableStyles.cell} ${tableStyles.num}`}>
                {usd(item.estimatedPayable)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
