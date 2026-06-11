import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink, useParams } from "react-router-dom";
import { Badge, Text, Title2, Title3, makeStyles, tokens } from "@fluentui/react-components";
import { useApi } from "../api/client";
import { ApiError } from "../api/ApiError";
import { Contract, Receipt } from "../api/types";
import { useTableStyles } from "../components/tableStyles";

const useStyles = makeStyles({
  titleRow: { display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" },
  meta: {
    display: "grid",
    gridTemplateColumns: "max-content 1fr",
    columnGap: "24px",
    rowGap: "4px",
    margin: "16px 0 8px",
    maxWidth: "560px",
  },
  metaLabel: { color: tokens.colorNeutralForeground3 },
  section: { marginTop: "24px", marginBottom: "8px" },
});

function lineScope(line: Contract["lines"][number]): string {
  if (line.scope === "AllItems") return "All items";
  if (line.scope === "Commodity") return `Commodity: ${line.commodityName ?? line.commodityCode}`;
  return line.itemName ?? line.itemNumber ?? "?";
}

export function ContractDetailPage() {
  const styles = useStyles();
  const table = useTableStyles();
  const api = useApi();
  const { contractNumber = "" } = useParams();

  const contract = useQuery({
    queryKey: ["contract", contractNumber],
    queryFn: () => api.get<Contract>(`/contracts/${encodeURIComponent(contractNumber)}`),
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
  });

  const receipts = useQuery({
    queryKey: ["receipts", "contract", contractNumber],
    queryFn: () =>
      api.get<{ value: Receipt[] }>(`/receipts?days=30&contract=${encodeURIComponent(contractNumber)}`),
  });

  if (contract.isLoading) return <Text>Loading…</Text>;
  if (contract.isError) {
    return (
      <div>
        <RouterLink to="/contracts" className={table.link}>
          ← Contracts
        </RouterLink>
        <Title2 style={{ display: "block", marginTop: 8 }}>{contractNumber}</Title2>
        <Text block style={{ marginTop: 8 }}>
          {(contract.error as Error).message}
        </Text>
      </div>
    );
  }

  const c = contract.data!;
  const isFlatRate = c.settlementType === "TradeAgreement";
  const receiptRows = receipts.data?.value ?? [];

  return (
    <div>
      <RouterLink to="/contracts" className={table.link}>
        ← Contracts
      </RouterLink>
      <div className={styles.titleRow}>
        <Title2>{c.contractNumber}</Title2>
        <Badge appearance="tint" color={isFlatRate ? "brand" : "success"}>
          {isFlatRate ? "Flat rate" : "Commission"}
        </Badge>
        <Badge appearance="tint" color={c.status === "Enabled" ? "success" : "warning"}>
          {c.status}
        </Badge>
      </div>
      <div className={styles.meta}>
        <Text className={styles.metaLabel}>Grower</Text>
        <Text>
          {c.vendorName} ({c.vendorAccount})
        </Text>
        <Text className={styles.metaLabel}>Season</Text>
        <Text>{c.seasonCode}</Text>
        <Text className={styles.metaLabel}>Valid</Text>
        <Text>
          {c.validFrom} → {c.validTo}
        </Text>
        <Text className={styles.metaLabel}>Settlement</Text>
        <Text>
          {isFlatRate
            ? "Pay a fixed rate per unit received (trade agreement)"
            : "Company keeps a commission % of net revenue; grower receives the remainder"}
        </Text>
      </div>

      <Title3 className={styles.section} block>
        Lines
      </Title3>
      <table className={table.table} style={{ maxWidth: 860 }}>
        <thead>
          <tr>
            <th className={table.cell}>Line</th>
            <th className={table.cell}>Scope</th>
            <th className={table.cell}>Item / Commodity</th>
            <th className={table.cell}>UoM</th>
            <th className={`${table.cell} ${table.num}`}>{isFlatRate ? "Rate per unit" : "Commission %"}</th>
          </tr>
        </thead>
        <tbody>
          {c.lines.map((line) => (
            <tr key={line.lineNumber}>
              <td className={table.cell}>{line.lineNumber}</td>
              <td className={table.cell}>{line.scope === "AllItems" ? "All items" : line.scope}</td>
              <td className={table.cell}>
                {lineScope(line)}
                {line.itemNumber && (
                  <>
                    <br />
                    <Text className={table.muted} size={200}>
                      {line.itemNumber}
                    </Text>
                  </>
                )}
              </td>
              <td className={table.cell}>{line.uom}</td>
              <td className={`${table.cell} ${table.num}`}>
                {line.ratePerUnit !== undefined
                  ? `$${line.ratePerUnit.toFixed(2)}/${line.uom}`
                  : line.commissionPercent !== undefined
                    ? `${line.commissionPercent}%`
                    : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Title3 className={styles.section} block>
        Receipts against this contract (last 30 days)
      </Title3>
      {receipts.isLoading && <Text>Loading…</Text>}
      {receipts.isError && <Text>API error: {(receipts.error as Error).message}</Text>}
      {receipts.data &&
        (receiptRows.length === 0 ? (
          <Text className={table.muted}>No receipts in the last 30 days.</Text>
        ) : (
          <table className={table.table} style={{ maxWidth: 1000 }}>
            <thead>
              <tr>
                <th className={table.cell}>Date</th>
                <th className={table.cell}>Receipt #</th>
                <th className={table.cell}>Item</th>
                <th className={`${table.cell} ${table.num}`}>Qty</th>
                <th className={table.cell}>Lot</th>
                <th className={table.cell}>D365 PO</th>
                <th className={table.cell}>Status</th>
              </tr>
            </thead>
            <tbody>
              {receiptRows.flatMap((r) =>
                r.lines.map((line, i) => (
                  <tr key={`${r.receiptNumber}-${line.lineNumber}`}>
                    <td className={table.cell}>{i === 0 ? r.receiptDate : ""}</td>
                    <td className={table.cell}>{i === 0 ? r.receiptNumber : ""}</td>
                    <td className={table.cell}>{line.itemName}</td>
                    <td className={`${table.cell} ${table.num}`}>
                      {line.quantity.toLocaleString()} {line.uom}
                    </td>
                    <td className={table.cell}>{line.lotNumber}</td>
                    <td className={table.cell}>{i === 0 ? r.d365PoNumber : ""}</td>
                    <td className={table.cell}>
                      {i === 0 && (
                        <Badge appearance="tint" color={r.status === "Posted" ? "success" : "warning"}>
                          {r.status}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ))}
    </div>
  );
}
