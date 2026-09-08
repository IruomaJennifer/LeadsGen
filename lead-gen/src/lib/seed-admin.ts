import { prisma } from "./prisma";
import { config } from "./config";
import { hashPassword } from "./auth";

// Runs once per server start (see src/instrumentation.ts). Idempotent — if
// the admin email already exists, this is a no-op, so it's safe to run on
// every boot rather than needing a separate one-time setup step.
export async function seedAdminUser(): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email: config.adminEmail } });
  if (existing) return;

  const passwordHash = await hashPassword(config.adminPassword);
  await prisma.user.create({
    data: {
      email: config.adminEmail,
      name: config.adminName,
      passwordHash,
      role: "admin",
      mustChangePassword: false,
    },
  });
  console.log(`[seed-admin] Created admin user: ${config.adminEmail}`);
}
