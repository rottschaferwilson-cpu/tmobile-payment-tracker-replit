import { Router, type IRouter } from "express";
import {
  ApplyLateFeesResponse,
  GetSpreadsheetUrlResponse,
} from "@workspace/api-zod";
import * as sheets from "../lib/googleSheets";
import { requireAdmin } from "../middlewares/requireAdmin";
import { getSchedulerStatus } from "../lib/scheduler";

const router: IRouter = Router();

router.use(requireAdmin);

router.post("/admin/apply-late-fees", async (req, res): Promise<void> => {
  const result = await sheets.applyLateFees();
  // The Sheet-based idempotency check in the scheduler will see these
  // transactions and skip the next automated run for this month automatically.
  res.json(ApplyLateFeesResponse.parse(result));
});

router.get("/admin/spreadsheet-url", async (req, res): Promise<void> => {
  const info = await sheets.getSpreadsheetInfo();
  res.json(GetSpreadsheetUrlResponse.parse(info));
});

router.get("/admin/late-fee-schedule", async (_req, res): Promise<void> => {
  const status = await getSchedulerStatus();
  res.json(status);
});

router.get("/admin/scheduler-status", (req, res): void => {
  res.json(getSchedulerStatus());
});

router.post("/admin/import-history", async (_req, res): Promise<void> => {
  const result = await sheets.importLegacyTransactions();
  res.json(result);
});

export default router;
