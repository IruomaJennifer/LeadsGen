import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Powers the "Assigned to" filter dropdown — team members, not leads, since
// assignedTo values are always a real user's name/email (auto-set on first
// contact), never free text.
export async function GET() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true },
    orderBy: { email: "asc" },
  });
  return NextResponse.json({ data: users.map((u) => ({ id: u.id, label: u.name || u.email })) });
}
