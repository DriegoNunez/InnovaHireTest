// Loads .env for CLI scripts (Next.js does this itself for the app).
import fs from "node:fs";
if (fs.existsSync(".env")) process.loadEnvFile(".env");
