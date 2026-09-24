/**
 * Bluestem-branded grower settlement statement PDF (Docs/DECISIONS.md 0.17, 0.20).
 * jsPDF + autotable are imported dynamically so the ~350 KB library loads only
 * when someone actually generates a statement. The document is a DEMO artifact:
 * every page carries a synthetic-data disclosure in the footer.
 */
import type { SettlementPreview } from "../api/settlementPreviewCalc";
import type { FiscalPeriod } from "./fiscalWeek";
import { periodRangeLabel, shortDate } from "./fiscalWeek";
import bluestemLogo from "../assets/brand/bluestem_logo_on_midnight.png";
import rsmLogoWhite from "../assets/brand/rsmus-logo-white.png";

export interface StatementVendor {
  vendorAccount: string;
  name: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  paymentTerms?: string;
  currency?: string;
}

export interface StatementInput {
  preview: SettlementPreview;
  vendor: StatementVendor;
  period: FiscalPeriod;
  settlementNumber: string;
  status: string;
}

// Bluestem Fresh Produce brand (BRAND_GUIDE.md — palette borrowed from rsmus.com).
const MIDNIGHT: [number, number, number] = [0, 21, 61];
const RSM_BLUE: [number, number, number] = [0, 156, 222];
const MID_GREY: [number, number, number] = [136, 139, 141];
const FOG: [number, number, number] = [242, 243, 244];
const INK: [number, number, number] = [11, 11, 11];
const MUTED: [number, number, number] = [82, 81, 78];

// Logo lockups are the brand PNGs. They are rasterized to roughly the size
// they are placed at (on a Midnight background, as JPEG) before embedding —
// jsPDF stores PNG pixels uncompressed, and the 2082px master alone would
// push the statement past 3 MB.
const LOGO_ON_MIDNIGHT = { url: bluestemLogo, w: 2082, h: 600 };
const RSM_LOGO_WHITE = { url: rsmLogoWhite, w: 250, h: 106 };

const DISCLOSURE =
  "DEMONSTRATION DOCUMENT — all figures are synthetic demo data. Not an invoice or payment advice. " +
  "Bluestem Fresh Produce is a fictional company created by RSM to showcase reporting concepts; not affiliated with or endorsed by Microsoft.";

function usd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** Draw an image onto a Midnight-filled canvas `width` pt wide (rendered at
 *  3× for print sharpness) and return it as a JPEG data URL. */
async function rasterizeOnMidnight(url: string, width: number, aspect: number): Promise<string> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Could not load ${url}`));
    img.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * 3);
  canvas.height = Math.round((width * 3) / aspect);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = `rgb(${MIDNIGHT.join(",")})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.9);
}

