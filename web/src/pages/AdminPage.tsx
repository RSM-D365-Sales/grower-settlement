import { Text, Title2 } from "@fluentui/react-components";

export function AdminPage() {
  return (
    <div>
      <Title2>Administration</Title2>
      <Text block style={{ marginTop: 8 }}>
        Configuration, pool management, and the integration outbox/retry dashboard arrive in later
        phases (Docs/PLAN.md §6, §8).
      </Text>
    </div>
  );
}
