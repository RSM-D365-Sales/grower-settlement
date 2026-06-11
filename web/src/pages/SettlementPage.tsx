import { useQuery } from "@tanstack/react-query";
import { Text, Title2 } from "@fluentui/react-components";
import { useApi } from "../api/client";

interface BatchesResponse {
  value: unknown[];
  note?: string;
}

/** Hard-gated to Accountant/Admin — both by route guard and, authoritatively,
 *  by the API on every request (Docs/PLAN.md §4). */
export function SettlementPage() {
  const api = useApi();
  const batches = useQuery({
    queryKey: ["settlement-batches"],
    queryFn: () => api.get<BatchesResponse>("/settlement/batches"),
  });

  return (
    <div>
      <Title2>Settlement</Title2>
      {batches.isLoading && <Text block>Loading…</Text>}
      {batches.isError && <Text block>API error: {(batches.error as Error).message}</Text>}
      {batches.data && (
        <Text block style={{ marginTop: 8 }}>
          {batches.data.value.length === 0
            ? `No settlement batches yet. ${batches.data.note ?? ""}`
            : `${batches.data.value.length} batches`}
        </Text>
      )}
    </div>
  );
}
