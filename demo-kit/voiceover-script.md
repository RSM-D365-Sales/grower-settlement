# Grower Settlement — booth video voice-over

*Generated from `demo-kit/scenes.mjs` by `write-script.mjs`. Edit the source, not this file.*

| | |
|---|---|
| Clip | Grower Settlement (Bluestem Fresh Produce) |
| Running time | **1:09.0** (69 s) |
| Narration | 143 words · 124 wpm average |
| Picture | `demo-kit/out/grower-settlement-tour.mp4` (1920×1080, 30 fps) |
| Title card between clips | `demo-kit/interstitial.html` → `demo-kit/out/interstitial.mp4` (12 s) |

Read it warm and unhurried. Each scene's narration is sized to finish about half a
second before the cut, so if you land early, hold the pause; don't fill it.
Say "D365" as *dee-three-sixty-five*, "RFID" and "PDF" letter by letter, and give
the list in scene 6 (gross, premiums, deductions, advances, commission) one beat each.

## Timed script

| # | Time | Scene | Narration | Words |
|---|---|---|---|---|
| 1 | 0:00.0 – 0:09.0 | **Settlement dashboard** | Bluestem pays every grower from one screen: what came in, what sold, and what each grower is owed this week. | 20 (133 wpm) |
| 2 | 0:09.0 – 0:17.0 | **Growers & items** | Growers and items come from D365, so contracts, receipts and settlements share one master. | 14 (105 wpm) |
| 3 | 0:17.0 – 0:25.0 | **Contracts** | Each contract sets the terms: a flat rate per pound, or a commission on what the fruit sells for. | 19 (143 wpm) |
| 4 | 0:25.0 – 0:34.0 | **Inbound Gate** | At the gate, an RFID read pulls up the load: grower, contract and items. The scale captures the weight. | 19 (127 wpm) |
| 5 | 0:34.0 – 0:43.0 | **Receiving & sales** | Every receipt carries its lot, contract and D365 purchase order. Invoiced sales feed the commission side. | 16 (107 wpm) |
| 6 | 0:43.0 – 0:54.0 | **Settlement** | Settlement brings it together. Open a pool and every grower’s share is there: gross, premiums, deductions, advances, commission, and the net return. | 22 (120 wpm) |
| 7 | 0:54.0 – 1:02.5 | **Grower statement** | Each grower gets a statement for the week, flat rate and commission on one page, ready to send as a PDF. | 21 (148 wpm) |
| 8 | 1:02.5 – 1:09.0 | **Grower Settlement** | Grower Settlement, powered by RSM. Pay growers right, every pool, every pick. | 12 (111 wpm) |

## Scene by scene

### 1. Settlement dashboard · 0:00.0 – 0:09.0 (9 s)

**On screen:** KPI tiles for the current fiscal week, Previous period to the last posted week, then down to the weekly settlement run (one row per grower).

**Lower-third caption:** Settlement dashboard — *Received, sold, collected and payable, by fiscal week*

**Narration:**

> Bluestem pays every grower from one screen: what came in, what sold, and what each grower is owed this week.

### 2. Growers & items · 0:09.0 – 0:17.0 (8 s)

**On screen:** Vendors table with contract badges per grower, then the Items cards (commodity, lot tracked, shelf life, storage).

**Lower-third caption:** Vendors — *Twenty growers, each with flat-rate or commission contracts* → Items — *Lot-tracked products by commodity, with shelf life and storage*

**Narration:**

> Growers and items come from D365, so contracts, receipts and settlements share one master.

### 3. Contracts · 0:17.0 – 0:25.0 (8 s)

**On screen:** Contract register; search "Castillo" to show one grower with both a flat-rate and a commission contract; open CT-2026-0002 for its lines and the receipts against it.

**Lower-third caption:** Contracts — *A flat rate per unit, or a commission on sales*

**Narration:**

> Each contract sets the terms: a flat rate per pound, or a commission on what the fruit sells for.

### 4. Inbound Gate · 0:25.0 – 0:34.0 (9 s)

**On screen:** Simulated RFID scan fills the gate ticket (grower, contract, ship-from, expected items) while the truck-scale readout settles from motion to stable.

**Lower-third caption:** Inbound Gate — *RFID read, load pre-filled, scale weight captured*

**Narration:**

> At the gate, an RFID read pulls up the load: grower, contract and items. The scale captures the weight.

### 5. Receiving & sales · 0:34.0 – 0:43.0 (9 s)

**On screen:** Receiving table widened to the last 7 days (lot, contract, D365 PO, status), then the Sales orders table.

**Lower-third caption:** Receiving — *Every receipt: lot, contract and D365 purchase order* → Sales — *Invoiced orders drive the commission settlements*

**Narration:**

> Every receipt carries its lot, contract and D365 purchase order. Invoiced sales feed the commission side.

### 6. Settlement · 0:43.0 – 0:54.0 (11 s)

**On screen:** Settlement register; open pooled settlement ST000078 for the summary tiles and grower lines, then the Sales invoices, Premiums & deductions and Advances tabs.

**Lower-third caption:** Settlement — *Every settlement: gross, premiums, deductions, advances, commissions* → Pool settlement ST000078 — *Three growers, one blueberry pool, every line behind the net*

**Narration:**

> Settlement brings it together. Open a pool and every grower’s share is there: gross, premiums, deductions, advances, commission, and the net return.

### 7. Grower statement · 0:54.0 – 1:02.5 (8.5 s)

**On screen:** From the weekly settlement run, open the Castillo Family Growers statement: settle-to block, fiscal period, net grower return, Download PDF, both contract sections.

**Lower-third caption:** Grower statement — *One grower, one week, ready to send as a PDF*

**Narration:**

> Each grower gets a statement for the week, flat rate and commission on one page, ready to send as a PDF.

### 8. Grower Settlement · 1:02.5 – 1:09.0 (6.5 s)

**On screen:** Midnight end card: bluestem mark, Grower Settlement, tagline, Powered by RSM bottom-right.

**Lower-third caption:** Grower Settlement — *Pay growers right, every pool, every pick.*

**Narration:**

> Grower Settlement, powered by RSM. Pay growers right, every pool, every pick.


## Alternate openers

If the room wants a hook before scene 1, swap one of these in and trim the
first sentence of scene 1 to fit (each adds ~5 s; keep the clip under 75 s):

- Here’s a problem every produce company knows by heart: the fruit is sold, and the grower is still waiting on a number.
- Spreadsheets are where margins go to hide. Let’s go find them.

## Recording notes

- The picture is recorded by `node demo-kit/record.mjs`; scene boundaries land on the
  timecodes above because the recorder holds each scene for exactly its budgeted seconds.
  `demo-kit/out/tour-timings.json` has the measured boundaries from the last run.
- `node demo-kit/scratch-vo.mjs` lays a Windows text-to-speech scratch read over the
  picture (`grower-settlement-tour-scratch-vo.mp4`) so timing can be checked before a real voice is recorded.
- Record the real voice-over as one take against the picture, or scene by scene and align
  each clip to its start timecode. Leave the last 0.5 s of every scene silent.
- Captions are burned in (bottom-left lower-third). On a muted show floor they carry the
  story alone; the voice-over is for the recorded social cut and anyone wearing headphones.
