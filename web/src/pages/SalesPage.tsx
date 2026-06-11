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

const STATUS_COLOR: Record<string, "success" | "brand" | "warning"> = {
  Invoiced: "success",
  Confirmed: "brand",
  Open: "warning",
};

interface SalesOrderLine {
  lineNumber: number;
  itemNumber: string;
  itemName: string;
  quantity: number;
  uom: string;
  unitPrice: number;
  lineAmount: number;
}

interface SalesOrder {
  salesOrderNumber: string;
  orderDate: string;
  customerAccount: string;
  customerName: string;
  status: string;
  lines: SalesOrderLine[];
}

export function SalesPage() {
  const styles = useTableStyles();
  const api = useApi();
  const [days, setDays] = useState(3);

  const orders = useQuery({
    queryKey: ["salesorders", days],
    queryFn: () => api.get<{ value: SalesOrder[] }>(`/salesorders?days=${days}`),
  });

  const rows = orders.data?.value ?? [];
  const total = rows.reduce(
    (sum, so) => sum + so.lines.reduce((s, l) => s + l.lineAmount, 0),
    0
  );

  return (
    <div>
      <Title2>Sales</Title2>
      <Text block style={{ marginTop: 8 }}>
        Sales orders synced from D365 (~15/day seeded; live sync via business events arrives in
        Phase 5). Tracing each sales line back to grower lots powers commission settlement —
        production linkage comes with the traceability ledger.
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
        {orders.data && (
          <Text className={styles.muted}>
            {rows.length} orders ·{" "}
            {total.toLocaleString(undefined, { style: "currency", currency: "USD" })} total
          </Text>
        )}
      </div>
      {orders.isLoading && <Text>Loading…</Text>}
      {orders.isError && <Text>API error: {(orders.error as Error).message}</Text>}
      {orders.data && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.cell}>Date</th>
              <th className={styles.cell}>Order #</th>
              <th className={styles.cell}>Customer</th>
              <th className={styles.cell}>Item</th>
              <th className={`${styles.cell} ${styles.num}`}>Qty</th>
              <th className={`${styles.cell} ${styles.num}`}>Unit price</th>
              <th className={`${styles.cell} ${styles.num}`}>Amount</th>
              <th className={styles.cell}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.flatMap((so) =>
              so.lines.map((line, i) => (
                <tr key={`${so.salesOrderNumber}-${line.lineNumber}`}>
                  <td className={styles.cell}>{i === 0 ? so.orderDate : ""}</td>
                  <td className={styles.cell}>{i === 0 ? so.salesOrderNumber : ""}</td>
                  <td className={styles.cell}>{i === 0 ? so.customerName : ""}</td>
                  <td className={styles.cell}>{line.itemName}</td>
                  <td className={`${styles.cell} ${styles.num}`}>
                    {line.quantity.toLocaleString()} {line.uom}
                  </td>
                  <td className={`${styles.cell} ${styles.num}`}>${line.unitPrice.toFixed(2)}</td>
                  <td className={`${styles.cell} ${styles.num}`}>
                    {line.lineAmount.toLocaleString(undefined, {
                      style: "currency",
                      currency: "USD",
                    })}
                  </td>
                  <td className={styles.cell}>
                    {i === 0 && (
                      <Badge appearance="tint" color={STATUS_COLOR[so.status] ?? "informative"}>
                        {so.status}
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
