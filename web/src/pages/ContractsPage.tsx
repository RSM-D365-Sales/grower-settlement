import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Input, Text, Title2 } from "@fluentui/react-components";
import { useApi } from "../api/client";
import { useTableStyles } from "../components/tableStyles";

interface ContractLine {
  lineNumber: number;
  scope: "Item" | "Commodity" | "AllItems";
  itemNumber?: string;
  itemName?: string;
  commodityCode?: string;
  commodityName?: string;
  uom: string;
  ratePerUnit?: number;
  commissionPercent?: number;
}

interface Contract {
  contractNumber: string;
  vendorAccount: string;
  vendorName: string;
  seasonCode: string;
  validFrom: string;
  validTo: string;
  settlementType: "TradeAgreement" | "SalesCommission";
  status: string;
  lines: ContractLine[];
}

function scopeSummary(c: Contract): string {
  const first = c.lines[0];
  if (!first) return "—";
  if (first.scope === "AllItems") return "All items";
  if (first.scope === "Commodity") return `Commodity: ${first.commodityName ?? first.commodityCode}`;
  const names = c.lines.map((l) => l.itemName ?? l.itemNumber ?? "?");
  return names.length <= 2 ? names.join(", ") : `${names[0]}, ${names[1]} +${names.length - 2} more`;
}

function termsSummary(c: Contract): string {
  if (c.settlementType === "SalesCommission") {
    const pct = c.lines[0]?.commissionPercent;
    return pct !== undefined ? `${pct}% commission` : "Commission";
  }
  const rates = c.lines.filter((l) => l.ratePerUnit !== undefined);
  if (rates.length === 0) return "—";
  if (rates.length === 1) return `$${rates[0]!.ratePerUnit!.toFixed(2)}/${rates[0]!.uom}`;
  const min = Math.min(...rates.map((l) => l.ratePerUnit!));
  const max = Math.max(...rates.map((l) => l.ratePerUnit!));
  return `$${min.toFixed(2)}–$${max.toFixed(2)}/${rates[0]!.uom}`;
}

export function ContractsPage() {
  const styles = useTableStyles();
  const api = useApi();
  const [search, setSearch] = useState("");

  const contracts = useQuery({
    queryKey: ["contracts", search],
    queryFn: () =>
      api.get<{ value: Contract[] }>(
        `/contracts${search ? `?search=${encodeURIComponent(search)}` : ""}`
      ),
  });

  return (
    <div>
      <Title2>Contracts</Title2>
      <Text block style={{ marginTop: 8 }}>
        Grower contracts for SEASON-2026 (demo register — CRUD, approval workflow and the
        enable/disable lifecycle arrive in Phase 2).
      </Text>
      <div className={styles.toolbar}>
        <Input
          placeholder="Search contract # or grower…"
          value={search}
          onChange={(_, d) => setSearch(d.value)}
          style={{ minWidth: 280 }}
        />
        {contracts.data && (
          <Text className={styles.muted}>{contracts.data.value.length} contracts</Text>
        )}
      </div>
      {contracts.isLoading && <Text>Loading…</Text>}
      {contracts.isError && <Text>API error: {(contracts.error as Error).message}</Text>}
      {contracts.data && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.cell}>Contract #</th>
              <th className={styles.cell}>Grower</th>
              <th className={styles.cell}>Type</th>
              <th className={styles.cell}>Scope</th>
              <th className={styles.cell}>Terms</th>
              <th className={styles.cell}>Valid</th>
              <th className={styles.cell}>Status</th>
            </tr>
          </thead>
          <tbody>
            {contracts.data.value.map((c) => (
              <tr key={c.contractNumber}>
                <td className={styles.cell}>{c.contractNumber}</td>
                <td className={styles.cell}>
                  {c.vendorName}
                  <br />
                  <Text className={styles.muted} size={200}>
                    {c.vendorAccount}
                  </Text>
                </td>
                <td className={styles.cell}>
                  <Badge
                    appearance="tint"
                    color={c.settlementType === "TradeAgreement" ? "brand" : "success"}
                  >
                    {c.settlementType === "TradeAgreement" ? "Flat rate" : "Commission"}
                  </Badge>
                </td>
                <td className={styles.cell}>{scopeSummary(c)}</td>
                <td className={styles.cell}>{termsSummary(c)}</td>
                <td className={styles.cell}>
                  {c.validFrom} → {c.validTo}
                </td>
                <td className={styles.cell}>
                  <Badge appearance="tint" color={c.status === "Enabled" ? "success" : "warning"}>
                    {c.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
