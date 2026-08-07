import { ReplitConnectors } from "@replit/connectors-sdk";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "./logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const SPREADSHEET_ID_FILE = path.join(DATA_DIR, "spreadsheet_id.txt");

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  name: string;
  address: string;
  phone: string;
  planName: string;
  monthlyRate: number;
  status: "active" | "inactive" | "suspended";
  notes: string | null;
  balance: number;
  createdAt: string;
}

export interface Transaction {
  id: string;
  customerId: string;
  date: string;
  type: "service" | "equipment" | "one_time" | "late_fee" | "manual_late_fee" | "payment";
  description: string;
  amount: number;
  createdAt: string;
}

export interface CustomerInput {
  name: string;
  address: string;
  phone: string;
  planName: string;
  monthlyRate: number;
  status?: "active" | "inactive" | "suspended";
  notes?: string;
}

export interface TransactionInput {
  type: "service" | "equipment" | "one_time" | "late_fee" | "manual_late_fee" | "payment";
  description: string;
  amount: number;
  date: string;
}

// ─── Spreadsheet ID persistence ─────────────────────────────────────────────

let cachedSpreadsheetId: string | null = null;

function getStoredSpreadsheetId(): string | null {
  if (cachedSpreadsheetId) return cachedSpreadsheetId;
  // Check env var first
  if (process.env.SPREADSHEET_ID) {
    cachedSpreadsheetId = process.env.SPREADSHEET_ID;
    return cachedSpreadsheetId;
  }
  // Then check file
  try {
    if (fs.existsSync(SPREADSHEET_ID_FILE)) {
      cachedSpreadsheetId = fs.readFileSync(SPREADSHEET_ID_FILE, "utf8").trim();
      return cachedSpreadsheetId;
    }
  } catch {
    // ignore
  }
  return null;
}

function saveSpreadsheetId(id: string): void {
  cachedSpreadsheetId = id;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SPREADSHEET_ID_FILE, id, "utf8");
  } catch (err) {
    logger.warn({ err }, "Failed to save spreadsheet ID to file");
  }
}

// ─── Google Sheets client ────────────────────────────────────────────────────

function getConnectors(): ReplitConnectors {
  return new ReplitConnectors();
}

