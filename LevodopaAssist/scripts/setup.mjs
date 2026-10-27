import { existsSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const backendDir = join(root, "webapp", "backend");
const envPath = join(backendDir, ".env");

if (!existsSync(envPath)) {
  writeFileSync(envPath, 'DATABASE_URL="file:./dev.db"\nPORT=4000\n');
  console.log("Creado webapp/backend/.env");
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("Preparando base de datos (Prisma)...");
run("npx", ["prisma", "migrate", "deploy"], backendDir);
run("npx", ["prisma", "generate"], backendDir);
console.log("Listo. Corré: npm run dev");
