/**
 * Public portal routes — no admin auth required.
 * Customers can look up their own balance and submit payments.
 */
import { Router, type IRouter } from "express";
import * as sheets from "../lib/googleSheets";

const router: IRouter = Router();

// List all customers (name + id only — no sensitive admin detail)
router.get("/portal/customers", async (_req, res): Promise<void> => {
  const customers = await sheets.listCustomers();
  const summary = customers
    .filter((c) => c.status !== "suspended")
    .map((c) => ({ id: c.id, name: c.name, balance: c.balance }))
    .sort((a, b) => a.name.localeCompare(b.name));
  res.json(summary);
});

// Get a single customer's balance + transaction history
router.get("/portal/customers/:id", async (req, res): Promise<void> => {
  const customer = await sheets.getCustomer(req.params.id);
  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  res.json(customer);
});

// Submit a payment on behalf of a customer
router.post("/portal/customers/:id/payment", async (req, res): Promise<void> => {
  const { amount, date, note } = req.body as {
    amount?: unknown;
    date?: unknown;
    note?: unknown;
  };

  const parsedAmount = Number(amount);
  if (!parsedAmount || parsedAmount <= 0) {
    res.status(400).json({ error: "amount must be a positive number" });
    return;
  }

  const customer = await sheets.getCustomer(req.params.id);
  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  const txDate = typeof date === "string" && date ? date : new Date().toISOString().split("T")[0];
  const description = typeof note === "string" && note.trim()
    ? note.trim()
    : "Payment submitted via portal";

  const tx = await sheets.addTransaction(req.params.id, {
    type: "payment",
    description,
    amount: Math.round(parsedAmount * 100) / 100,
    date: txDate,
  });

  res.status(201).json(tx);
});

export default router;
