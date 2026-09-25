import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Global prisma instance for development hot-reloading
const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Prisma 7 requires an explicit driver adapter; there is no implicit connection.
// DATABASE_URL should be Supabase's transaction pooler URL (port 6543) in
// production, since serverless functions open many short-lived connections.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
