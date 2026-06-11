import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Dropdown,
  Field,
  Input,
  Option,
  Text,
  Title2,
  Title3,
} from "@fluentui/react-components";
import { useApi } from "../api/client";
import { useTableStyles } from "../components/tableStyles";
import type {
  PreviewBasis,
  PreviewSection,
  SettlementPreview,
} from "../api/settlementPreviewCalc";

const BASIS_OPTIONS: { value: PreviewBasis; label: string }[] = [
  { value: "both", label: "Both contract types" },
  { value: "receipt", label: "Receipt-based (flat rate)" },
  { value: "sales", label: "Sales-invoice based (commission)" },
];

const STATUS_COLOR: Record<string, "success" | "brand" | "warning"> = {
  Posted: "success",
  Invoiced: "success",
  Confirmed: "brand",
  Open: "warning",
};

/** Cap the linked-transaction list so a 30-day range stays scannable. */
const TXN_DISPLAY_LIMIT = 12;

interface Vendor {
  vendorAccount: string;
  name: string;
}

interface BatchesResponse {
  value: unknown[];
  note?: string;
}

interface Criteria {
  vendor: string;
  from: string;
  to: string;
  basis: PreviewBasis;
}

function usd(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Hard-gated to Accountant/Admin — both by route guard and, authoritatively,
 *  by the API on every request (Docs/PLAN.md §4). */
export function SettlementPage() {
  const styles = useTableStyles();
  const api = useApi();

  const [vendor, setVendor] = useState("");
  const [from, setFrom] = useState(isoDaysAgo(13));
  const [to, setTo] = useState(isoDaysAgo(0));
  const [basis, setBasis] = useState<PreviewBasis>("both");
  const [submitted, setSubmitted] = useState<Criteria | null>(null);

  const vendors = useQuery({
    queryKey: ["vendors"],
    queryFn: () => api.get<{ value: Vendor[] }>("/vendors"),
  });

  const preview = useQuery({
    queryKey: ["settlement-preview", submitted],
    enabled: submitted !== null,
    queryFn: () => {
      const c = submitted!;
      return api.get<SettlementPreview>(
        `/settlement/preview?vendor=${encodeURIComponent(c.vendor)}&from=${c.from}&to=${c.to}&basis=${c.basis}`
      );
    },
  });

  const batches = useQuery({
    queryKey: ["settlement-batches"],
    queryFn: () => api.get<BatchesResponse>("/settlement/batches"),
  });

  const vendorLabel = (v: Vendor) => `${v.name} (${v.vendorAccount})`;
  const selectedVendor = vendors.data?.value.find((v) => v.vendorAccount === vendor);
  const invalidRange = Boolean(from && to && from > to);

  return (
    <div>
      <Title2>Settlement</Title2>
      <Text block style={{ marginTop: 8 }}>
        Pick a grower, date range and contract type, then generate a preview of linked
        transactions and the estimated grower payable. This is a mock calculation over demo data —
        batch creation, adjustments and D365 posting arrive in Phase 6.
      </Text>

      <div className={styles.toolbar} style={{ alignItems: "flex-end" }}>
        <Field label="Grower">
          <Dropdown
            placeholder="Select a grower…"
            value={selectedVendor ? vendorLabel(selectedVendor) : ""}
            selectedOptions={vendor ? [vendor] : []}
            onOptionSelect={(_, d) => setVendor(d.optionValue ?? "")}
            style={{ minWidth: 280 }}
          >
            {(vendors.data?.value ?? []).map((v) => (
              <Option key={v.vendorAccount} value={v.vendorAccount} text={vendorLabel(v)}>
                {vendorLabel(v)}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="From">
          <Input type="date" value={from} onChange={(_, d) => setFrom(d.value)} />
        </Field>
        <Field label="To">
          <Input type="date" value={to} onChange={(_, d) => setTo(d.value)} />
        </Field>
        <Field label="Contract type">
          <Dropdown
            value={BASIS_OPTIONS.find((o) => o.value === basis)?.label ?? ""}
            selectedOptions={[basis]}
            onOptionSelect={(_, d) => d.optionValue && setBasis(d.optionValue as PreviewBasis)}
            style={{ minWidth: 240 }}
          >
            {BASIS_OPTIONS.map((o) => (
              <Option key={o.value} value={o.value}>
                {o.label}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Button
          appearance="primary"
          disabled={!vendor || !from || !to || invalidRange || preview.isFetching}
          onClick={() => setSubmitted({ vendor, from, to, basis })}
        >
          Generate preview
        </Button>
      </div>
      {invalidRange && (
        <Text block className={styles.muted}>
          The From date must be on or before the To date.
        </Text>
      )}

      {preview.isFetching && <Text block>Calculating…</Text>}
      {preview.isError && !preview.isFetching && (
        <Text block>API error: {(preview.error as Error).message}</Text>
      )}
      {preview.data && !preview.isFetching && <PreviewResult preview={preview.data} />}

      <div style={{ marginTop: 40 }}>
        <Title3>Settlement batches</Title3>
        {batches.isLoading && <Text block>Loading…</Text>}
        {batches.isError && <Text block>API error: {(batches.error as Error).message}</Text>}
        {batches.data && (
          <Text block className={styles.muted} style={{ marginTop: 4 }}>
            {batches.data.value.length === 0
              ? `No settlement batches yet. ${batches.data.note ?? ""}`
              : `${batches.data.value.length} batches`}
          </Text>
        )}
      </div>
    </div>
  );
}

function PreviewResult({ preview }: { preview: SettlementPreview }) {
  const styles = useTableStyles();
  const basisLabel =
    BASIS_OPTIONS.find((o) => o.value === preview.basis)?.label.toLowerCase() ?? preview.basis;

  return (
    <div style={{ marginTop: 16 }}>
      <Title3>
        Estimated payable to {preview.vendorName}: {usd(preview.totalEstimatedPayable)}
      </Title3>
      <Text block className={styles.muted} style={{ marginTop: 4 }}>
        {preview.fromDate} to {preview.toDate} · {basisLabel} ·{" "}
        {preview.sections.length === 1
          ? "1 contract"
          : `${preview.sections.length} contracts`}{" "}
        evaluated
      </Text>
      {preview.notes.map((note) => (
        <Text key={note} block className={styles.muted} style={{ marginTop: 4, maxWidth: 880 }}>
          ⓘ {note}
        </Text>
      ))}
      {preview.sections.length === 0 && (
        <Text block style={{ marginTop: 12 }}>
          This grower has no {basisLabel} contract. Try the other contract type — every demo
          grower has a flat-rate contract, and about half also have a commission contract.
        </Text>
      )}
      {preview.sections.map((section) => (
        <SectionView key={section.contractNumber} section={section} />
      ))}
    </div>
  );
}

function SectionView({ section }: { section: PreviewSection }) {
  const styles = useTableStyles();
  const isReceipts = section.basis === "Receipts";
  const shown = section.transactions.slice(0, TXN_DISPLAY_LIMIT);
  const hidden = section.transactions.length - shown.length;
  const docNoun = isReceipts ? "receipts" : "sales orders";

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
        <Title3>{section.contractNumber}</Title3>
        <Badge appearance="tint" color={isReceipts ? "brand" : "informative"}>
          {isReceipts ? "Receipt-based · flat rate" : "Sales-invoice based · commission"}
        </Badge>
        <Badge
          appearance="tint"
          color={section.contractStatus === "Enabled" ? "success" : "warning"}
        >
          {section.contractStatus}
        </Badge>
      </div>
      <Text block className={styles.muted} style={{ marginTop: 4 }}>
        {section.eligibleCount} {isReceipts ? "posted" : "invoiced"} {docNoun}
        {section.excludedCount > 0 &&
          ` (${section.excludedCount} ${isReceipts ? "open" : "not yet invoiced"} — excluded)`}
        {" · "}
        {isReceipts ? "gross" : "revenue"} {usd(section.grossAmount)}
        {!isReceipts && ` · commission −${usd(section.commissionAmount)}`} · estimated payable{" "}
        <strong>{usd(section.estimatedPayable)}</strong>
      </Text>

      {section.items.length > 0 && (
        <table className={styles.table} style={{ marginTop: 8, maxWidth: 880 }}>
          <thead>
            <tr>
              <th className={styles.cell}>Item</th>
              <th className={`${styles.cell} ${styles.num}`}>
                {isReceipts ? "Qty received" : "Qty sold"}
              </th>
              {isReceipts ? (
                <th className={`${styles.cell} ${styles.num}`}>Rate</th>
              ) : (
                <>
                  <th className={`${styles.cell} ${styles.num}`}>Revenue</th>
                  <th className={`${styles.cell} ${styles.num}`}>Comm %</th>
                  <th className={`${styles.cell} ${styles.num}`}>Commission</th>
                </>
              )}
              <th className={`${styles.cell} ${styles.num}`}>Est. payable</th>
            </tr>
          </thead>
          <tbody>
            {section.items.map((item) => (
              <tr key={item.itemNumber}>
                <td className={styles.cell}>{item.itemName}</td>
                <td className={`${styles.cell} ${styles.num}`}>
                  {item.quantity.toLocaleString()} {item.uom}
                </td>
                {isReceipts ? (
                  <td className={`${styles.cell} ${styles.num}`}>
                    ${(item.ratePerUnit ?? 0).toFixed(2)}/{item.uom}
                  </td>
                ) : (
                  <>
                    <td className={`${styles.cell} ${styles.num}`}>{usd(item.grossAmount)}</td>
                    <td className={`${styles.cell} ${styles.num}`}>
                      {(item.commissionPercent ?? 0).toFixed(1)}%
                    </td>
                    <td className={`${styles.cell} ${styles.num}`}>
                      −{usd(item.commissionAmount)}
                    </td>
                  </>
                )}
                <td className={`${styles.cell} ${styles.num}`}>{usd(item.estimatedPayable)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {section.transactions.length === 0 ? (
        <Text block className={styles.muted} style={{ marginTop: 8 }}>
          No linked {docNoun} in the selected date range.
        </Text>
      ) : (
        <>
          <Text block weight="semibold" style={{ marginTop: 12 }}>
            Linked {docNoun}
          </Text>
          <table className={styles.table} style={{ marginTop: 4, maxWidth: 880 }}>
            <thead>
              <tr>
                <th className={styles.cell}>Date</th>
                <th className={styles.cell}>{isReceipts ? "Receipt #" : "Order #"}</th>
                <th className={styles.cell}>{isReceipts ? "D365 PO" : "Customer"}</th>
                <th className={`${styles.cell} ${styles.num}`}>Lines</th>
                <th className={`${styles.cell} ${styles.num}`}>Qty</th>
                <th className={`${styles.cell} ${styles.num}`}>
                  {isReceipts ? "Gross" : "Revenue"}
                </th>
                <th className={styles.cell}>Status</th>
                <th className={`${styles.cell} ${styles.num}`}>Est. payable</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((t) => (
                <tr key={t.documentNumber} style={{ opacity: t.eligible ? 1 : 0.55 }}>
                  <td className={styles.cell}>{t.date}</td>
                  <td className={styles.cell}>{t.documentNumber}</td>
                  <td className={styles.cell}>{t.reference}</td>
                  <td className={`${styles.cell} ${styles.num}`}>{t.lineCount}</td>
                  <td className={`${styles.cell} ${styles.num}`}>{t.quantity.toLocaleString()}</td>
                  <td className={`${styles.cell} ${styles.num}`}>{usd(t.grossAmount)}</td>
                  <td className={styles.cell}>
                    <Badge appearance="tint" color={STATUS_COLOR[t.status] ?? "informative"}>
                      {t.status}
                    </Badge>
                  </td>
                  <td className={`${styles.cell} ${styles.num}`}>
                    {t.eligible ? usd(t.estimatedPayable) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {hidden > 0 && (
            <Text block className={styles.muted} style={{ marginTop: 4 }}>
              Showing the {TXN_DISPLAY_LIMIT} most recent of {section.transactions.length} linked{" "}
              {docNoun}.
            </Text>
          )}
        </>
      )}
    </div>
  );
}
