import { Router, type IRouter } from "express";
import {
  AddTransactionParams,
  AddTransactionBody,
  AddTransactionResponse,
  DeleteTransactionParams,
} from "@workspace/api-zod";
import * as sheets from "../lib/googleSheets";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

router.use(requireAdmin);

router.post("/customers/:id/transactions", async (req, res): Promise<void> => {
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
  res.status(201).json(AddTransactionResponse.parse(transaction));
});

router.delete("/customers/:id/transactions/:txId", async (req, res): Promise<void> => {
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
