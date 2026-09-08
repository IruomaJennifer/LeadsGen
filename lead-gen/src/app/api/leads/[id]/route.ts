import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VALID_STATUSES = ["new", "contacted", "warm", "cold", "won", "lost", "dnc"];

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/leads/[id]">) {
  const { id } = await ctx.params;

  const lead = await prisma.lead.findUnique({ where: { id }, include: { company: true } });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const [jobPostings, activityLog] = await Promise.all([
    prisma.jobPosting.findMany({
      where: { companyId: lead.companyId },
      orderBy: [{ datePosted: "desc" }, { importedAt: "desc" }],
    }),
    prisma.activityLog.findMany({
      where: { companyId: lead.companyId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    lead: {
      id: lead.id,
      status: lead.status,
      assignedTo: lead.assignedTo,
      lastContactedAt: lead.lastContactedAt,
      nextActionAt: lead.nextActionAt,
      notes: lead.notes,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
    },
    company: lead.company,
    jobPostings,
    activityLog,
  });
}

// Status is the only thing this endpoint changes now. assignedTo has no
// editable path anywhere — it's only ever set as a side effect of logging
// a contact (see the activity route) — and notes no longer exist as a
// field separate from a contact's own note, so neither is accepted here.
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/leads/[id]">) {
  const { id } = await ctx.params;
  const body = await request.json();
  const { status } = body as { status?: string };

  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` }, { status: 400 });
  }

  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const updated = await prisma.lead.update({
    where: { id },
    data: {
      ...(status !== undefined && { status }),
    },
  });

  if (status !== undefined && status !== existing.status) {
    await prisma.activityLog.create({
      data: {
        companyId: existing.companyId,
        leadId: existing.id,
        type: "status_change",
        fromStatus: existing.status,
        toStatus: status,
      },
    });
  }

  return NextResponse.json(updated);
}
