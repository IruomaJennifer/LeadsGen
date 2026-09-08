import type { PrismaClient } from "../generated/prisma/client";
import { findPlaceId, getPhone } from "./places";

export interface EnrichResult {
  lookups: number;
}

// Enrich only companies never looked up before (Step 3.2). No hard cap on
// spend (Step 3.3) — the two-step pattern plus this net-new-only cache keep
// spend trivial; the real backstop is the Google Cloud budget alert, not
// app logic. A per-company failure is logged and skipped rather than
// aborting the batch, and leaves placesLookedUpAt unset so it's retried
// next run (an actual error is not the same as a confirmed no-match).
export async function enrichNetNewCompanies(prisma: PrismaClient, apiKey: string): Promise<EnrichResult> {
  const candidates = await prisma.company.findMany({
    where: { phone: null, placesLookedUpAt: null },
    select: { id: true, name: true, hqCity: true },
  });

  let lookups = 0;
  for (const company of candidates) {
    const query = [company.name, company.hqCity].filter(Boolean).join(" ");
    lookups += 1;
    try {
      const placeId = await findPlaceId(apiKey, query);
      const phone = placeId ? await getPhone(apiKey, placeId) : null;
      await prisma.company.update({
        where: { id: company.id },
        data: {
          phone,
          phoneSource: phone ? "google_places" : null,
          placesPlaceId: placeId,
          placesMatchStatus: phone ? "matched" : "no_match",
          placesLookedUpAt: new Date(),
        },
      });
    } catch (err) {
      console.error(`Places lookup failed for company ${company.id} (${company.name}):`, err);
    }
  }

  return { lookups };
}

// Log-only visibility into monthly spend (Step 3.3). Never blocks
// enrichment — just a heads-up if PLACES_ALERT_THRESHOLD is set and crossed.
export async function warnIfPlacesThresholdCrossed(prisma: PrismaClient, threshold: number | undefined): Promise<void> {
  if (!threshold) return;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { _sum } = await prisma.pipelineRun.aggregate({
    _sum: { placesLookups: true },
    where: { startedAt: { gte: startOfMonth } },
  });
  const monthlyTotal = _sum.placesLookups ?? 0;

  if (monthlyTotal >= threshold) {
    console.warn(
      `Places lookups this month (${monthlyTotal}) have crossed the alert threshold (${threshold}). Enrichment is not blocked.`
    );
  }
}
