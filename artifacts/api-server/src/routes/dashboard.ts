import { Router, type IRouter } from "express";
import { GetDashboardResponse } from "@workspace/api-zod";
import * as sheets from "../lib/googleSheets";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

router.use(requireAdmin);

router.get("/dashboard", async (req, res): Promise<void> => {
  const summary = await sheets.getDashboardSummary();
  res.json(GetDashboardResponse.parse(summary));
});

export default router;
