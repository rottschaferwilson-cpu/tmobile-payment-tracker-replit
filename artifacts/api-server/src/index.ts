import app from "./app";
import { logger } from "./lib/logger";
import { ensureSheets } from "./lib/googleSheets";
import { initScheduler } from "./lib/scheduler";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Bootstrap the linked Google Spreadsheet on startup
  ensureSheets().catch((e) => {
    logger.error({ err: e }, "Failed to ensure sheets — will retry on first request");
  });

  // Start the automatic late-fee scheduler (fires on the 10th of each month)
  initScheduler();
});
