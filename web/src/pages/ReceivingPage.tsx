import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Dropdown, Option, Text, Title2 } from "@fluentui/react-components";
import { useApi } from "../api/client";
import { useTableStyles } from "../components/tableStyles";

const DAY_OPTIONS = [
  { value: 1, label: "Today" },
  { value: 3, label: "Last 3 days" },
  { value: 7, label: "Last 7 days" },
  { value: 14, label: "Last 14 days" },
  { value: 30, label: "Last 30 days" },
];

interface ReceiptLine {
  lineNumber: number;
  itemNumber: string;
  itemName: string;
  quantity: number;
  uom: string;
  lotNumber: string;
}

interface Receipt {
  receiptNumber: string;
  receiptDate: string;
  vendorAccount: string;
  vendorName: string;
  contractNumber: string;
  status: "Open" | "Posted";
  d365PoNumber: string;
  lines: ReceiptLine[];
}

export function ReceivingPage() {
  const styles = useTableStyles();
  const api = useApi();
  const [days, setDays] = useState(3);

  const receipts = useQuery({
    queryKey: ["receipts", days],
    queryFn: () => api.get<{ value: Receipt[] }>(`/receipts?days=${days}`),
  });

  const rows = receipts.data?.value ?? [];
  const lineCount = rows.reduce((n, r) => n + r.lines.length, 0);

  return (
    <div>
      <Title2>Receiving</Title2>
      <Text block style={{ marginTop: 8 }}>
        Receipts against enabled contracts (~15/day seeded). Each receipt creates a D365 purchase
        order; in-app posting via the message processor arrives in Phase 3. Scale tickets, labels
        and dock doors arrive in Phase 4.
      </Text>
      <div className={styles.toolbar}>
        <Dropdown
          value={DAY_OPTIONS.find((o) => o.value === days)?.label ?? ""}
          selectedOptions={[String(days)]}
          onOptionSelect={(_, d) => d.optionValue && setDays(Number(d.optionValue))}
          style={{ minWidth: 160 }}
        >
          {DAY_OPTIONS.map((o) => (
            <Option key={o.value} value={String(o.value)}>
              {o.label}
            </Option>
          ))}
        </Dropdown>
        {receipts.data && (
          <Text className={styles.muted}>
            {rows.length} receipts · {lineCount} lines
          </Text>
        )}
      </div>
      {receipts.isLoading && <Text>Loading…</Text>}
      {receipts.isError && <Text>API error: {(receipts.error as Error).message}</Text>}
      {receipts.data && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.cell}>Date</th>
              <th className={styles.cell}>Receipt #</th>
              <th className={styles.cell}>Grower</th>
              <th className={styles.cell}>Item</th>
              <th className={`${styles.cell} ${styles.num}`}>Qty</th>
              <th className={styles.cell}>Lot</th>
              <th className={styles.cell}>Contract</th>
              <th className={styles.cell}>D365 PO</th>
              <th className={styles.cell}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.flatMap((r) =>
              r.lines.map((line, i) => (
                <tr key={`${r.receiptNumber}-${line.lineNumber}`}>
                  <td className={styles.cell}>{i === 0 ? r.receiptDate : ""}</td>
                  <td className={styles.cell}>{i === 0 ? r.receiptNumber : ""}</td>
                  <td className={styles.cell}>{i === 0 ? r.vendorName : ""}</td>
                  <td className={styles.cell}>{line.itemName}</td>
                  <td className={`${styles.cell} ${styles.num}`}>
                    {line.quantity.toLocaleString()} {line.uom}
                  </td>
                  <td className={styles.cell}>{line.lotNumber}</td>
                  <td className={styles.cell}>{i === 0 ? r.contractNumber : ""}</td>
                  <td className={styles.cell}>{i === 0 ? r.d365PoNumber : ""}</td>
                  <td className={styles.cell}>
                    {i === 0 && (
                      <Badge
                        appearance="tint"
                        color={r.status === "Posted" ? "success" : "warning"}
                      >
                        {r.status}
                      </Badge>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
