# Receipt-Post Message Contract (v0 — placeholder)

**Status: not yet defined.** This document becomes the versioned interface between the app and the
X++ team's custom message type + processor class in Phase 3 (Docs/PLAN.md §8 Phase 3, §2).

It will define:

- Message envelope (message type name, version, idempotency/correlation ids)
- Payload: D365 PO number, lines (line number, item, quantity, unit), lot/batch numbers, receipt date, warehouse/site
- Status round-trip: how the app polls the message status entity (or receives a business event), and the
  shape of success (product receipt number) and failure (D365 error log text) results
- Versioning and compatibility rules

Owner for the X++ side and target deployment date are open decision §10.6 in `Docs/PLAN.md`.
