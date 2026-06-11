import { makeStyles, tokens } from "@fluentui/react-components";

/** Shared list-page styling: toolbar row + plain data table. */
export const useTableStyles = makeStyles({
  toolbar: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    margin: "16px 0",
    flexWrap: "wrap",
  },
  table: { borderCollapse: "collapse", width: "100%" },
  cell: {
    textAlign: "left",
    padding: "8px 12px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeBase300,
    verticalAlign: "top",
  },
  num: { textAlign: "right" },
  muted: { color: tokens.colorNeutralForeground3 },
  link: {
    color: tokens.colorBrandForegroundLink,
    textDecorationLine: "none",
    ":hover": { textDecorationLine: "underline" },
  },
});
