/**
 * Public read-only portal routes — no auth required.
 * Returns only the minimum data customers need to check their own balance.
 * Intentionally strips sensitive fields (address, phone, notes).
 * No write endpoints — payments must be recorded by the admin.
 */
import { Router, type IRouter } from "express";
import * as sheets from "../lib/googleSheets";

const router: IRouter = Router();

// List customers — id, name, and balance only (no PII)
router.get("/portal/customers", async (_req, res): Promise<void> => {
  const customers = await sheets.listCustomers();
  const summary = customers
    .filter((c) => c.status !== "suspended")
    .map((c) => ({ id: c.id, name: c.name, balance: c.balance }))
    .sort((a, b) => a.name.localeCompare(b.name));
  res.json(summary);
});

// Get a single customer's billing summary — balance + transactions only, no PII
router.get("/portal/customers/:id", async (req, res): Promise<void> => {
  const customer = await sheets.getCustomer(req.params.id);
  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  // Return only the fields needed for billing review — no address, phone, or notes
  res.json({
    id: customer.id,
    name: customer.name,
    planName: customer.planName,
    monthlyRate: customer.monthlyRate,
    status: customer.status,
    balance: customer.balance,
    transactions: customer.transactions,
  });
});

export default router;
