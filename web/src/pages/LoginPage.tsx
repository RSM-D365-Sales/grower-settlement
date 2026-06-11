import { Navigate } from "react-router-dom";
import { Button, Card, Text, Title2, makeStyles } from "@fluentui/react-components";
import { useAuth } from "../auth/AuthContext";

const useStyles = makeStyles({
  root: { display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" },
  card: { width: "380px", display: "flex", flexDirection: "column", gap: "12px", padding: "24px" },
});

/** Only reachable in Entra mode — mock mode auto-signs-in a demo identity
 *  and goes straight to the dashboard. */
export function LoginPage() {
  const styles = useStyles();
  const { user, signIn } = useAuth();

  if (user) return <Navigate to="/" replace />;

  return (
    <div className={styles.root}>
      <Card className={styles.card}>
        <Title2>Grower Settlement</Title2>
        <Text>Sign in with your organizational account.</Text>
        <Button appearance="primary" onClick={() => signIn()}>
          Sign in with Microsoft
        </Button>
      </Card>
    </div>
  );
}
