import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";

const VALID_CHANNELS = ["phone", "email", "phone_and_email", "other"];
const VALID_STATUSES = ["new", "contacted", "warm", "cold", "won", "lost", "dnc"];

// Logging a contact is the one primary action on a lead: it always records
// what happened (channel + an optional note about the experience) and can
// optionally record the outcome as a status change — both on one activity
// row, since a note "about the contact" and "the contact" are the same
// event, not two things lumped together. It also auto-claims an unassigned
// lead for whoever is actually logged in (read from the verified session,
// never client-supplied) — assignedTo has no other way to be set.
export async function POST(request: NextRequest, ctx: RouteContext<"/api/leads/[id]/activity">) {
  const { id } = await ctx.params;
  const body = await request.json();
  const { channel, channelDetail, notes, status } = body as {
    channel?: string;
    channelDetail?: string;
    notes?: string;
    status?: string;
  };

  if (!channel || !VALID_CHANNELS.includes(channel)) {
    return NextResponse.json({ error: `channel must be one of: ${VALID_CHANNELS.join(", ")}` }, { status: 400 });
  }
  if (channel === "other" && !channelDetail) {
    return NextResponse.json({ error: "channelDetail is required when channel is 'other'" }, { status: 400 });
  }
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` }, { status: 400 });
  }

  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const session = getSessionFromRequest(request);
  const currentUser = session ? await prisma.user.findUnique({ where: { id: session.userId } }) : null;
  const createdBy = currentUser?.name || currentUser?.email || null;
  const statusChanged = status !== undefined && status !== lead.status;

  const activity = await prisma.activityLog.create({
    data: {
      companyId: lead.companyId,
      leadId: lead.id,
      type: "contact",
      channel,
      channelDetail: channel === "other" ? channelDetail : null,
      notes,
      createdBy,
      ...(statusChanged && { fromStatus: lead.status, toStatus: status }),
    },
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      lastContactedAt: activity.createdAt,
      ...(!lead.assignedTo && createdBy && { assignedTo: createdBy }),
      ...(statusChanged && { status }),
    },
  });

  return NextResponse.json(activity, { status: 201 });
}
