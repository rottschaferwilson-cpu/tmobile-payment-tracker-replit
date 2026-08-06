import { Router, type IRouter } from "express";
import {
  ApplyLateFeesResponse,
  GetSpreadsheetUrlResponse,
} from "@workspace/api-zod";
import * as sheets from "../lib/googleSheets";
import { getSchedulerStatus } from "../lib/scheduler";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

router.use(requireAdmin);

router.post("/admin/apply-late-fees", async (req, res): Promise<void> => {
  const result = await sheets.applyLateFees();
  res.json(ApplyLateFeesResponse.parse(result));
});

router.get("/admin/spreadsheet-url", async (req, res): Promise<void> => {
  const info = await sheets.getSpreadsheetInfo();
  res.json(GetSpreadsheetUrlResponse.parse(info));
});

router.get("/admin/scheduler-status", (req, res): void => {
  res.json(getSchedulerStatus());
});

export default router;
