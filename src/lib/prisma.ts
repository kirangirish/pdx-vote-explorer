import { PrismaClient } from "@prisma/client";

// Global prisma instance for development hot-reloading
const globalForPrisma = global as unknown as { prisma: PrismaClient };

// For SQLite, the standard constructor works without an adapter 
// in standard development setups with Prisma 7
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
