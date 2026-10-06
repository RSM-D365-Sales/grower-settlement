/**
 * Single source of truth for the Grower Settlement booth video.
 *
 * Every other file in demo-kit/ derives from this one:
 *   record.mjs        — drives the app and records the tour, scene by scene,
 *                       holding each scene for exactly `seconds`
 *   write-script.mjs  — regenerates voiceover-script.md (timecodes + VO text)
 *                       and injects the script into the cheat sheet
 *   scratch-vo.mjs    — builds a Windows text-to-speech scratch track so the
 *                       narration can be checked against the picture
 *
 * Edit the copy or the timings here, then re-run the scripts. Don't hand-edit
 * voiceover-script.md.
 *
 * Pacing: a relaxed read is ~150 words a minute (2.5 words a second). Each
 * scene's VO should sit just under `seconds * 2.5` words so the narrator is
 * never racing the cut.
 */

export const VIDEO = {
  title: 'Grower Settlement',
  // Output file prefix: demo-kit/out/<slug>-tour.mp4, <slug>-cheat-sheet.html
  slug: 'grower-settlement',
  company: 'Bluestem Fresh Produce',
  // App one-liner from ../Blustem-company-details/PUN_BANK.md
  tagline: 'Pay growers right, every pool, every pick.',
  // Small caps line under the tagline on the end card
  strapline: 'Contracts · Receiving · Settlement · Payout',
  // What the title card between loop videos says this clip is
  interstitialSeconds: 12,
  frame: { width: 1920, height: 1080 },
}

export const SCENES = [
  {
    id: 'dashboard',
    seconds: 9,
    caption: 'Settlement dashboard',
    sub: 'Received, sold, collected and payable, by fiscal week',
    vo: 'Bluestem pays every grower from one screen: what came in, what sold, and what each grower is owed this week.',
    onScreen: 'KPI tiles for the current fiscal week, Previous period to the last posted week, then down to the weekly settlement run (one row per grower).',
  },
  {
    id: 'growers-items',
    seconds: 8,
    caption: 'Growers & items',
    sub: 'Master data from D365',
    // Sub-captions shown as the scene steps through the two master-data pages
    steps: [
      { caption: 'Vendors', sub: 'Twenty growers, each with flat-rate or commission contracts' },
      { caption: 'Items', sub: 'Lot-tracked products by commodity, with shelf life and storage' },
    ],
    vo: 'Growers and items come from D365, so contracts, receipts and settlements share one master.',
    onScreen: 'Vendors table with contract badges per grower, then the Items cards (commodity, lot tracked, shelf life, storage).',
  },
  {
    id: 'contracts',
    seconds: 8,
    caption: 'Contracts',
    sub: 'A flat rate per unit, or a commission on sales',
    vo: 'Each contract sets the terms: a flat rate per pound, or a commission on what the fruit sells for.',
    onScreen: 'Contract register; search "Castillo" to show one grower with both a flat-rate and a commission contract; open CT-2026-0002 for its lines and the receipts against it.',
  },
  {
    id: 'inbound-gate',
    seconds: 9,
    caption: 'Inbound Gate',
    sub: 'RFID read, load pre-filled, scale weight captured',
    vo: 'At the gate, an RFID read pulls up the load: grower, contract and items. The scale captures the weight.',
    onScreen: 'Simulated RFID scan fills the gate ticket (grower, contract, ship-from, expected items) while the truck-scale readout settles from motion to stable.',
  },
  {
    id: 'receiving-sales',
    seconds: 9,
    caption: 'Receiving & sales',
    sub: 'Receipts in, invoiced sales out',
    steps: [
      { caption: 'Receiving', sub: 'Every receipt: lot, contract and D365 purchase order' },
      { caption: 'Sales', sub: 'Invoiced orders drive the commission settlements' },
    ],
    vo: 'Every receipt carries its lot, contract and D365 purchase order. Invoiced sales feed the commission side.',
    onScreen: 'Receiving table widened to the last 7 days (lot, contract, D365 PO, status), then the Sales orders table.',
  },
  {
    id: 'settlement',
    seconds: 11,
    caption: 'Settlement',
    sub: 'Settlement register',
    steps: [
      { caption: 'Settlement', sub: 'Every settlement: gross, premiums, deductions, advances, commissions' },
      { caption: 'Pool settlement ST000078', sub: 'Three growers, one blueberry pool, every line behind the net' },
    ],
    vo: 'Settlement brings it together. Open a pool and every grower’s share is there: gross, premiums, deductions, advances, commission, and the net return.',
    onScreen: 'Settlement register; open pooled settlement ST000078 for the summary tiles and grower lines, then the Sales invoices, Premiums & deductions and Advances tabs.',
  },
  {
    id: 'statement',
    seconds: 8.5,
    caption: 'Grower statement',
    sub: 'One grower, one week, ready to send as a PDF',
    vo: 'Each grower gets a statement for the week, flat rate and commission on one page, ready to send as a PDF.',
    onScreen: 'From the weekly settlement run, open the Castillo Family Growers statement: settle-to block, fiscal period, net grower return, Download PDF, both contract sections.',
  },
  {
    id: 'end-card',
    seconds: 6.5,
    caption: 'Grower Settlement',
    sub: 'Pay growers right, every pool, every pick.',
    vo: 'Grower Settlement, powered by RSM. Pay growers right, every pool, every pick.',
    onScreen: 'Midnight end card: bluestem mark, Grower Settlement, tagline, Powered by RSM bottom-right.',
  },
]

export const TOTAL_SECONDS = SCENES.reduce((t, s) => t + s.seconds, 0)

/** Alternate openers from PUN_BANK.md — swap into scene 1 if the room wants a hook. */
export const ALT_OPENERS = [
  'Here’s a problem every produce company knows by heart: the fruit is sold, and the grower is still waiting on a number.',
  'Spreadsheets are where margins go to hide. Let’s go find them.',
]

export function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function fmtTime(sec) {
  const m = Math.floor(sec / 60)
  const s = sec - m * 60
  return `${m}:${s.toFixed(1).padStart(4, '0')}`
}
