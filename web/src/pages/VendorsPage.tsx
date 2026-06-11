import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Input, Text, Title2 } from "@fluentui/react-components";
import { useApi } from "../api/client";
import { useTableStyles } from "../components/tableStyles";

interface Vendor {
  vendorAccount: string;
  name: string;
  city: string;
  state: string;
  currency: string;
  paymentTerms: string;
}

interface Contract {
  contractNumber: string;
  vendorAccount: string;
  settlementType: string;
  status: string;
}

export function VendorsPage() {
  const styles = useTableStyles();
  const api = useApi();
  const [search, setSearch] = useState("");

  const vendors = useQuery({
    queryKey: ["vendors", search],
    queryFn: () =>
      api.get<{ value: Vendor[] }>(`/vendors${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  });
  const contracts = useQuery({
    queryKey: ["contracts"],
    queryFn: () => api.get<{ value: Contract[] }>("/contracts"),
  });

  const contractsByVendor = new Map<string, Contract[]>();
  for (const c of contracts.data?.value ?? []) {
    contractsByVendor.set(c.vendorAccount, [...(contractsByVendor.get(c.vendorAccount) ?? []), c]);
  }

  return (
    <div>
      <Title2>Vendors</Title2>
      <Text block style={{ marginTop: 8 }}>
        Growers synced from D365 (VendorsV3 — mock until Phase 1). Contract counts come from the
        app's contract register.
      </Text>
      <div className={styles.toolbar}>
        <Input
          placeholder="Search growers…"
          value={search}
          onChange={(_, d) => setSearch(d.value)}
          style={{ minWidth: 280 }}
        />
        {vendors.data && <Text className={styles.muted}>{vendors.data.value.length} growers</Text>}
      </div>
      {vendors.isLoading && <Text>Loading…</Text>}
      {vendors.isError && <Text>API error: {(vendors.error as Error).message}</Text>}
      {vendors.data && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.cell}>Account</th>
              <th className={styles.cell}>Grower</th>
              <th className={styles.cell}>Location</th>
              <th className={styles.cell}>Terms</th>
              <th className={styles.cell}>Contracts</th>
            </tr>
          </thead>
          <tbody>
            {vendors.data.value.map((v) => {
              const own = contractsByVendor.get(v.vendorAccount) ?? [];
              return (
                <tr key={v.vendorAccount}>
                  <td className={styles.cell}>{v.vendorAccount}</td>
                  <td className={styles.cell}>{v.name}</td>
                  <td className={styles.cell}>
                    {v.city}, {v.state}
                  </td>
                  <td className={styles.cell}>{v.paymentTerms}</td>
                  <td className={styles.cell}>
                    {own.length === 0 && <Text className={styles.muted}>—</Text>}
                    {own.map((c) => (
                      <Badge
                        key={c.contractNumber}
                        appearance="tint"
                        color={c.settlementType === "TradeAgreement" ? "brand" : "success"}
                        style={{ marginRight: 4 }}
                      >
                        {c.settlementType === "TradeAgreement" ? "Flat rate" : "Commission"}
                      </Badge>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
