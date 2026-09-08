import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// `source` (Datablist's jobSourceUrl) is a per-posting URL, not a clean label
// like "Indeed" — bucket by hostname instead of grouping on the raw value.
function sourceLabel(url: string | null): string {
  if (!url) return "unknown";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export async function GET() {
  const [byStatus, total, postings] = await Promise.all([
    prisma.lead.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.lead.count(),
    prisma.jobPosting.findMany({ select: { source: true } }),
  ]);

  const countByStatus = Object.fromEntries(byStatus.map((row) => [row.status, row._count._all]));
  const newCount = countByStatus.new ?? 0;
  const warmCount = countByStatus.warm ?? 0;
  const workedCount = total - newCount;

  const bySource: Record<string, number> = {};
  for (const posting of postings) {
    const label = sourceLabel(posting.source);
    bySource[label] = (bySource[label] ?? 0) + 1;
  }

  return NextResponse.json({
    total,
    byStatus: countByStatus,
    uncalledQueueSize: newCount,
    // Of leads that have been worked at least once (i.e. not still `new`),
    // what fraction turned warm.
    warmRate: workedCount > 0 ? warmCount / workedCount : null,
    bySource,
  });
}
