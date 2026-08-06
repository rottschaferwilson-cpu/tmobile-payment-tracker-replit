---
name: Late-fee scheduler
description: How the automatic late-fee scheduler works and where idempotency state lives.
---

# Late-fee scheduler

Implemented in `artifacts/api-server/src/lib/scheduler.ts`.

**Rule:** node-cron fires at `1 0 10 * *` (12:01 AM on the 10th of each month).  
**Catch-up:** On startup, if today >= 10th and the guard file does not record the current month, fees run immediately.  
**Idempotency:** Last-run month+year is stored in `artifacts/api-server/data/last-late-fee.txt` as `YYYY-MM`. If the file already contains the current month, the run is skipped. This prevents double-billing when the server restarts on the 10th.

**Why:** Guard-file approach is simpler than querying the Transactions sheet for existing late_fee rows; avoids extra Sheets API calls on every startup.

**How to apply:** Any change to the scheduler logic must also consider the guard file. If you want to force a re-run for a month, delete or edit `last-late-fee.txt`. The manual "Apply Late Fees" button in the Admin UI does NOT update the guard file — it is intentionally an override so the admin can apply fees outside the scheduled date without blocking the automatic run.

**Status endpoint:** `GET /api/admin/scheduler-status` returns `{ lastRunKey, nextRunDate }`. Shown on the Admin page in a blue banner.
