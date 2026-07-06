import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Singleton do Prisma (MariaDB). Em dev o Next recarrega módulos a cada
 * request; o cache em globalThis evita esgotar conexões.
 */
export function getSql(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL não configurada.");
    }
    const adapter = new PrismaMariaDb(url);
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }
  return globalForPrisma.prisma;
}

/** Converte DateTime do banco para epoch millis (contrato dos tipos da app). */
export function toMillis(date: Date): number;
export function toMillis(date: Date | null | undefined): number | undefined;
export function toMillis(date: Date | null | undefined): number | undefined {
  return date ? date.getTime() : undefined;
}

/** Converte epoch millis (ou Date) vindo da app para Date do banco. */
export function toDbDate(value: number | Date): Date;
export function toDbDate(value: number | Date | null | undefined): Date | undefined;
export function toDbDate(value: number | Date | null | undefined): Date | undefined {
  if (value === null || value === undefined) return undefined;
  return value instanceof Date ? value : new Date(value);
}
