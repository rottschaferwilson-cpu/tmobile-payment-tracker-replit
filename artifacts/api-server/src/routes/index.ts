import { Router, type IRouter } from "express";
import customersRouter from "./customers";
import transactionsRouter from "./transactions";
import adminRouter from "./admin";
import dashboardRouter from "./dashboard";
import portalRouter from "./portal";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

// Public portal routes (no auth) — must come before protected routers
router.use(portalRouter);

router.use(customersRouter);
router.use(transactionsRouter);
router.use(adminRouter);
router.use(dashboardRouter);

export default router;
