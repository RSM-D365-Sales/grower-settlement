import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  Checkbox,
  Input,
  Label,
  Text,
  Title2,
  makeStyles,
} from "@fluentui/react-components";
import { useAuth } from "../auth/AuthContext";
import { Role, ROLES } from "../auth/roles";

const useStyles = makeStyles({
  root: { display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" },
  card: { width: "380px", display: "flex", flexDirection: "column", gap: "12px", padding: "24px" },
  roles: { display: "flex", flexDirection: "column" },
});

export function LoginPage() {
  const styles = useStyles();
  const { mode, user, signIn } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("Dev User");
  const [selected, setSelected] = useState<Role[]>(["Admin"]);

  if (user) return <Navigate to="/" replace />;

  const toggle = (role: Role, checked: boolean) =>
    setSelected((prev) => (checked ? [...prev, role] : prev.filter((r) => r !== role)));

  return (
    <div className={styles.root}>
      <Card className={styles.card}>
        <Title2>Grower Settlement</Title2>
        {mode === "entra" ? (
          <>
            <Text>Sign in with your organizational account.</Text>
            <Button appearance="primary" onClick={() => signIn()}>
              Sign in with Microsoft
            </Button>
          </>
        ) : (
          <>
            <Text>
              Mock sign-in (local development). Pick roles to simulate — the API enforces them
              server-side.
            </Text>
            <Label htmlFor="mock-name">Name</Label>
            <Input id="mock-name" value={name} onChange={(_, d) => setName(d.value)} />
            <div className={styles.roles}>
              {ROLES.map((role) => (
                <Checkbox
                  key={role}
                  label={role}
                  checked={selected.includes(role)}
                  onChange={(_, d) => toggle(role, d.checked === true)}
                />
              ))}
            </div>
            <Button
              appearance="primary"
              disabled={selected.length === 0 || name.trim().length === 0}
              onClick={() => {
                signIn({ name: name.trim(), roles: selected });
                navigate("/");
              }}
            >
              Sign in
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
