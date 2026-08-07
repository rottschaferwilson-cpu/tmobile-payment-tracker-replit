import { Router, type IRouter } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import {
  AddTransactionParams,
  AddTransactionBody,
  AddTransactionResponse,
  DeleteTransactionParams,
  UpdateTransactionParams,
  UpdateTransactionBody,
  UpdateTransactionResponse,
} from "@workspace/api-zod";
import * as sheets from "../lib/googleSheets";
import { requireAuth } from "../middlewares/requireAuth";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

// Any signed-in user can record a transaction (e.g. payment recording)
router.post("/customers/:id/transactions", requireAuth, async (req, res): Promise<void> => {
  const params = AddTransactionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = AddTransactionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const transaction = await sheets.addTransaction(params.data.id, parsed.data);
  if (!transaction) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  // Respond immediately; audit log is fire-and-forget
  res.status(201).json(AddTransactionResponse.parse(transaction));

  // Log payments to the PaymentLog sheet (all transaction types, not just "payment")
  try {
    const { userId } = getAuth(req);
    if (userId) {
      const clerkUser = await clerkClient.users.getUser(userId);
      const email =
        clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
          ?.emailAddress ?? userId;

      // Fire-and-forget — logPayment never throws
      sheets.logPayment({
        transactionId: transaction.id,
        customerId: params.data.id,
        amount: parsed.data.amount,
        description: parsed.data.description,
        loggedByEmail: email,
        loggedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    // Non-fatal — don't disrupt the response
    req.log?.warn({ err }, "Could not resolve Clerk user for payment log");
  }
});

// Updating transactions is admin-only
router.patch("/customers/:id/transactions/:txId", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateTransactionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateTransactionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updated = await sheets.updateTransaction(params.data.id, params.data.txId, parsed.data);
  if (!updated) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }
  res.json(UpdateTransactionResponse.parse(updated));
});

// Deleting transactions is admin-only
router.delete("/customers/:id/transactions/:txId", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteTransactionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const deleted = await sheets.deleteTransaction(params.data.id, params.data.txId);
  if (!deleted) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