async function sheetsRequest<T = unknown>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const connectors = getConnectors();
  const opts: { method: string; body?: string; headers?: Record<string, string> } = { method };
  if (body !== undefined) {
    opts.body = JSON.stringify(body);
    opts.headers = { "Content-Type": "application/json" };
  }
  const response = await connectors.proxy("google-sheet", path, opts);
  if (!response.ok) {
    const text = await response.text().catch(() => "unknown error");
    throw new Error(`Sheets API error ${response.status}: ${text}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

// ─── Spreadsheet bootstrap ───────────────────────────────────────────────────

async function createSpreadsheet(): Promise<string> {
  logger.info("Creating new Google Spreadsheet for billing data");
  const result = await sheetsRequest<{ spreadsheetId: string }>("POST", "/v4/spreadsheets", {
    properties: { title: "Internet Billing Manager" },
    sheets: [
      {
        properties: { title: "Customers", sheetId: 0 },
        data: [{
          startRow: 0,
          startColumn: 0,
          rowData: [{
            values: [
              { userEnteredValue: { stringValue: "id" } },
              { userEnteredValue: { stringValue: "name" } },
              { userEnteredValue: { stringValue: "address" } },
              { userEnteredValue: { stringValue: "phone" } },
              { userEnteredValue: { stringValue: "planName" } },
              { userEnteredValue: { stringValue: "monthlyRate" } },
              { userEnteredValue: { stringValue: "status" } },
              { userEnteredValue: { stringValue: "notes" } },
              { userEnteredValue: { stringValue: "createdAt" } },
            ],
          }],
        }],
      },
      {
        properties: { title: "Transactions", sheetId: 1 },
        data: [{
          startRow: 0,
          startColumn: 0,
          rowData: [{
            values: [
              { userEnteredValue: { stringValue: "id" } },
              { userEnteredValue: { stringValue: "customerId" } },
              { userEnteredValue: { stringValue: "date" } },
              { userEnteredValue: { stringValue: "type" } },
              { userEnteredValue: { stringValue: "description" } },
              { userEnteredValue: { stringValue: "amount" } },
              { userEnteredValue: { stringValue: "createdAt" } },
            ],
          }],
        }],
      },
    ],
  });
  const id = result.spreadsheetId;
  saveSpreadsheetId(id);
  logger.info({ spreadsheetId: id }, "Spreadsheet created");
  return id;
}

export async function getSpreadsheetId(): Promise<string> {
  const stored = getStoredSpreadsheetId();
  if (stored) return stored;
  return createSpreadsheet();
}

// ─── Sheet bootstrap (for existing spreadsheets) ─────────────────────────────

interface SheetInfo { title: string; sheetId: number; index: number }

export async function ensureSheets(): Promise<void> {
  const id = await getSpreadsheetId();
  logger.info({ spreadsheetId: id }, "Ensuring required sheets exist");

  // Fetch existing sheets
  const meta = await sheetsRequest<{ sheets: { properties: SheetInfo }[] }>(
    "GET",
    `/v4/spreadsheets/${id}?fields=sheets.properties`
  );
  const existing = new Set((meta.sheets ?? []).map((s) => s.properties.title));

  const sheetsToAdd: { title: string; headers: string[] }[] = [];
  if (!existing.has("Customers")) {
    sheetsToAdd.push({
      title: "Customers",
      headers: ["id", "name", "address", "phone", "planName", "monthlyRate", "status", "notes", "createdAt"],
    });
  }
  if (!existing.has("Transactions")) {
    sheetsToAdd.push({
      title: "Transactions",
      headers: ["id", "customerId", "date", "type", "description", "amount", "createdAt"],
    });
  }
  if (!existing.has("PaymentLog")) {
    sheetsToAdd.push({
      title: "PaymentLog",
      headers: ["id", "transactionId", "customerId", "amount", "description", "loggedByEmail", "loggedAt"],
    });
  }

  if (sheetsToAdd.length === 0) {
    logger.info("Required sheets already exist");
    return;
  }

  // Create missing sheets
  await sheetsRequest("POST", `/v4/spreadsheets/${id}:batchUpdate`, {
    requests: sheetsToAdd.map((s) => ({ addSheet: { properties: { title: s.title } } })),
  });

  // Write headers into each new sheet
  for (const sheet of sheetsToAdd) {
    const colEnd = String.fromCharCode(64 + sheet.headers.length); // A=65
    await sheetsRequest(
      "PUT",
      `/v4/spreadsheets/${id}/values/${encodeURIComponent(sheet.title + `!A1:${colEnd}1`)}?valueInputOption=RAW`,
      { values: [sheet.headers] }
    );
    logger.info({ sheet: sheet.title }, "Sheet created with headers");
  }
}

export async function getSpreadsheetInfo(): Promise<{ spreadsheetId: string; url: string; title: string }> {
  const id = await getSpreadsheetId();
  const result = await sheetsRequest<{ properties: { title: string } }>(
    "GET",
    `/v4/spreadsheets/${id}?fields=properties.title`
  );
  return {
    spreadsheetId: id,
    url: `https://docs.google.com/spreadsheets/d/${id}`,
    title: result.properties?.title ?? "Internet Billing Manager",
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface SheetValuesResponse {
  values?: string[][];
}

async function readSheet(spreadsheetId: string, range: string): Promise<string[][]> {
  const result = await sheetsRequest<SheetValuesResponse>(
    "GET",
    `/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`
  );
  return result.values ?? [];
}

function rowToCustomer(row: string[]): Omit<Customer, "balance"> {
  return {
    id: row[0] ?? "",
    name: row[1] ?? "",
    address: row[2] ?? "",
    phone: row[3] ?? "",
    planName: row[4] ?? "",
    monthlyRate: parseFloat(row[5] ?? "0") || 0,
    status: (row[6] as Customer["status"]) ?? "active",
    notes: row[7] || null,
    createdAt: row[8] ?? "",
  };
}

function rowToTransaction(row: string[]): Transaction {
  return {
    id: row[0] ?? "",
    customerId: row[1] ?? "",
    date: row[2] ?? "",
    type: (row[3] as Transaction["type"]) ?? "service",
    description: row[4] ?? "",
    amount: parseFloat(row[5] ?? "0") || 0,
    createdAt: row[6] ?? "",
  };
}

function computeBalance(transactions: Transaction[], customerId: string): number {
  return transactions
    .filter((t) => t.customerId === customerId)
    .reduce((sum, t) => sum + t.amount, 0);
}

// ─── Customers ────────────────────────────────────────────────────────────────

export async function listCustomers(): Promise<Customer[]> {
  const id = await getSpreadsheetId();
  const [customerRows, transactionRows] = await Promise.all([
    readSheet(id, "Customers!A2:I"),
    readSheet(id, "Transactions!A2:G"),
  ]);
  const transactions = transactionRows.filter((r) => r[0]).map(rowToTransaction);
  return customerRows
    .filter((r) => r[0])
    .map((row) => {
      const base = rowToCustomer(row);
      return { ...base, balance: computeBalance(transactions, base.id) };
    });
}

export async function getCustomer(customerId: string): Promise<(Customer & { transactions: Transaction[] }) | null> {
  const id = await getSpreadsheetId();
  const [customerRows, transactionRows] = await Promise.all([
    readSheet(id, "Customers!A2:I"),
    readSheet(id, "Transactions!A2:G"),
  ]);
  const row = customerRows.find((r) => r[0] === customerId);
  if (!row) return null;
  const transactions = transactionRows
    .filter((r) => r[0] && r[1] === customerId)
    .map(rowToTransaction)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const balance = transactions.reduce((sum, t) => sum + t.amount, 0);
  return { ...rowToCustomer(row), balance, transactions };
}

export async function createCustomer(input: CustomerInput): Promise<Customer> {
  const id = await getSpreadsheetId();
  const newId = randomUUID();
  const now = new Date().toISOString();
  const row = [
    newId,
    input.name,
    input.address,
    input.phone,
    input.planName,
    input.monthlyRate.toString(),
    input.status ?? "active",
    input.notes ?? "",
    now,
  ];
  await sheetsRequest("POST", `/v4/spreadsheets/${id}/values/Customers!A1:I1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    values: [row],
  });
  return { ...rowToCustomer(row), balance: 0 };
}

export async function updateCustomer(
  customerId: string,
  updates: Partial<CustomerInput>
): Promise<Customer | null> {
  const id = await getSpreadsheetId();
  const [customerRows, transactionRows] = await Promise.all([
    readSheet(id, "Customers!A2:I"),
    readSheet(id, "Transactions!A2:G"),
  ]);
  const rowIndex = customerRows.findIndex((r) => r[0] === customerId);
  if (rowIndex === -1) return null;

  const existing = customerRows[rowIndex];
  const updated = [
    existing[0],
    updates.name ?? existing[1],
    updates.address ?? existing[2],
    updates.phone ?? existing[3],
    updates.planName ?? existing[4],
    updates.monthlyRate !== undefined ? updates.monthlyRate.toString() : existing[5],
    updates.status ?? existing[6],
    updates.notes !== undefined ? updates.notes : existing[7],
    existing[8],
  ];

  // Sheets row = header (row 1) + rowIndex + 1 (0-based to 1-based) + 1 = rowIndex + 2
  const sheetRow = rowIndex + 2;
  await sheetsRequest(
    "PUT",
    `/v4/spreadsheets/${id}/values/Customers!A${sheetRow}:I${sheetRow}?valueInputOption=RAW`,
    { values: [updated] }
  );

  const transactions = transactionRows.filter((r) => r[0]).map(rowToTransaction);
  return { ...rowToCustomer(updated), balance: computeBalance(transactions, customerId) };
}

export async function deleteCustomer(customerId: string): Promise<boolean> {
  const id = await getSpreadsheetId();
  const rows = await readSheet(id, "Customers!A2:A");
  const rowIndex = rows.findIndex((r) => r[0] === customerId);
  if (rowIndex === -1) return false;
  const sheetRow = rowIndex + 1; // 0-based index in data (row 2 in sheet = index 0)
  await sheetsRequest("POST", `/v4/spreadsheets/${id}:batchUpdate`, {
    requests: [{
      deleteDimension: {
        range: {
          sheetId: 0,
          dimension: "ROWS",
          startIndex: sheetRow, // 0-based; row 2 of sheet = index 1
          endIndex: sheetRow + 1,
        },
      },
    }],
  });
  return true;
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export async function addTransaction(customerId: string, input: TransactionInput): Promise<Transaction | null> {
  const id = await getSpreadsheetId();
  // Verify customer exists
  const customerRows = await readSheet(id, "Customers!A2:A");
  const exists = customerRows.some((r) => r[0] === customerId);
  if (!exists) return null;

  const newId = randomUUID();
  const now = new Date().toISOString();
  // Payments are stored as negative amounts for credits, positive for charges
  const row = [
    newId,
    customerId,
    input.date,
    input.type,
    input.description,
    input.amount.toString(),
    now,
  ];
  await sheetsRequest(
    "POST",
    `/v4/spreadsheets/${id}/values/Transactions!A1:G1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { values: [row] }
  );
  return rowToTransaction(row);
}

export async function deleteTransaction(customerId: string, txId: string): Promise<boolean> {
  const id = await getSpreadsheetId();
  const rows = await readSheet(id, "Transactions!A2:B");
  const rowIndex = rows.findIndex((r) => r[0] === txId && r[1] === customerId);
  if (rowIndex === -1) return false;
  const sheetRow = rowIndex + 1; // 0-based in data; skip header
  await sheetsRequest("POST", `/v4/spreadsheets/${id}:batchUpdate`, {
    requests: [{
      deleteDimension: {
        range: {
          sheetId: 1,
          dimension: "ROWS",
          startIndex: sheetRow,
          endIndex: sheetRow + 1,
        },
      },
    }],
  });
  return true;
}

/**
 * Returns true if a `late_fee` transaction already exists for the current
 * calendar month (YYYY-MM). Used by the scheduler to prevent double-charging
 * when the server restarts on the 10th.
 */
export async function hasLateFeeThisMonth(): Promise<boolean> {
  const id = await getSpreadsheetId();
  // Columns C=date, D=type in the Transactions sheet
  const rows = await readSheet(id, "Transactions!C2:D");
  const thisMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  return rows.some((r) => r[1] === "late_fee" && (r[0] ?? "").startsWith(thisMonth));
}

// ─── Legacy import ────────────────────────────────────────────────────────────

/**
 * Clears all existing transactions and re-imports from the Payments source sheet.
 * Column layout (0-indexed per member):
 *   Hudson  : label=4  charge=5  paid=6  lateFee=7
 *   Mamadee : label=8  charge=9  paid=10 lateFee=11
 *   Anders  : label=12 charge=13 paid=14 lateFee=15
 *   Ibe     : label=16 charge=17 paid=18 lateFee=19
 *   Wil     : label=20 charge=21 paid=22 (no lateFee col)
 */
export async function importLegacyTransactions(): Promise<{
  cleared: number;
  imported: number;
  skipped: number;
}> {
  const id = await getSpreadsheetId();

  // Hardcoded member definitions — IDs match the live Customers sheet
  const MEMBERS = [
    { id: "020977cc-7a67-4e00-9b00-2d84565731de", name: "Hudson",  chargeCol: 5,  paidCol: 6,  lateFeeCol: 7  },
    { id: "80dfd08a-c1ae-40c2-94eb-0d2d1261c2e4", name: "Mamadee", chargeCol: 9,  paidCol: 10, lateFeeCol: 11 },
    { id: "4f245944-bd4b-4fb4-bed6-30d5067e9689", name: "Anders",  chargeCol: 13, paidCol: 14, lateFeeCol: 15 },
    { id: "887472b8-b882-4265-8308-ac888794689d", name: "Ibe",     chargeCol: 17, paidCol: 18, lateFeeCol: 19 },
    { id: "897a4ec6-687e-4454-a545-d869e43aceb9", name: "Wil",     chargeCol: 21, paidCol: 22, lateFeeCol: -1 },
  ];

  // Monthly rows (0-indexed) → ISO date. Row 6 in sheet = index 5 here.
  const MONTHLY_DATES: Record<number, string> = {
    5:  "2024-10-01", 6:  "2024-11-01", 7:  "2024-12-01",
    8:  "2025-01-01", 9:  "2025-02-01", 10: "2025-03-01",
    11: "2025-04-01", 12: "2025-05-01", 13: "2025-06-01",
    14: "2025-07-01", 15: "2025-08-01", 16: "2025-09-01",
    17: "2025-10-01", 18: "2025-11-01", 19: "2025-12-01",
    20: "2026-01-01", 21: "2026-02-01", 22: "2026-03-01",
    23: "2026-04-01", 24: "2026-05-01", 25: "2026-06-01",
    26: "2026-07-01",
  };

  // Historical rows (0-indexed 1–4 = sheet rows 2–5) with approximate dates
  const HISTORICAL_DATES: Record<number, string> = {
    1: "2022-03-01",
    2: "2023-06-01",
    3: "2023-07-01",
    4: "2024-09-01",
  };

  function parseAmt(cell: string | undefined): number {
    if (!cell) return 0;
    const s = cell.trim().replace(/\$/g, "").replace(/,/g, "").trim();
    if (!s || /^-+\s*$/.test(s)) return 0;
    const neg = s.match(/^\(([0-9.]+)\)$/);
    if (neg) return -parseFloat(neg[1]);
    return parseFloat(s) || 0;
  }

  // ── 1. Clear existing transactions ──────────────────────────────────────────
  const existingTxRows = await readSheet(id, "Transactions!A2:A");
  const txCount = existingTxRows.filter((r) => r[0]).length;
  if (txCount > 0) {
    await sheetsRequest("POST", `/v4/spreadsheets/${id}:batchUpdate`, {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: 1571736392, // Transactions tab sheetId
            dimension: "ROWS",
            startIndex: 1,        // keep header (index 0)
            endIndex: 1 + txCount,
          },
        },
      }],
    });
    logger.info({ txCount }, "Cleared existing transactions");
  }

  // ── 2. Read Payments source sheet ───────────────────────────────────────────
  const payRows = await readSheet(id, "Payments!A1:W29"); // rows 1–29 (row 30 = totals)

  // ── 3. Build transaction rows ────────────────────────────────────────────────
  const toImport: string[][] = [];
  const now = new Date().toISOString();
  let skipped = 0;

  for (let ri = 1; ri < payRows.length; ri++) {
    const row = payRows[ri];

    let date: string;
    let isHistorical: boolean;

    if (ri in HISTORICAL_DATES) {
      date = HISTORICAL_DATES[ri];
      isHistorical = true;
    } else if (ri in MONTHLY_DATES) {
      date = MONTHLY_DATES[ri];
      isHistorical = false;
    } else {
      skipped++;
      continue;
    }

    const monthName = (row[1] ?? "").trim();

    for (const m of MEMBERS) {
      const label    = (row[m.chargeCol - 1] ?? "").trim();
      const chargeAmt = parseAmt(row[m.chargeCol]);
      const paidAmt   = parseAmt(row[m.paidCol]);
      const lateFeeAmt = m.lateFeeCol >= 0 ? parseAmt(row[m.lateFeeCol]) : 0;

      const periodLabel = label || monthName;

      // Service / one-time charge
      if (chargeAmt > 0) {
        const type = isHistorical ? "one_time" : "service";
        const desc = isHistorical
          ? `Historical charges — ${periodLabel}`
          : `Monthly service — ${monthName}`;
        toImport.push([randomUUID(), m.id, date, type, desc, chargeAmt.toString(), now]);
      }

      // Payment (stored as negative in our system)
      if (paidAmt > 0) {
        const desc = isHistorical
          ? `Historical payment — ${periodLabel}`
          : `Payment — ${monthName}`;
        toImport.push([randomUUID(), m.id, date, "payment", desc, (-paidAmt).toString(), now]);
      }

      // Late fee (only for members/months where a positive late fee column exists)
      if (lateFeeAmt > 0) {
        toImport.push([
          randomUUID(), m.id, date, "late_fee",
          `Late fee — ${monthName}`, lateFeeAmt.toString(), now,
        ]);
      }
    }
  }

  // ── 4. Batch-append all rows ─────────────────────────────────────────────────
  if (toImport.length > 0) {
    await sheetsRequest(
      "POST",
      `/v4/spreadsheets/${id}/values/Transactions!A1:G1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { values: toImport }
    );
  }

  logger.info({ cleared: txCount, imported: toImport.length, skipped }, "Legacy import complete");
  return { cleared: txCount, imported: toImport.length, skipped };
}

// ─── Payment audit log ────────────────────────────────────────────────────────

export interface PaymentLogEntry {
  transactionId: string;
  customerId: string;
  amount: number;
  description: string;
  loggedByEmail: string;
  loggedAt: string;
}

/**
 * Appends one row to the PaymentLog sheet.
 * Call fire-and-forget — errors are logged but never thrown.
 */
export async function logPayment(entry: PaymentLogEntry): Promise<void> {
  try {
    const id = await getSpreadsheetId();
    const row = [
      randomUUID(),
      entry.transactionId,
      entry.customerId,
      entry.amount.toString(),
      entry.description,
      entry.loggedByEmail,
      entry.loggedAt,
    ];
    await sheetsRequest(
      "POST",
      `/v4/spreadsheets/${id}/values/PaymentLog!A1:G1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { values: [row] }
    );
    logger.info({ transactionId: entry.transactionId, loggedBy: entry.loggedByEmail }, "Payment logged");
  } catch (err) {
    logger.error({ err }, "Failed to write payment log — continuing");
  }
}

