import { useQuery } from "@tanstack/react-query";
import { Badge, Card, CardHeader, Text, Title2, Title3, makeStyles } from "@fluentui/react-components";
import { useApi } from "../api/client";
import { useAuth } from "../auth/AuthContext";

const useStyles = makeStyles({
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px", marginTop: "16px" },
  card: { padding: "8px" },
});

interface MeResponse {
  id: string;
  name: string;
  roles: string[];
}

interface HealthResponse {
  status: string;
  authMode: string;
  d365Mode: string;
}

export function DashboardPage() {
  const styles = useStyles();
  const { user } = useAuth();
  const api = useApi();

  const me = useQuery({ queryKey: ["me"], queryFn: () => api.get<MeResponse>("/me") });
  const health = useQuery({ queryKey: ["health"], queryFn: () => api.get<HealthResponse>("/health") });

  return (
    <div>
      <Title2>Dashboard</Title2>
      <div className={styles.grid}>
        <Card className={styles.card}>
          <CardHeader header={<Title3>Your identity (as the API sees it)</Title3>} />
          {me.isLoading && <Text>Loading…</Text>}
          {me.isError && <Text>API error: {(me.error as Error).message}</Text>}
          {me.data && (
            <>
              <Text block>{me.data.name}</Text>
              <Text block size={200}>
                {me.data.id}
              </Text>
              <div>
                {me.data.roles.map((r) => (
                  <Badge key={r} appearance="tint" color="brand" style={{ marginRight: 4 }}>
                    {r}
                  </Badge>
                ))}
              </div>
            </>
          )}
        </Card>
        <Card className={styles.card}>
          <CardHeader header={<Title3>API health</Title3>} />
          {health.isLoading && <Text>Loading…</Text>}
          {health.isError && <Text>API unreachable: {(health.error as Error).message}</Text>}
          {health.data && (
            <>
              <Text block>Status: {health.data.status}</Text>
              <Text block>Auth mode: {health.data.authMode}</Text>
              <Text block>D365 mode: {health.data.d365Mode}</Text>
            </>
          )}
        </Card>
        <Card className={styles.card}>
          <CardHeader header={<Title3>Build phase</Title3>} />
          <Text block>Phase 0 — Foundation</Text>
          <Text block size={200}>
            Signed in client-side as {user?.name}. Contracts, receiving, traceability and settlement
            arrive in Phases 2–7 (Docs/PLAN.md §8).
          </Text>
        </Card>
      </div>
    </div>
  );
}
