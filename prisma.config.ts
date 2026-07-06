import { defineConfig } from "prisma/config";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

// O CLI do Prisma não lê .env.local (padrão Next.js) sozinho.
for (const file of [".env.local", ".env.production", ".env"]) {
  if (existsSync(file)) {
    try {
      loadEnvFile(file);
    } catch {
      // valores já definidos no ambiente têm precedência
    }
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? "mysql://localhost:3306/ultrahub",
  },
});
