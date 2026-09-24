import { Navigate } from "react-router-dom";
import { Button, Card, Text, Title2, makeStyles } from "@fluentui/react-components";
import { useAuth } from "../auth/AuthContext";
import { BLUESTEM } from "../theme";
import bluestemLogo from "../assets/brand/bluestem_logo_primary.png";
import rsmLogo from "../assets/brand/rsmus-logo.png";

const useStyles = makeStyles({
  root: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    backgroundColor: BLUESTEM.fog,
  },
  card: { width: "380px", display: "flex", flexDirection: "column", gap: "12px", padding: "24px" },
  logo: { width: "220px", height: "auto", display: "block", marginBottom: "4px" },
  sponsor: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginTop: "8px",
    color: BLUESTEM.midGrey,
    fontSize: "11px",
  },
  sponsorLogo: { height: "20px", width: "auto", display: "block" },
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
        <img src={bluestemLogo} alt="bluestem Fresh Produce" className={styles.logo} />
        <Title2>Grower Settlement</Title2>
        <Text>Sign in with your organizational account.</Text>
        <Button appearance="primary" onClick={() => signIn()}>
          Sign in with Microsoft
        </Button>
        <span className={styles.sponsor}>
          Powered by <img src={rsmLogo} alt="RSM" className={styles.sponsorLogo} />
        </span>
      </Card>
    </div>
  );
}