export async function buildStatementPdf(input: StatementInput): Promise<{ blob: Blob; filename: string }> {
  const logoH = 46;
  const logoW = (LOGO_ON_MIDNIGHT.w / LOGO_ON_MIDNIGHT.h) * logoH;
  const rsmH = 16;
  const rsmW = (RSM_LOGO_WHITE.w / RSM_LOGO_WHITE.h) * rsmH;

  const [{ jsPDF }, autoTableModule, logoData, rsmData] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    rasterizeOnMidnight(LOGO_ON_MIDNIGHT.url, logoW, LOGO_ON_MIDNIGHT.w / LOGO_ON_MIDNIGHT.h),
    rasterizeOnMidnight(RSM_LOGO_WHITE.url, rsmW, RSM_LOGO_WHITE.w / RSM_LOGO_WHITE.h),
  ]);
  const autoTable = autoTableModule.default;
  const { preview, vendor, period, settlementNumber, status } = input;

  const doc = new jsPDF({ unit: "pt", format: "letter", compress: true }); // 612 × 792 pt
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;

  // ── Header band (Midnight ribbon, bluestem logo left, RSM sponsor mark right) ──
  doc.setFillColor(...MIDNIGHT);
  doc.rect(0, 0, pageW, 84, "F");
  doc.setFillColor(...RSM_BLUE);
  doc.rect(0, 84, pageW, 3, "F");

  doc.addImage(logoData, "JPEG", margin - 8, 19, logoW, logoH);

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Grower Settlement Statement", pageW - margin, 34, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(settlementNumber, pageW - margin, 49, { align: "right" });

  doc.addImage(rsmData, "JPEG", pageW - margin - rsmW, 60, rsmW, rsmH);
  doc.setTextColor(201, 209, 219);
  doc.setFontSize(7.5);
  doc.text("Powered by", pageW - margin - rsmW - 4, 71, { align: "right" });

  // ── Meta block ───────────────────────────────────────────────────────────
  let y = 112;
  doc.setTextColor(...RSM_BLUE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("SETTLE TO (GROWER)", margin, y);
  doc.text("SETTLEMENT DETAILS", 330, y);

  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text(vendor.name, margin, y + 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const addr = [
    vendor.street,
    [vendor.city, vendor.state].filter(Boolean).join(", ") + (vendor.zip ? ` ${vendor.zip}` : ""),
    `Grower account ${vendor.vendorAccount}`,
  ].filter((line) => line && line.trim() !== "");
  addr.forEach((line, i) => doc.text(line!, margin, y + 30 + i * 13));

  const details: [string, string][] = [
    ["Fiscal period", `FY${period.fiscalYear} · P${period.period}`],
    ["Week", periodRangeLabel(period)],
    ["Week ending", shortDate(period.end) + `, ${period.fiscalYear}`],
    ["Status", status],
    ["Payment terms", vendor.paymentTerms ?? "Net30"],
    ["Currency", vendor.currency ?? "USD"],
  ];
  details.forEach(([label, value], i) => {
    const rowY = y + 16 + i * 13;
    doc.setTextColor(...MUTED);
    doc.text(label, 330, rowY);
    doc.setTextColor(...INK);
    doc.text(value, 430, rowY);
  });
  y += 16 + details.length * 13 + 14;

  // ── Contract sections ────────────────────────────────────────────────────
  for (const section of preview.sections) {
    if (section.transactions.length === 0) continue;
    const isReceipts = section.basis === "Receipts";

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...MIDNIGHT);
    doc.text(
      `Contract ${section.contractNumber} — ${isReceipts ? "Receipt-based (flat rate)" : "Sales-invoice based (commission)"}`,
      margin,
      y
    );
    y += 6;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      styles: { font: "helvetica", fontSize: 8.5, textColor: INK, cellPadding: 4 },
      headStyles: { fillColor: MIDNIGHT, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: FOG },
      head: [
        isReceipts
          ? ["Item", "Qty received", "UoM", "Rate", "Amount payable"]
          : ["Item", "Qty sold", "Revenue", "Comm %", "Commission", "Net to grower"],
      ],
      body: section.items.map((item) =>
        isReceipts
          ? [
              item.itemName,
              item.quantity.toLocaleString("en-US"),
              item.uom,
              `$${(item.ratePerUnit ?? 0).toFixed(2)}/${item.uom}`,
              usd(item.estimatedPayable),
            ]
          : [
              item.itemName,
              `${item.quantity.toLocaleString("en-US")} ${item.uom}`,
              usd(item.grossAmount),
              `${(item.commissionPercent ?? 0).toFixed(1)}%`,
              `-${usd(item.commissionAmount)}`,
              usd(item.estimatedPayable),
            ]
      ),
      foot: [
        isReceipts
          ? ["Subtotal", "", "", "", usd(section.estimatedPayable)]
          : [
              "Subtotal",
              "",
              usd(section.grossAmount),
              "",
              `-${usd(section.commissionAmount)}`,
              usd(section.estimatedPayable),
            ],
      ],
      footStyles: { fillColor: [255, 255, 255], textColor: INK, fontStyle: "bold" },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    const docsLine = `${section.eligibleCount} ${isReceipts ? "posted receipts" : "invoiced sales orders"} settled${
      section.excludedCount > 0
        ? ` · ${section.excludedCount} ${isReceipts ? "open receipts" : "uninvoiced orders"} excluded from this run`
        : ""
    }`;
    doc.text(docsLine, margin, y);
    y += 22;
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  const gross = preview.sections.reduce((s, x) => s + x.grossAmount, 0);
  const commission = preview.sections.reduce((s, x) => s + x.commissionAmount, 0);
  if (y > 640) {
    doc.addPage();
    y = 60;
  }
  autoTable(doc, {
    startY: y,
    margin: { left: 330, right: margin },
    styles: { font: "helvetica", fontSize: 9.5, cellPadding: 5 },
    theme: "plain",
    body: [
      ["Gross payable", usd(Math.round(gross * 100) / 100)],
      ["Commission", commission > 0 ? `-${usd(Math.round(commission * 100) / 100)}` : usd(0)],
    ],
    columnStyles: { 0: { textColor: MUTED }, 1: { halign: "right", textColor: INK } },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  doc.setFillColor(...MIDNIGHT);
  doc.rect(330, y + 4, pageW - margin - 330, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text("Net grower return", 338, y + 21);
  doc.text(usd(preview.totalEstimatedPayable), pageW - margin - 8, y + 21, { align: "right" });

  // ── Footer on every page ─────────────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const h = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...MID_GREY);
    doc.setLineWidth(0.5);
    doc.line(margin, h - 46, pageW - margin, h - 46);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(doc.splitTextToSize(DISCLOSURE, pageW - margin * 2 - 60), margin, h - 34);
    doc.text(`Page ${i} of ${pages}`, pageW - margin, h - 34, { align: "right" });
  }

  const filename = `Bluestem_Settlement_FY${period.fiscalYear}-P${String(period.period).padStart(2, "0")}_${vendor.vendorAccount}.pdf`;
  return { blob: doc.output("blob"), filename };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
