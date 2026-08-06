import { Router, type IRouter } from "express";
import customersRouter from "./customers";
import transactionsRouter from "./transactions";
import adminRouter from "./admin";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

router.use(customersRouter);
router.use(transactionsRouter);
router.use(adminRouter);
router.use(dashboardRouter);

export default router;
