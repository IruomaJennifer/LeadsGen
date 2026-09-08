import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateTempPassword, hashPassword } from "@/lib/auth";
import { sendWelcomeEmail } from "@/lib/email";

// Admin-only — enforced by proxy.ts for the whole /api/admin/* prefix.

export async function GET() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, mustChangePassword: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ data: users });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, name } = body as { email?: string; name?: string };

  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 });
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  const user = await prisma.user.create({
    data: { email, name, passwordHash, role: "user", mustChangePassword: true },
  });

  const { sent } = await sendWelcomeEmail(email, name ?? null, tempPassword);

  return NextResponse.json(
    {
      id: user.id,
      email: user.email,
      emailSent: sent,
      // Only surfaced when we couldn't email it — the admin still needs a
      // way to hand over the password, but it's never returned otherwise.
      temporaryPassword: sent ? undefined : tempPassword,
    },
    { status: 201 }
  );
}
