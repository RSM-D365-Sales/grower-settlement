import { useState } from "react";
import {
  Badge,
  Button,
  Text,
  Title3,
  Tooltip,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import { NavigationRegular } from "@fluentui/react-icons";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { hasAccess } from "../auth/roles";
import { NAV_ITEMS } from "../nav/navConfig";
import { loadNavCollapsed, saveNavCollapsed } from "../lib/savedView";
import { NORTH_BAY } from "../theme";

const useStyles = makeStyles({
  root: {
    display: "grid",
    gridTemplateRows: "52px 1fr",
    gridTemplateColumns: "220px 1fr",
    height: "100vh",
  },
  rootNavCollapsed: { gridTemplateColumns: "0px 1fr" },
  header: {
    gridColumn: "1 / 3",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "0 16px",
    backgroundColor: NORTH_BAY.navy,
    borderBottom: `3px solid ${NORTH_BAY.coral}`,
    color: "#ffffff",
  },
  brand: { display: "flex", alignItems: "baseline", gap: "10px", flexGrow: 1, flexWrap: "wrap" },
  brandName: { color: "#ffffff", letterSpacing: "0.04em" },
  brandTag: { color: "#c3d6e9", fontStyle: "italic" },
  headerUser: { color: "#ffffff" },
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
  // Pinned to column 2 so it stays in place when the nav is collapsed/unmounted.
  main: { gridColumn: "2", gridRow: "2", padding: "24px", overflowY: "auto" },
});

export function Layout() {
  const styles = useStyles();
  const { mode, user, signOut } = useAuth();
  const items = NAV_ITEMS.filter((item) => user && hasAccess(user.roles, item.allowed));

  // Collapsible sidebar for presenting a single pane full-width; the choice
  // sticks per browser so the demo stays full-screen across reloads.
  const [navCollapsed, setNavCollapsed] = useState(loadNavCollapsed);
  const toggleNav = () =>
    setNavCollapsed((prev) => {
      saveNavCollapsed(!prev);
      return !prev;
    });

  return (
    <div className={mergeClasses(styles.root, navCollapsed && styles.rootNavCollapsed)}>
      <header className={styles.header}>
        <Tooltip
          content={navCollapsed ? "Show navigation" : "Hide navigation"}
          relationship="label"
        >
          <Button
            appearance="transparent"
            icon={<NavigationRegular />}
            style={{ color: "inherit", minWidth: 0 }}
            aria-expanded={!navCollapsed}
            onClick={toggleNav}
          />
        </Tooltip>
        <div className={styles.brand}>
          <Title3 className={styles.brandName}>NORTH BAY PRODUCE</Title3>
          <Text size={200} className={styles.brandTag}>
            Farmer Owned
          </Text>
          <Text size={300} className={styles.headerUser}>
            · Grower Settlement
          </Text>
        </div>
        <Text className={styles.headerUser}>{user?.name}</Text>
        {user?.roles.map((role) => (
          <Badge key={role} appearance="outline" color="informative" style={{ color: "#c3d6e9" }}>
            {role}
          </Badge>
        ))}
        {mode === "entra" && (
          <Button appearance="transparent" style={{ color: "inherit" }} onClick={signOut}>
            Sign out
          </Button>
        )}
      </header>
      {!navCollapsed && (
        <nav className={styles.nav}>
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
