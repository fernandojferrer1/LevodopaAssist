import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const backendDir = join(root, "webapp", "backend");
const envPath = join(backendDir, ".env");
const examplePath = join(backendDir, ".env.example");

if (!existsSync(envPath)) {
  if (!existsSync(examplePath)) {
    console.error("No existe webapp/backend/.env.example");
    process.exit(1);
  }
  copyFileSync(examplePath, envPath);
  console.log("Creado webapp/backend/.env desde .env.example");
} else {
  console.log("webapp/backend/.env ya existe");
}

console.log("");
console.log("Completá SUPABASE_URL y SUPABASE_SECRET_KEY en webapp/backend/.env");
console.log("antes de correr npm run dev.");
