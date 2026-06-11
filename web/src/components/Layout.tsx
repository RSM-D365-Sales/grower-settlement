import { Badge, Button, Text, Title3, makeStyles, tokens } from "@fluentui/react-components";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { hasAccess } from "../auth/roles";
import { NAV_ITEMS } from "../nav/navConfig";

const useStyles = makeStyles({
  root: { display: "grid", gridTemplateRows: "48px 1fr", gridTemplateColumns: "220px 1fr", height: "100vh" },
  header: {
    gridColumn: "1 / 3",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "0 16px",
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
  },
  headerTitle: { color: tokens.colorNeutralForegroundOnBrand, flexGrow: 1 },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    padding: "12px 8px",
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  navLink: {
    padding: "8px 12px",
    borderRadius: tokens.borderRadiusMedium,
    color: tokens.colorNeutralForeground1,
    textDecoration: "none",
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeBase300,
  },
  navLinkActive: {
    backgroundColor: tokens.colorBrandBackground2,
    fontWeight: tokens.fontWeightSemibold,
  },
  main: { padding: "24px", overflowY: "auto" },
});

export function Layout() {
  const styles = useStyles();
  const { user, signOut } = useAuth();
  const items = NAV_ITEMS.filter((item) => user && hasAccess(user.roles, item.allowed));

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <Title3 className={styles.headerTitle}>Grower Settlement</Title3>
        <Text className={styles.headerTitle} style={{ flexGrow: 0 }}>
          {user?.name}
        </Text>
        {user?.roles.map((role) => (
          <Badge key={role} appearance="outline" color="informative">
            {role}
          </Badge>
        ))}
        <Button appearance="transparent" style={{ color: "inherit" }} onClick={signOut}>
          Sign out
        </Button>
      </header>
      <nav className={styles.nav}>
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
