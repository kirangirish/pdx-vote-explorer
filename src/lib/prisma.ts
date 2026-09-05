import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// Global prisma instance for development hot-reloading
const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Prisma 7 requires an explicit driver adapter; there is no implicit connection.
const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
