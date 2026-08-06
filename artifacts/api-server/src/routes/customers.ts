import { Router, type IRouter } from "express";
import {
  ListCustomersResponseItem,
  GetCustomerResponse,
  CreateCustomerBody,
  UpdateCustomerBody,
  GetCustomerParams,
  UpdateCustomerParams,
  DeleteCustomerParams,
} from "@workspace/api-zod";
import * as sheets from "../lib/googleSheets";
import { requireAdmin } from "../middlewares/requireAdmin";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

// Read-only: any signed-in user
router.get("/customers", requireAuth, async (req, res): Promise<void> => {
  const customers = await sheets.listCustomers();
  res.json(customers.map((c) => ListCustomersResponseItem.parse(c)));
});

router.get("/customers/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetCustomerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const customer = await sheets.getCustomer(params.data.id);
  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  res.json(GetCustomerResponse.parse(customer));
});

// Write operations: admin only
router.post("/customers", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateCustomerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const customer = await sheets.createCustomer(parsed.data);
  res.status(201).json(GetCustomerResponse.parse({ ...customer, transactions: [] }));
});

router.patch("/customers/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateCustomerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateCustomerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const customer = await sheets.updateCustomer(params.data.id, parsed.data);
  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  res.json(ListCustomersResponseItem.parse(customer));
});

router.delete("/customers/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteCustomerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const deleted = await sheets.deleteCustomer(params.data.id);
  if (!deleted) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
