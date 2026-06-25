import { useEffect, useRef, useState } from "react";
import {
  Badge,
  Button,
  Input,
  Text,
  Title2,
  Title3,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import {
  ArrowExit24Regular,
  Gauge24Regular,
  ScanType24Regular,
  VehicleTruck24Regular,
  Wifi224Regular,
} from "@fluentui/react-icons";
import { useTableStyles } from "../components/tableStyles";

/**
 * Inbound Gate (RFID + scale simulation) — a Phase 4 capability surfaced early
 * for the demo (Docs/DECISIONS.md 0.16). A truck drives past the lane's RFID
 * reader; the tag resolves to a trailer whose load is pre-advised against a
 * grower contract, so the gate screen pre-populates with the load detail
 * (grower, contract, ship-from address, expected items). Arrival is stamped on
 * scan (editable), departure is captured on weigh-out, and the gross weight is
 * read from a Mettler Toledo truck scale.
 *
 * Self-contained: the load detail below is baked-in demo data and the RFID
 * trigger + scale are simulated client-side, so the screen works on its own
 * with no backend. Wiring the load lookup to live Dynamics 365 F&SC data (the
 * same shape served by /vendors, /contracts, /items) is a later step; the real
 * RFID reader and scale live behind the receiving edge agent (PLAN §5 — the
 * browser can't reach COM ports).
 */

// ── Load detail (stand-in for the FSC pre-advice; one entry per grower) ─────

interface GateItem {
  itemNumber: string;
  itemName: string;
  uom: string;
  ratePerUnit?: number;
  storageTemp: string | null;
  lotControlled: boolean;
}

interface GateGrower {
  vendorAccount: string;
  vendorName: string;
  contractNumber: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  paymentTerms: string;
  items: GateItem[];
}

const GROWERS: GateGrower[] = [
  {
    vendorAccount: "V-1001",
    vendorName: "Sunrise Berry Farms LLC",
    contractNumber: "CT-2026-0001",
    street: "1180 Riverside Dr",
    city: "Watsonville",
    state: "CA",
    zip: "95076",
    paymentTerms: "Net30",
    items: [
      { itemNumber: "STRAW-CONV", itemName: "Strawberries, Conventional", uom: "lb", ratePerUnit: 1.1, storageTemp: "33–36 °F", lotControlled: true },
      { itemNumber: "STRAW-ORG", itemName: "Strawberries, Organic", uom: "lb", ratePerUnit: 1.65, storageTemp: "33–36 °F", lotControlled: true },
    ],
  },
  {
    vendorAccount: "V-1004",
    vendorName: "Bluebird Orchards",
    contractNumber: "CT-2026-0007",
    street: "3845 N Golden State Blvd",
    city: "Fresno",
    state: "CA",
    zip: "93722",
    paymentTerms: "Net30",
    items: [
      { itemNumber: "BLUE-CONV", itemName: "Blueberries, Conventional", uom: "lb", ratePerUnit: 2.25, storageTemp: "33–36 °F", lotControlled: true },
      { itemNumber: "APP-GALA", itemName: "Apples, Gala", uom: "lb", ratePerUnit: 0.58, storageTemp: "30–32 °F", lotControlled: true },
    ],
  },
  {
    vendorAccount: "V-1009",
    vendorName: "San Joaquin Stone Fruit Co.",
    contractNumber: "CT-2026-0014",
    street: "1450 E Manning Ave",
    city: "Reedley",
    state: "CA",
    zip: "93654",
    paymentTerms: "Net30",
    items: [
      { itemNumber: "PEACH-YEL", itemName: "Peaches, Yellow", uom: "lb", ratePerUnit: 0.65, storageTemp: "32–34 °F", lotControlled: true },
      { itemNumber: "NECT-WHT", itemName: "Nectarines, White", uom: "lb", ratePerUnit: 0.68, storageTemp: "32–34 °F", lotControlled: true },
      { itemNumber: "PLUM-BLK", itemName: "Plums, Black", uom: "lb", ratePerUnit: 0.62, storageTemp: "32–34 °F", lotControlled: true },
    ],
  },
  {
    vendorAccount: "V-1010",
    vendorName: "Delta Fresh Farms",
    contractNumber: "CT-2026-0016",
    street: "2800 Navy Dr",
    city: "Stockton",
    state: "CA",
    zip: "95206",
    paymentTerms: "Net30",
    items: [
      { itemNumber: "TOM-ROMA", itemName: "Tomatoes, Roma", uom: "lb", ratePerUnit: 0.52, storageTemp: "50–55 °F", lotControlled: true },
      { itemNumber: "TOM-CHERRY", itemName: "Tomatoes, Cherry", uom: "lb", ratePerUnit: 1.3, storageTemp: "50–55 °F", lotControlled: true },
      { itemNumber: "ONION-YEL", itemName: "Onions, Yellow", uom: "lb", ratePerUnit: 0.28, storageTemp: "Dry, 45–55 °F", lotControlled: true },
    ],
  },
  {
    vendorAccount: "V-1012",
    vendorName: "Sierra Gold Citrus Ranch",
    contractNumber: "CT-2026-0019",
    street: "330 N Kaweah Ave",
    city: "Exeter",
    state: "CA",
    zip: "93221",
    paymentTerms: "Net30",
    items: [
      { itemNumber: "ORNG-NAVL", itemName: "Oranges, Navel", uom: "lb", ratePerUnit: 0.4, storageTemp: "38–46 °F", lotControlled: true },
      { itemNumber: "LEMON-EUR", itemName: "Lemons", uom: "lb", ratePerUnit: 0.55, storageTemp: "50–55 °F", lotControlled: true },
      { itemNumber: "MAND-CLEM", itemName: "Mandarins, Clementine", uom: "lb", ratePerUnit: 0.85, storageTemp: "40–44 °F", lotControlled: true },
    ],
  },
  {
    vendorAccount: "V-1013",
    vendorName: "Lodi Vine & Row",
    contractNumber: "CT-2026-0021",
    street: "1375 E Turner Rd",
    city: "Lodi",
    state: "CA",
    zip: "95240",
    paymentTerms: "Net30",
    items: [
      { itemNumber: "GRAPE-RED", itemName: "Grapes, Red Seedless", uom: "lb", ratePerUnit: 0.95, storageTemp: "31–32 °F", lotControlled: true },
      { itemNumber: "GRAPE-GRN", itemName: "Grapes, Green Seedless", uom: "lb", ratePerUnit: 0.92, storageTemp: "31–32 °F", lotControlled: true },
    ],
  },
  {
    vendorAccount: "V-1011",
    vendorName: "Kern County Potato Growers",
    contractNumber: "CT-2026-0017",
    street: "501 Lerdo Hwy",
    city: "Shafter",
    state: "CA",
    zip: "93263",
    paymentTerms: "Net45",
    items: [
      { itemNumber: "POT-RUSS", itemName: "Potatoes, Russet", uom: "lb", ratePerUnit: 0.22, storageTemp: "Dark, 45–50 °F", lotControlled: true },
      { itemNumber: "POT-RED", itemName: "Potatoes, Red", uom: "lb", ratePerUnit: 0.3, storageTemp: "Dark, 45–50 °F", lotControlled: true },
    ],
  },
  {
    vendorAccount: "V-1008",
    vendorName: "Willamette Valley Berries",
    contractNumber: "CT-2026-0012",
    street: "3350 Silverton Rd NE",
    city: "Salem",
    state: "OR",
    zip: "97301",
    paymentTerms: "Net15",
    items: [
      { itemNumber: "BLUE-CONV", itemName: "Blueberries, Conventional", uom: "lb", ratePerUnit: 2.25, storageTemp: "33–36 °F", lotControlled: true },
      { itemNumber: "RASP-CONV", itemName: "Raspberries, Conventional", uom: "lb", ratePerUnit: 2.6, storageTemp: "33–36 °F", lotControlled: true },
    ],
  },
];

// ── Gate ticket (lives in session state; persistence arrives with Phase 4) ──

interface InboundTicket {
  id: string;
  scanNumber: string;
  rfidTag: string;
  trailerId: string;
  carrierName: string;
  carrierScac: string;
  dockDoor: string;
  vendorAccount: string;
  vendorName: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  paymentTerms: string;
  contractNumber: string;
  items: GateItem[];
  arrival: number; // epoch ms, editable
  departure: number | null; // epoch ms, captured on weigh-out, editable
  grossWeightLb: number; // captured at arrival (loaded)
  grossReads: number; // bumps on re-read to retrigger the settle animation
  tareWeightLb: number | null; // captured at departure (empty)
  status: "AtDock" | "Departed";
}

// ── Simulated hardware / identifiers ────────────────────────────────────────

const CARRIERS = [
  { name: "Swift Transportation", scac: "SWFT" },
  { name: "Knight Transportation", scac: "KNX" },
  { name: "J.B. Hunt", scac: "JBHT" },
  { name: "Werner Enterprises", scac: "WERN" },
  { name: "Prime Inc.", scac: "PRME" },
  { name: "C.R. England", scac: "CREN" },
  { name: "Central Valley Reefer", scac: "CVRF" },
];

const SCALE_DIVISION = 20; // Mettler Toledo truck scales read to ~20 lb

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

function hex(len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s.toUpperCase();
}

/** SGTIN-96-ish EPC the reader would hand back. */
function randomEpc(): string {
  return `30 ${hex(2)} ${hex(8)} ${hex(8)} ${hex(4)}`;
}

function randomTrailerId(): string {
  return `TRLR-${randInt(48000, 49999)}`;
}

/** Loaded produce semi — legal GVW caps at 80,000 lb. */
function randomGrossLb(): number {
  return roundTo(randInt(68000, 79000), SCALE_DIVISION);
}

/** Empty tractor + reefer trailer. */
function randomTareLb(): number {
  return roundTo(randInt(30000, 34500), SCALE_DIVISION);
}

// ── Date/number formatting ──────────────────────────────────────────────────

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** epoch ms → "YYYY-MM-DDTHH:mm" in local time for <input type="datetime-local">. */
function toLocalInput(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fromLocalInput(value: string): number | null {
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function formatClock(ms: number): string {
  return new Date(ms).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function lb(n: number): string {
  return `${n.toLocaleString()} lb`;
}

// ── Styles ──────────────────────────────────────────────────────────────────

const useStyles = makeStyles({
  intro: { maxWidth: "880px", marginTop: "8px" },
  toolbar: {
    display: "flex",
    gap: "16px",
    alignItems: "center",
    margin: "16px 0 4px",
    flexWrap: "wrap",
  },
  reader: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    color: tokens.colorPaletteGreenForeground1,
    fontSize: tokens.fontSizeBase200,
  },
  readerDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    backgroundColor: tokens.colorPaletteGreenBackground3,
    boxShadow: `0 0 6px ${tokens.colorPaletteGreenBackground3}`,
  },
  empty: {
    marginTop: "20px",
    padding: "40px",
    textAlign: "center",
    border: `1px dashed ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    color: tokens.colorNeutralForeground3,
  },
  card: {
    marginTop: "20px",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    boxShadow: tokens.shadow4,
    overflow: "hidden",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "14px 20px",
    backgroundColor: tokens.colorNeutralBackground2,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    flexWrap: "wrap",
  },
  trailerId: { fontWeight: tokens.fontWeightSemibold, fontSize: tokens.fontSizeBase500 },
  headerSpacer: { flexGrow: 1 },
  epc: {
    fontFamily: "'Consolas','SFMono-Regular',ui-monospace,monospace",
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  body: {
    display: "grid",
    gridTemplateColumns: "1.3fr 1fr",
    gap: "24px",
    padding: "20px",
    "@media (max-width: 900px)": { gridTemplateColumns: "1fr" },
  },
  sectionLabel: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: tokens.colorBrandForeground1,
    marginBottom: "8px",
  },
  meta: {
    display: "grid",
    gridTemplateColumns: "max-content 1fr",
    columnGap: "20px",
    rowGap: "5px",
    marginBottom: "20px",
  },
  metaLabel: { color: tokens.colorNeutralForeground3 },
  // Mettler Toledo terminal skin (deliberate device look — not themed tokens).
  scale: {
    background: "linear-gradient(180deg,#0d1f17,#0a1711)",
    border: "1px solid #1c4733",
    borderRadius: "10px",
    padding: "14px 16px 12px",
    color: "#bff5d8",
    marginBottom: "16px",
  },
  scaleTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "11px",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "#5fae8c",
  },
  pill: {
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    padding: "2px 8px",
    borderRadius: "10px",
  },
  pillStable: { color: "#0a1711", backgroundColor: "#39ff95" },
  pillMotion: { color: "#0a1711", backgroundColor: "#ffcf4d" },
  grossValue: {
    fontFamily: "'Consolas','SFMono-Regular',ui-monospace,monospace",
    fontSize: "40px",
    fontWeight: 700,
    lineHeight: 1.1,
    color: "#39ff95",
    textShadow: "0 0 10px rgba(57,255,149,0.45)",
    margin: "6px 0 0",
  },
  grossUnit: { fontSize: "16px", color: "#5fae8c", marginLeft: "6px" },
  modeLabel: { fontSize: "11px", letterSpacing: "0.06em", color: "#5fae8c" },
  scaleSplit: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    marginTop: "12px",
    borderTop: "1px solid #1c4733",
    paddingTop: "10px",
  },
  splitValue: {
    fontFamily: "'Consolas','SFMono-Regular',ui-monospace,monospace",
    fontSize: "20px",
    fontWeight: 700,
    color: "#bff5d8",
  },
  splitPending: { fontSize: "13px", color: "#5fae8c", fontStyle: "italic" },
  scaleFoot: { fontSize: "10px", color: "#3f7c61", marginTop: "10px", letterSpacing: "0.03em" },
  timing: {
    display: "grid",
    gridTemplateColumns: "max-content 1fr",
    columnGap: "16px",
    rowGap: "10px",
    alignItems: "center",
  },
  timingLabel: { color: tokens.colorNeutralForeground3 },
  actions: { display: "flex", gap: "10px", marginTop: "18px", flexWrap: "wrap" },
  pending: { color: tokens.colorNeutralForeground3, fontStyle: "italic" },
  logHead: { marginTop: "32px", marginBottom: "8px" },
  activeRow: { backgroundColor: tokens.colorBrandBackground2 },
  rowLink: { cursor: "pointer" },
});

// ── Scale readout (settles from motion → stable like a real terminal) ───────

function GrossReadout({ valueLb, nonce }: { valueLb: number; nonce: number }) {
  const styles = useStyles();
  const [display, setDisplay] = useState(valueLb);
  const [stable, setStable] = useState(true);

  useEffect(() => {
    setStable(false);
    let tick = 0;
    const total = 16;
    const id = window.setInterval(() => {
      tick += 1;
      if (tick >= total) {
        setDisplay(valueLb);
        setStable(true);
        window.clearInterval(id);
      } else {
        const amp = 900 * (1 - tick / total);
        setDisplay(roundTo(Math.max(0, valueLb + (Math.random() * 2 - 1) * amp), SCALE_DIVISION));
      }
    }, 80);
    return () => window.clearInterval(id);
  }, [valueLb, nonce]);

  return (
    <div className={styles.scale}>
      <div className={styles.scaleTop}>
        <span>Mettler Toledo IND570 · Truck Scale 02</span>
        <span className={`${styles.pill} ${stable ? styles.pillStable : styles.pillMotion}`}>
          {stable ? "STABLE" : "~ MOTION"}
        </span>
      </div>
      <div className={styles.modeLabel}>GROSS</div>
      <div className={styles.grossValue}>
        {display.toLocaleString()}
        <span className={styles.grossUnit}>lb</span>
      </div>
      <div className={styles.scaleFoot}>
        Division d = {SCALE_DIVISION} lb · Capacity 200,000 lb · Reefer lane 1
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export function InboundGatePage() {
  const styles = useStyles();
  const table = useTableStyles();

  const [tickets, setTickets] = useState<InboundTicket[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const seqRef = useRef(0);

  function simulateScan() {
    const grower = pick(GROWERS);
    const carrier = pick(CARRIERS);

    const onTruck = [...grower.items]
      .sort(() => Math.random() - 0.5)
      .slice(0, randInt(1, Math.min(3, grower.items.length)));

    seqRef.current += 1;
    const now = Date.now();
    const d = new Date(now);
    const scanNumber = `GATE-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${String(
      seqRef.current
    ).padStart(3, "0")}`;

    const ticket: InboundTicket = {
      id: `${now}-${seqRef.current}`,
      scanNumber,
      rfidTag: randomEpc(),
      trailerId: randomTrailerId(),
      carrierName: carrier.name,
      carrierScac: carrier.scac,
      dockDoor: `Door ${randInt(1, 14)}`,
      vendorAccount: grower.vendorAccount,
      vendorName: grower.vendorName,
      street: grower.street,
      city: grower.city,
      state: grower.state,
      zip: grower.zip,
      paymentTerms: grower.paymentTerms,
      contractNumber: grower.contractNumber,
      items: onTruck,
      arrival: now,
      departure: null,
      grossWeightLb: randomGrossLb(),
      grossReads: 1,
      tareWeightLb: null,
      status: "AtDock",
    };
    setTickets((prev) => [ticket, ...prev]);
    setActiveId(ticket.id);
  }

  function updateTicket(id: string, fn: (t: InboundTicket) => InboundTicket) {
    setTickets((prev) => prev.map((t) => (t.id === id ? fn(t) : t)));
  }

  function reReadScale(id: string) {
    updateTicket(id, (t) =>
      t.status === "AtDock"
        ? { ...t, grossWeightLb: randomGrossLb(), grossReads: t.grossReads + 1 }
        : t
    );
  }

  function captureDeparture(id: string) {
    updateTicket(id, (t) =>
      t.status === "AtDock"
        ? { ...t, departure: Date.now(), tareWeightLb: randomTareLb(), status: "Departed" }
        : t
    );
  }

  const active = tickets.find((t) => t.id === activeId) ?? tickets[0] ?? null;

  return (
    <div>
      <Title2>Inbound Gate</Title2>
      <Text block className={styles.intro}>
        Trucks are read by the lane's RFID scanner as they roll past. Each tag resolves to a
        pre-advised load, so the gate screen pre-fills the load detail — grower, contract, ship-from
        address and expected items — and captures the weigh-in. The RFID reader and the Mettler
        Toledo truck scale are simulated here (the real devices run behind the receiving edge
        agent); the load detail is demo data, ready to be wired to live Dynamics 365 F&amp;SC later.
      </Text>

      <div className={styles.toolbar}>
        <Button appearance="primary" icon={<ScanType24Regular />} onClick={simulateScan}>
          Simulate truck RFID scan
        </Button>
        <span className={styles.reader}>
          <Wifi224Regular />
          <span className={styles.readerDot} />
          RFID reader · Impinj R700 · Lane 1 · Online
        </span>
        {tickets.length > 0 && (
          <Text className={table.muted}>{tickets.length} scanned this session</Text>
        )}
      </div>

      {!active ? (
        <div className={styles.empty}>
          <VehicleTruck24Regular style={{ fontSize: 32 }} />
          <Text block style={{ marginTop: 8 }}>
            No truck at the gate. Press <b>Simulate truck RFID scan</b> to trigger a read.
          </Text>
        </div>
      ) : (
        <TicketCard
          ticket={active}
          onReRead={() => reReadScale(active.id)}
          onDepart={() => captureDeparture(active.id)}
          onArrival={(ms) => updateTicket(active.id, (t) => ({ ...t, arrival: ms }))}
          onDeparture={(ms) => updateTicket(active.id, (t) => ({ ...t, departure: ms }))}
        />
      )}

      {tickets.length > 0 && (
        <>
          <Title3 className={styles.logHead} block>
            Gate activity this session
          </Title3>
          <table className={table.table}>
            <thead>
              <tr>
                <th className={table.cell}>Arrived</th>
                <th className={table.cell}>Scan #</th>
                <th className={table.cell}>Trailer</th>
                <th className={table.cell}>Carrier</th>
                <th className={table.cell}>Grower</th>
                <th className={table.cell}>Contract</th>
                <th className={`${table.cell} ${table.num}`}>Gross</th>
                <th className={`${table.cell} ${table.num}`}>Net</th>
                <th className={table.cell}>Status</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => {
                const net = t.tareWeightLb != null ? t.grossWeightLb - t.tareWeightLb : null;
                return (
                  <tr
                    key={t.id}
                    className={`${styles.rowLink} ${t.id === active?.id ? styles.activeRow : ""}`}
                    onClick={() => setActiveId(t.id)}
                  >
                    <td className={table.cell}>{formatClock(t.arrival)}</td>
                    <td className={table.cell}>{t.scanNumber}</td>
                    <td className={table.cell}>{t.trailerId}</td>
                    <td className={table.cell}>{t.carrierScac}</td>
                    <td className={table.cell}>{t.vendorName}</td>
                    <td className={table.cell}>{t.contractNumber}</td>
                    <td className={`${table.cell} ${table.num}`}>{lb(t.grossWeightLb)}</td>
                    <td className={`${table.cell} ${table.num}`}>{net != null ? lb(net) : "—"}</td>
                    <td className={table.cell}>
                      <Badge
                        appearance="tint"
                        color={t.status === "Departed" ? "success" : "warning"}
                      >
                        {t.status === "Departed" ? "Departed" : "At dock"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

// ── Ticket card (the gate "scan screen") ────────────────────────────────────

function TicketCard({
  ticket,
  onReRead,
  onDepart,
  onArrival,
  onDeparture,
}: {
  ticket: InboundTicket;
  onReRead: () => void;
  onDepart: () => void;
  onArrival: (ms: number) => void;
  onDeparture: (ms: number) => void;
}) {
  const styles = useStyles();
  const table = useTableStyles();
  const net = ticket.tareWeightLb != null ? ticket.grossWeightLb - ticket.tareWeightLb : null;
  const onSite = ticket.departure != null ? ticket.departure - ticket.arrival : null;

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <VehicleTruck24Regular />
        <span className={styles.trailerId}>{ticket.trailerId}</span>
        <Badge appearance="tint" color={ticket.status === "Departed" ? "success" : "warning"}>
          {ticket.status === "Departed" ? "Departed" : "At dock"}
        </Badge>
        <span className={table.muted}>
          {ticket.carrierName} ({ticket.carrierScac}) · {ticket.dockDoor}
        </span>
        <span className={styles.headerSpacer} />
        <span className={styles.epc}>
          {ticket.scanNumber} · EPC {ticket.rfidTag}
        </span>
      </div>

      <div className={styles.body}>
        {/* Left: load detail */}
        <div>
          <div className={styles.sectionLabel}>Load detail</div>
          <div className={styles.meta}>
            <Text className={styles.metaLabel}>Grower</Text>
            <Text>
              {ticket.vendorName} ({ticket.vendorAccount})
            </Text>
            <Text className={styles.metaLabel}>Contract</Text>
            <Text>{ticket.contractNumber}</Text>
            <Text className={styles.metaLabel}>Ship-from</Text>
            <Text>
              {ticket.street}
              <br />
              {ticket.city}, {ticket.state} {ticket.zip}
            </Text>
            <Text className={styles.metaLabel}>Terms</Text>
            <Text>{ticket.paymentTerms}</Text>
          </div>

          <div className={styles.sectionLabel}>Expected items</div>
          <table className={table.table}>
            <thead>
              <tr>
                <th className={table.cell}>Item</th>
                <th className={table.cell}>Description</th>
                <th className={table.cell}>UoM</th>
                <th className={`${table.cell} ${table.num}`}>Contract rate</th>
                <th className={table.cell}>Storage</th>
              </tr>
            </thead>
            <tbody>
              {ticket.items.map((it) => (
                <tr key={it.itemNumber}>
                  <td className={table.cell}>{it.itemNumber}</td>
                  <td className={table.cell}>
                    {it.itemName}
                    {it.lotControlled && (
                      <>
                        {" "}
                        <Badge appearance="outline" color="informative" size="small">
                          Lot tracked
                        </Badge>
                      </>
                    )}
                  </td>
                  <td className={table.cell}>{it.uom}</td>
                  <td className={`${table.cell} ${table.num}`}>
                    {it.ratePerUnit != null ? `$${it.ratePerUnit.toFixed(2)}/${it.uom}` : "—"}
                  </td>
                  <td className={table.cell}>{it.storageTemp ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right: scale + gate timing */}
        <div>
          <div className={styles.sectionLabel}>
            <Gauge24Regular style={{ fontSize: 16 }} /> Scale (weigh-in)
          </div>
          <GrossReadout valueLb={ticket.grossWeightLb} nonce={ticket.grossReads} />
          <div className={styles.scale}>
            <div className={styles.scaleSplit}>
              <div>
                <div className={styles.modeLabel}>TARE (weigh-out)</div>
                {ticket.tareWeightLb != null ? (
                  <div className={styles.splitValue}>{ticket.tareWeightLb.toLocaleString()}</div>
                ) : (
                  <div className={styles.splitPending}>pending departure</div>
                )}
              </div>
              <div>
                <div className={styles.modeLabel}>NET</div>
                {net != null ? (
                  <div className={styles.splitValue}>{net.toLocaleString()}</div>
                ) : (
                  <div className={styles.splitPending}>—</div>
                )}
              </div>
            </div>
          </div>

          <div className={styles.sectionLabel}>Gate timing</div>
          <div className={styles.timing}>
            <Text className={styles.timingLabel}>Arrival</Text>
            <Input
              type="datetime-local"
              value={toLocalInput(ticket.arrival)}
              onChange={(_, d) => {
                const ms = fromLocalInput(d.value);
                if (ms != null) onArrival(ms);
              }}
            />
            <Text className={styles.timingLabel}>Departure</Text>
            {ticket.departure != null ? (
              <Input
                type="datetime-local"
                value={toLocalInput(ticket.departure)}
                onChange={(_, d) => {
                  const ms = fromLocalInput(d.value);
                  if (ms != null) onDeparture(ms);
                }}
              />
            ) : (
              <Text className={styles.pending}>not yet departed</Text>
            )}
            <Text className={styles.timingLabel}>Time on site</Text>
            <Text>{onSite != null ? formatDuration(onSite) : "—"}</Text>
          </div>

          <div className={styles.actions}>
            {ticket.status === "AtDock" && (
              <>
                <Button appearance="primary" icon={<ArrowExit24Regular />} onClick={onDepart}>
                  Capture departure &amp; weigh-out
                </Button>
                <Button appearance="secondary" icon={<Gauge24Regular />} onClick={onReRead}>
                  Re-read scale
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
