import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

const PAGE_SIZE = 20;
const SORTABLE_FIELDS = ["createdAt", "updatedAt", "status", "lastContactedAt", "nextActionAt"] as const;
type SortableField = (typeof SORTABLE_FIELDS)[number];

// `id` is always appended as a tiebreaker. Leads created in the same
// pipeline run share the exact same createdAt (one bulk INSERT, one `now()`
// call for the whole batch) — sorting on createdAt alone leaves Postgres
// free to order ties arbitrarily, which reshuffles across requests and
// makes rows appear to jump pages or "disappear" after an edit.
function parseSort(sort: string | null): Prisma.LeadOrderByWithRelationInput[] {
  if (!sort) return [{ createdAt: "desc" }, { id: "asc" }];
  const desc = sort.startsWith("-");
  const field = (desc ? sort.slice(1) : sort) as SortableField;
  if (!SORTABLE_FIELDS.includes(field)) return [{ createdAt: "desc" }, { id: "asc" }];
  return [{ [field]: desc ? "desc" : "asc" }, { id: "asc" }];
}

function triStateFilter(value: string | null): boolean | undefined {
  if (value === "yes") return true;
  if (value === "no") return false;
  return undefined; // "any" or absent
}

// A date-only "to" bound (e.g. from <input type="date">) means "through the
// end of that day", not midnight-start — so use an exclusive `lt` against
// the start of the *next* day instead of `lte` against midnight, or same-day
// events after midnight are silently excluded.
function endOfDayExclusive(dateOnly: string): Date {
  const date = new Date(dateOnly);
  date.setDate(date.getDate() + 1);
  return date;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const hasPhone = triStateFilter(searchParams.get("hasPhone"));
  const hasEmail = triStateFilter(searchParams.get("hasEmail"));
  const contactedFrom = searchParams.get("contactedFrom");
  const contactedTo = searchParams.get("contactedTo");
  const createdFrom = searchParams.get("createdFrom");
  const createdTo = searchParams.get("createdTo");
  const assignedTo = searchParams.get("assignedTo");

  const companyFilter: Prisma.CompanyWhereInput = {
    ...(search && { name: { contains: search, mode: "insensitive" } }),
    ...(hasPhone !== undefined && { phone: hasPhone ? { not: null } : null }),
    ...(hasEmail !== undefined && { email: hasEmail ? { not: null } : null }),
  };

  const where: Prisma.LeadWhereInput = {
    ...(status && { status }),
    ...(Object.keys(companyFilter).length > 0 && { company: companyFilter }),
    ...(assignedTo === "__unassigned__" && { assignedTo: null }),
    ...(assignedTo && assignedTo !== "__unassigned__" && { assignedTo }),
    ...((contactedFrom || contactedTo) && {
      lastContactedAt: {
        ...(contactedFrom && { gte: new Date(contactedFrom) }),
        ...(contactedTo && { lt: endOfDayExclusive(contactedTo) }),
      },
    }),
    ...((createdFrom || createdTo) && {
      createdAt: {
        ...(createdFrom && { gte: new Date(createdFrom) }),
        ...(createdTo && { lt: endOfDayExclusive(createdTo) }),
      },
    }),
  };

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: parseSort(searchParams.get("sort")),
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        company: {
          select: { id: true, name: true, phone: true, email: true, website: true, hqCity: true, hqCountry: true },
        },
      },
    }),
    prisma.lead.count({ where }),
  ]);

  // Latest role per company, fetched in one extra query (not per-row) and
  // matched up in memory.
  const companyIds = leads.map((lead) => lead.companyId);
  const postings = await prisma.jobPosting.findMany({
    where: { companyId: { in: companyIds } },
    orderBy: [{ datePosted: "desc" }, { importedAt: "desc" }],
    select: { companyId: true, title: true, url: true },
  });
  const latestRoleByCompany = new Map<string, { title: string | null; url: string | null }>();
  for (const posting of postings) {
    if (!latestRoleByCompany.has(posting.companyId)) {
      latestRoleByCompany.set(posting.companyId, { title: posting.title, url: posting.url });
    }
  }

  const data = leads.map((lead) => ({
    id: lead.id,
    status: lead.status,
    assignedTo: lead.assignedTo,
    lastContactedAt: lead.lastContactedAt,
    nextActionAt: lead.nextActionAt,
    notes: lead.notes,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
    company: lead.company,
    latestRole: latestRoleByCompany.get(lead.companyId)?.title ?? null,
    latestRoleUrl: latestRoleByCompany.get(lead.companyId)?.url ?? null,
  }));

  return NextResponse.json({
    data,
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.ceil(total / PAGE_SIZE),
  });
}
