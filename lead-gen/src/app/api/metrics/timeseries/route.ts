import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SUPPORTED_METRICS = ["leads_created", "contacts_logged", "warm_cold_per_week", "postings_by_weekday"];
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseRangeDays(range: string | null, fallback: number): number {
  const match = range?.match(/^(\d+)d$/);
  return match ? Number(match[1]) : fallback;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const metric = searchParams.get("metric");

  if (metric === "leads_created") {
    const days = parseRangeDays(searchParams.get("range"), 30);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await prisma.$queryRaw<{ day: Date; count: bigint }[]>`
      SELECT date_trunc('day', created_at) AS day, count(*) AS count
      FROM leads
      WHERE created_at >= ${since}
      GROUP BY day
      ORDER BY day
    `;
    return NextResponse.json({
      metric,
      range: `${days}d`,
      data: rows.map((row) => ({ date: row.day, count: Number(row.count) })),
    });
  }

  if (metric === "contacts_logged") {
    const days = parseRangeDays(searchParams.get("range"), 30);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await prisma.$queryRaw<{ day: Date; count: bigint }[]>`
      SELECT date_trunc('day', created_at) AS day, count(*) AS count
      FROM activity_log
      WHERE type = 'contact' AND created_at >= ${since}
      GROUP BY day
      ORDER BY day
    `;
    return NextResponse.json({
      metric,
      range: `${days}d`,
      data: rows.map((row) => ({ date: row.day, count: Number(row.count) })),
    });
  }

  if (metric === "warm_cold_per_week") {
    const days = parseRangeDays(searchParams.get("range"), 84); // ~12 weeks
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await prisma.$queryRaw<{ week: Date; warm: bigint; cold: bigint }[]>`
      SELECT
        date_trunc('week', created_at) AS week,
        count(*) FILTER (WHERE to_status = 'warm') AS warm,
        count(*) FILTER (WHERE to_status = 'cold') AS cold
      FROM activity_log
      WHERE type = 'status_change' AND to_status IN ('warm', 'cold') AND created_at >= ${since}
      GROUP BY week
      ORDER BY week
    `;
    return NextResponse.json({
      metric,
      range: `${days}d`,
      data: rows.map((row) => ({ date: row.week, warm: Number(row.warm), cold: Number(row.cold) })),
    });
  }

  if (metric === "postings_by_weekday") {
    // Dedupe to one representative posting per company (its most recent —
    // same rule the leads list uses for "Top role") before bucketing by
    // weekday, so a company with several postings doesn't inflate one day.
    const rows = await prisma.$queryRaw<{ dow: number; count: bigint }[]>`
      SELECT EXTRACT(DOW FROM COALESCE(date_posted, imported_at))::int AS dow, count(*) AS count
      FROM (
        SELECT DISTINCT ON (company_id) company_id, date_posted, imported_at
        FROM job_postings
        ORDER BY company_id, date_posted DESC NULLS LAST, imported_at DESC
      ) latest_posting_per_company
      GROUP BY dow
    `;
    const countByDow = new Map(rows.map((row) => [row.dow, Number(row.count)]));
    return NextResponse.json({
      metric,
      data: WEEKDAY_LABELS.map((label, dow) => ({ label, count: countByDow.get(dow) ?? 0 })),
    });
  }

  return NextResponse.json({ error: `metric must be one of: ${SUPPORTED_METRICS.join(", ")}` }, { status: 400 });
}
