import "dotenv/config";
import { config } from "../src/lib/config";
import { prisma } from "../src/lib/prisma";
import { getDatablistToken, fetchNewItems } from "../src/lib/datablist";
import { mapCompany, mapPosting } from "../src/lib/mapper";
import { upsertBatch } from "../src/lib/upsert";
import { enrichNetNewCompanies, warnIfPlacesThresholdCrossed } from "../src/lib/enrich";

const FIRST_RUN_LOOKBACK_MS = 48 * 60 * 60 * 1000;

async function main() {
  const apiKey = config.datablistApiKey;
  const collectionId = config.datablistCollectionId;

  const run = await prisma.pipelineRun.create({ data: {} });

  try {
    const lastSuccess = await prisma.pipelineRun.findFirst({
      where: { status: "success" },
      orderBy: { startedAt: "desc" },
    });
    const sinceIso =
      lastSuccess?.watermarkTo?.toISOString() ?? new Date(Date.now() - FIRST_RUN_LOOKBACK_MS).toISOString();

    const token = await getDatablistToken(apiKey);
    const items = await fetchNewItems(token, collectionId, sinceIso);

    const companies = items.map(mapCompany);
    const postings = items.map((item, i) => mapPosting(item, companies[i].domain));

    const { companiesNew, companiesUpdated } = await upsertBatch(prisma, companies, postings);

    const { lookups: placesLookups } = await enrichNetNewCompanies(prisma, config.googleMapsApiKey);

    const newestCreatedAt = items.reduce<string | null>((max, item) => {
      const createdAt = item.createdAt;
      return !max || createdAt > max ? createdAt : max;
    }, null);
    const watermarkTo = newestCreatedAt ? new Date(newestCreatedAt) : new Date(sinceIso);

    await prisma.pipelineRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        status: "success",
        watermarkFrom: new Date(sinceIso),
        watermarkTo,
        jobsPulled: items.length,
        companiesNew,
        companiesUpdated,
        placesLookups,
      },
    });

    await warnIfPlacesThresholdCrossed(prisma, config.placesAlertThreshold);

    console.log(
      `Pipeline run ${run.id}: pulled ${items.length} items, ${companiesNew} new companies, ${companiesUpdated} updated, ${placesLookups} Places lookups.`
    );
  } catch (err) {
    await prisma.pipelineRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        status: "failed",
        errors: { message: err instanceof Error ? err.message : String(err) },
      },
    });
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
