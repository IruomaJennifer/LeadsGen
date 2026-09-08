import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/companies/[id]">) {
  const { id } = await ctx.params;
  const body = await request.json();
  const { email, phone } = body as { email?: string; phone?: string };

  if (email === undefined && phone === undefined) {
    return NextResponse.json({ error: "email or phone is required" }, { status: 400 });
  }
  if (email !== undefined && (typeof email !== "string" || email.length === 0)) {
    return NextResponse.json({ error: "email must be a non-empty string" }, { status: 400 });
  }
  if (phone !== undefined && (typeof phone !== "string" || phone.length === 0)) {
    return NextResponse.json({ error: "phone must be a non-empty string" }, { status: 400 });
  }

  try {
    const updated = await prisma.company.update({
      where: { id },
      data: {
        ...(email !== undefined && { email, emailSource: "manual" }),
        ...(phone !== undefined && { phone, phoneSource: "manual" }),
      },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }
}