// ─── Late fees ────────────────────────────────────────────────────────────────

export async function applyLateFees(): Promise<{
  applied: number;
  skipped: number;
  totalFeesAdded: number;
  details: { customerId: string; customerName: string; balance: number; feeAmount: number }[];
}> {
  const customers = await listCustomers();
  const today = new Date().toISOString().split("T")[0];
  const activeCustomers = customers.filter((c) => c.status === "active" || c.status === "inactive");

  const details: { customerId: string; customerName: string; balance: number; feeAmount: number }[] = [];
  let applied = 0;
  let skipped = 0;
  let totalFeesAdded = 0;

  for (const customer of activeCustomers) {
    if (customer.balance <= 0) {
      skipped++;
      continue;
    }
    const feeAmount = Math.round(customer.balance * 0.20 * 100) / 100;
    await addTransaction(customer.id, {
      type: "late_fee",
      description: `Late fee (20% of $${customer.balance.toFixed(2)} balance)`,
      amount: feeAmount,
      date: today,
    });
    details.push({ customerId: customer.id, customerName: customer.name, balance: customer.balance, feeAmount });
    totalFeesAdded += feeAmount;
    applied++;
  }

  return { applied, skipped, totalFeesAdded: Math.round(totalFeesAdded * 100) / 100, details };
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardSummary() {
  const spreadsheetId = await getSpreadsheetId();
  const [customerRows, transactionRows] = await Promise.all([
    readSheet(spreadsheetId, "Customers!A2:I"),
    readSheet(spreadsheetId, "Transactions!A2:G"),
  ]);

  const transactions = transactionRows.filter((r) => r[0]).map(rowToTransaction);
  const customers = customerRows
    .filter((r) => r[0])
    .map((row) => {
      const base = rowToCustomer(row);
      return { ...base, balance: computeBalance(transactions, base.id) };
    });

  const activeCustomers = customers.filter((c) => c.status === "active").length;
  const totalOutstanding = customers.reduce((sum, c) => sum + Math.max(0, c.balance), 0);
  const customersWithBalance = customers.filter((c) => c.balance > 0).length;
  const customersWithNegativeBalance = customers.filter((c) => c.balance < 0).length;

  // Build customer name map for recent transactions
  const customerMap = new Map(customers.map((c) => [c.id, c.name]));

  const recentTransactions = transactions
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20)
    .map((t) => ({
      id: t.id,
      customerId: t.customerId,
      customerName: customerMap.get(t.customerId) ?? "Unknown",
      date: t.date,
      type: t.type,
      description: t.description,
      amount: t.amount,
    }));

  return {
    totalCustomers: customers.length,
    activeCustomers,
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    customersWithBalance,
    customersWithNegativeBalance,
    recentTransactions,
  };
}

/**
 * Returns the createdAt timestamp of the most recent late_fee or
 * manual_late_fee transaction, or null if none exist.
 */
export async function getLastLateFeeDate(): Promise<string | null> {
  const id = await getSpreadsheetId();
  // Columns D=type, E=description, F=amount, G=createdAt
  const rows = await readSheet(id, "Transactions!D2:G");
  const timestamps = rows
    .filter((r) => r[0] === "late_fee" || r[0] === "manual_late_fee")
    .map((r) => r[3]) // createdAt is index 3 in this range
    .filter(Boolean);
  if (timestamps.length === 0) return null;
  return timestamps.sort().at(-1) ?? null;
}
