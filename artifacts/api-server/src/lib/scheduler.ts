/**
 * Automatic late-fee scheduler.
 *
 * Runs on the 10th of every month at 12:01 AM.
 *
 * Idempotency guarantee (Task #4):
 *   The month+year of the last successful run is persisted to
 *   data/last-late-fee.txt.  If the server restarts on the 10th after fees
 *   have already been applied, the guard file prevents a second run.
 *
 * Catch-up logic:
 *   On startup we also check whether today is >= the 10th and fees have NOT
 *   yet been applied for this month — this handles the case where the server
 *   was down on the 10th.
 */

import cron from "node-cron";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { applyLateFees } from "./googleSheets";
import { logger } from "./logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../data");
const GUARD_FILE = path.join(DATA_DIR, "last-late-fee.txt");

// ── Helpers ──────────────────────────────────────────────────────────────────

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getLastRunKey(): string | null {
  try {
    if (fs.existsSync(GUARD_FILE)) {
      return fs.readFileSync(GUARD_FILE, "utf8").trim() || null;
    }
  } catch {
    // ignore
  }
  return null;
}

function recordRun(date: Date): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(GUARD_FILE, monthKey(date), "utf8");
  } catch (err) {
    logger.error({ err }, "Failed to write late-fee guard file");
  }
}

export function getSchedulerStatus(): {
  lastRunKey: string | null;
  nextRunDate: string;
} {
  const lastRunKey = getLastRunKey();
  // Next run: the 10th of next month if already ran this month, or the 10th
  // of this month if we haven't run yet and it hasn't passed yet.
  const now = new Date();
  const thisMonth10 = new Date(now.getFullYear(), now.getMonth(), 10);
  const nextMonth10 = new Date(now.getFullYear(), now.getMonth() + 1, 10);
  const alreadyRanThisMonth = lastRunKey === monthKey(now);
  const nextRun = alreadyRanThisMonth || now > thisMonth10 ? nextMonth10 : thisMonth10;
  return {
    lastRunKey,
    nextRunDate: nextRun.toISOString().split("T")[0],
  };
}

// ── Core run logic ────────────────────────────────────────────────────────────

async function runIfDue(reason: string): Promise<void> {
  const now = new Date();
  const currentKey = monthKey(now);
  const lastKey = getLastRunKey();

  if (lastKey === currentKey) {
    logger.info({ reason, currentKey }, "Late fees already applied this month — skipping");
    return;
  }

  logger.info({ reason, currentKey }, "Applying automatic monthly late fees");
  try {
    const result = await applyLateFees();
    recordRun(now);
    logger.info(
      { reason, applied: result.applied, skipped: result.skipped, totalFeesAdded: result.totalFeesAdded },
      "Automatic late fees applied successfully"
    );
  } catch (err) {
    logger.error({ err, reason }, "Automatic late fee application failed — will retry next startup");
    // Do NOT record the run so next startup/trigger retries
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function startScheduler(): void {
  // Schedule: 12:01 AM on the 10th of every month
  cron.schedule("1 0 10 * *", () => {
    runIfDue("cron-10th").catch((err) => {
      logger.error({ err }, "Unhandled error in late-fee cron");
    });
  });

  logger.info("Late-fee scheduler started — runs at 00:01 on the 10th of each month");

  // Catch-up: if today >= 10th and we haven't run this month yet, apply now
  const now = new Date();
  if (now.getDate() >= 10 && getLastRunKey() !== monthKey(now)) {
    logger.info("Catch-up: applying late fees for the current month (server was down on the 10th)");
    runIfDue("startup-catchup").catch((err) => {
      logger.error({ err }, "Unhandled error in catch-up late-fee run");
    });
  }
}
