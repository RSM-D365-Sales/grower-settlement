import { useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  Text,
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
import { BLUESTEM, HEADING_FONT } from "../theme";
import bluestemLogo from "../assets/brand/bluestem_logo_on_midnight.png";
import rsmLogo from "../assets/brand/rsmus-logo-white.png";

// Header follows the Bluestem app-header pattern (BRAND_GUIDE.md): 48px
// Midnight ribbon, bluestem logo left, app name in Poppins, "Powered by" +
// RSM sponsor mark at the right end immediately left of the user avatar.
const useStyles = makeStyles({
  root: {
    display: "grid",
    gridTemplateRows: "48px 1fr",
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
    backgroundColor: BLUESTEM.midnight,
    color: "#ffffff",
  },
  brand: { display: "flex", alignItems: "center", gap: "12px", flexGrow: 1, minWidth: 0 },
  // The on-Midnight PNG carries its own clear space, so 36px shows the wordmark
  // at roughly the guide's 28px.
  brandLogo: { height: "36px", width: "auto", display: "block" },
  appName: {
    color: "#ffffff",
    fontFamily: HEADING_FONT,
    fontWeight: 600,
    fontSize: "16px",
    lineHeight: "1",
    whiteSpace: "nowrap",
    paddingLeft: "12px",
    borderLeft: `1px solid ${BLUESTEM.onMidnightMuted}`,
  },
  headerUser: { color: "#ffffff", whiteSpace: "nowrap" },
  divider: { width: "1px", height: "24px", backgroundColor: BLUESTEM.onMidnightMuted, opacity: 0.6 },
  sponsor: { display: "flex", alignItems: "center", gap: "6px" },
  sponsorLabel: { color: BLUESTEM.onMidnightMuted, fontSize: "11px", whiteSpace: "nowrap" },
  sponsorLogo: { height: "22px", width: "auto", display: "block" },
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
    backgroundColor: BLUESTEM.lightSky,
    color: BLUESTEM.midnight,
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
          <img src={bluestemLogo} alt="bluestem Fresh Produce" className={styles.brandLogo} />
          <span className={styles.appName}>Grower Settlement</span>
        </div>
        {user?.roles.map((role) => (
          <Badge
            key={role}
            appearance="outline"
            color="informative"
            style={{ color: BLUESTEM.onMidnightMuted }}
          >
            {role}
          </Badge>
        ))}
        <span className={styles.divider} aria-hidden />
        <span className={styles.sponsor}>
          <span className={styles.sponsorLabel}>Powered by</span>
          <img src={rsmLogo} alt="RSM" className={styles.sponsorLogo} />
        </span>
        {user && (
          <>
            <Avatar name={user.name} size={28} color="colorful" />
            <Text className={styles.headerUser}>{user.name}</Text>
          </>
        )}
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
