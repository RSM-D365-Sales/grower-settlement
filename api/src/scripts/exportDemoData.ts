/**
 * Exports the demo seed + D365 fixtures as static JSON so the SPA can run
 * with no backend (VITE_DATA_MODE=static — used for the GitHub Pages demo).
 * Run after build:  node dist/src/scripts/exportDemoData.js <outDir>
 */
import { mkdirSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import vendors from "../d365/fixtures/vendors.json";
import products from "../d365/fixtures/products.json";
import commodities from "../d365/fixtures/commodities.json";
import units from "../d365/fixtures/units.json";
import { generateDemoData } from "../demo/seed";

const outDir = resolve(process.argv[2] ?? join(__dirname, "../../../../web/public/demo"));
mkdirSync(outDir, { recursive: true });

const demo = generateDemoData();
const files: Record<string, unknown> = {
  "vendors.json": vendors,
  "items.json": products,
  "commodities.json": commodities,
  "units.json": units,
  "contracts.json": demo.contracts,
  "receipts.json": demo.receipts,
  "salesorders.json": demo.salesOrders,
};

for (const [name, data] of Object.entries(files)) {
  writeFileSync(join(outDir, name), JSON.stringify(data));
}

console.log(
  `Exported ${Object.keys(files).length} demo data files to ${outDir} ` +
    `(generated for ${demo.generatedFor}: ${demo.contracts.length} contracts, ` +
    `${demo.receipts.length} receipts, ${demo.salesOrders.length} sales orders)`
);
