import { Text, Title2 } from "@fluentui/react-components";

export function NotAuthorizedPage() {
  return (
    <div>
      <Title2>Not authorized</Title2>
      <Text block style={{ marginTop: 8 }}>
        Your account does not hold a role that can access this area. Contact an administrator if you
        believe this is wrong.
      </Text>
    </div>
  );
}
