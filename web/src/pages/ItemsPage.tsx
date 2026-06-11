import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Badge,
  Card,
  Input,
  Text,
  Title2,
  Title3,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useApi } from "../api/client";

const useStyles = makeStyles({
  toolbar: { display: "flex", gap: "12px", alignItems: "center", margin: "16px 0" },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "12px",
  },
  card: { padding: "14px", display: "flex", flexDirection: "column", gap: "6px" },
  itemNumber: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  badges: { display: "flex", gap: "4px", flexWrap: "wrap" },
  attr: { fontSize: tokens.fontSizeBase200 },
});

interface Item {
  itemNumber: string;
  name: string;
  inventoryUnit: string;
  salesUnit: string;
  commodityCode: string | null;
  lotControlled: boolean;
  shelfLifeDays: number | null;
  storageTemp: string | null;
}

interface Commodity {
  code: string;
  name: string;
  parentCode: string | null;
}

export function ItemsPage() {
  const styles = useStyles();
  const api = useApi();
  const [search, setSearch] = useState("");

  const items = useQuery({
    queryKey: ["items", search],
    queryFn: () =>
      api.get<{ value: Item[] }>(`/items${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  });
  const commodities = useQuery({
    queryKey: ["commodities"],
    queryFn: () => api.get<{ value: Commodity[] }>("/commodities"),
  });

  const commodityName = (code: string | null): string => {
    if (!code) return "Unassigned";
    return commodities.data?.value.find((c) => c.code === code)?.name ?? code;
  };

  const sorted = [...(items.data?.value ?? [])].sort(
    (a, b) =>
      commodityName(a.commodityCode).localeCompare(commodityName(b.commodityCode)) ||
      a.name.localeCompare(b.name)
  );

  return (
    <div>
      <Title2>Items</Title2>
      <Text block style={{ marginTop: 8 }}>
        Released products and their commodity assignments sync read-only from D365
        (ReleasedProductsV2 + ProductCategoryHierarchies — mock until Phase 1). Lot control, units,
        shelf life and storage drive receiving, traceability and settlement downstream.
      </Text>
      <div className={styles.toolbar}>
        <Input
          placeholder="Search items or commodities…"
          value={search}
          onChange={(_, d) => setSearch(d.value)}
          style={{ minWidth: 280 }}
        />
        {items.data && <Text>{items.data.value.length} items</Text>}
      </div>
      {items.isLoading && <Text>Loading…</Text>}
      {items.isError && <Text>API error: {(items.error as Error).message}</Text>}
      <div className={styles.grid}>
        {sorted.map((item) => (
          <Card key={item.itemNumber} className={styles.card}>
            <Title3>{item.name}</Title3>
            <Text className={styles.itemNumber}>{item.itemNumber}</Text>
            <div className={styles.badges}>
              <Badge appearance="tint" color="brand">
                {commodityName(item.commodityCode)}
              </Badge>
              {item.lotControlled && (
                <Badge appearance="tint" color="success">
                  Lot tracked
                </Badge>
              )}
            </div>
            <Text className={styles.attr}>
              Stocked in <b>{item.inventoryUnit}</b> · sold in <b>{item.salesUnit}</b>
            </Text>
            {item.shelfLifeDays !== null && (
              <Text className={styles.attr}>Shelf life: {item.shelfLifeDays} days</Text>
            )}
            {item.storageTemp && <Text className={styles.attr}>Storage: {item.storageTemp}</Text>}
          </Card>
        ))}
      </div>
    </div>
  );
}
