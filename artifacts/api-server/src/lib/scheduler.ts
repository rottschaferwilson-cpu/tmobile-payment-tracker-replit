/**
 * Automatic late-fee scheduler.
 *
 * Fires on exactly the 10th of every month (UTC), checked hourly.
 *
 * Idempotency: uses the Google Sheets Transactions data as the durable
 * source of truth — if a `late_fee` record already exists for the current
 * month (whether from a scheduled or manual admin run) the scheduler skips.
 * This is safe across restarts and multi-instance deployments.
 *
 * In-process concurrency: an `isRunning` flag prevents simultaneous
 * invocations within the same process.
 */

import { logger } from "./logger";
import { applyLateFees, hasLateFeeThisMonth, getLastLateFeeDate } from "./googleSheets";

// ─── State ────────────────────────────────────────────────────────────────────

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the next 10th-of-the-month at midnight UTC after the current moment.
 */
export function nextScheduledDate(): Date {
  const now = new Date();
  const candidate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 10));
  if (candidate <= now) {
    candidate.setUTCMonth(candidate.getUTCMonth() + 1);
  }
  return candidate;
}

/**
 * Run the late-fee job, guarded against concurrent invocations within this
 * process. Durability against multi-instance / cross-restart races is
 * handled by the Sheet-based idempotency check in `tick()`.
 */
async function runLateFees(reason: string): Promise<void> {
  if (isRunning) {
    logger.warn({ reason }, "Late-fee job already in progress — skipping");
    return;
  }
  isRunning = true;
  logger.info({ reason }, "Running late fees");
  try {
    const result = await applyLateFees();
    logger.info(
      { applied: result.applied, skipped: result.skipped, totalFeesAdded: result.totalFeesAdded },
      "Late fees completed"
    );
  } catch (err) {
    logger.error({ err }, "Late fees failed");
  } finally {
    isRunning = false;
  }
}

/**
 * Tick: fires on exactly the 10th of the month (UTC).
 * Uses the Transactions sheet as the durable idempotency source so that
 * restarts, manual admin runs, and multi-instance deployments all share
 * the same truth about whether fees have been applied this month.
 */
async function tick(): Promise<void> {
  const now = new Date();
  if (now.getUTCDate() !== 10) return;

  // Check the Sheet — durable across restarts and processes
  const alreadyApplied = await hasLateFeeThisMonth();
  if (alreadyApplied) {
    logger.debug("Late fees already applied this month — skipping tick");
    return;
  }

  await runLateFees("scheduled-tick");
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface SchedulerStatus {
  lastAppliedAt: string | null;
  nextScheduledDate: string;
}

/**
 * Returns the scheduler status, reading the last-run time from the Sheet
 * so it reflects manual admin runs as well as scheduled runs.
 */
export async function getSchedulerStatus(): Promise<SchedulerStatus> {
  const lastAppliedAt = await getLastLateFeeDate();
  return {
    lastAppliedAt,
    nextScheduledDate: nextScheduledDate().toISOString(),
  };
}

/**
 * Initializes the late-fee scheduler. Call once on server startup.
 * Polls every hour; applies fees only on exactly the 10th of the month.
 */
export function initScheduler(): void {
  if (schedulerInterval) return;

  logger.info("Initializing late-fee scheduler");

  // Initial tick (no-op unless today is the 10th and fees haven't been applied)
  tick().catch((err) => logger.error({ err }, "Startup tick failed"));

  // Poll every hour
  schedulerInterval = setInterval(() => {
    tick().catch((err) => logger.error({ err }, "Hourly tick failed"));
  }, 60 * 60 * 1000);

  if (schedulerInterval.unref) schedulerInterval.unref();

  logger.info(
    { nextScheduledDate: nextScheduledDate().toISOString() },
    "Late-fee scheduler initialized"
  );
}
