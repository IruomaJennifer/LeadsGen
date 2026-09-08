// Runs once when the Next.js server starts (before it accepts requests).
// Used here to guarantee the admin account always exists, without a
// separate manual setup step. Prisma needs the Node runtime, so this is
// skipped in the edge runtime (proxy.ts never runs this anyway).
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { seedAdminUser } = await import("./lib/seed-admin");
  await seedAdminUser();
}
