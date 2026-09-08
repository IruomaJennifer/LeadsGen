import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "../generated/prisma/client";
import type { MappedCompany, MappedPosting } from "./mapper";

export interface UpsertResult {
  companiesNew: number;
  companiesUpdated: number;
  postingsInserted: number;
}

// Dedupe in memory -> 3 bulk statements (companies upsert, postings insert,
// leads ensure). No per-row existence checks, no full-table load (Step 2.5).
export async function upsertBatch(
  prisma: PrismaClient,
  companies: MappedCompany[],
  postings: MappedPosting[]
): Promise<UpsertResult> {
  if (companies.length === 0) {
    return { companiesNew: 0, companiesUpdated: 0, postingsInserted: 0 };
  }

  const byDomain = new Map<string, MappedCompany>();
  for (const company of companies) byDomain.set(company.domain, company);
  const uniqueCompanies = [...byDomain.values()];
  const domains = uniqueCompanies.map((c) => c.domain);

  const companyRows = uniqueCompanies.map(
    (c) =>
      Prisma.sql`(${randomUUID()}::text, ${c.domain}::text, ${c.name}::text, ${c.website}::text, ${c.linkedinUrl}::text, ${c.industry}::text, ${c.description}::text, ${c.employeeCount}::int, ${c.employeeRange}::text, ${c.foundedYear}::int, ${c.recentJobPostings}::int, ${c.companyType}::text, ${c.hqCity}::text, ${c.hqCountry}::text, now())`
  );

  // `id` has no DB-level default (Prisma's @default(uuid()) is applied by the
  // query builder, not Postgres) so raw SQL must generate it itself. Same for
  // `updated_at` (@updatedAt is also client-side-only, no DB default).
  // `phone`/`email` are never in this statement, so they're structurally safe
  // from being clobbered by re-scrapes. COALESCE fills blanks only.
  const companyResults = await prisma.$queryRaw<{ id: string; domain: string; inserted: boolean }[]>`
    INSERT INTO companies (id, domain, name, website, linkedin_url, industry, description, employee_count, employee_range, founded_year, recent_job_postings, company_type, hq_city, hq_country, updated_at)
    VALUES ${Prisma.join(companyRows)}
    ON CONFLICT (domain) DO UPDATE SET
      name = COALESCE(companies.name, EXCLUDED.name),
      website = COALESCE(companies.website, EXCLUDED.website),
      linkedin_url = COALESCE(companies.linkedin_url, EXCLUDED.linkedin_url),
      industry = COALESCE(companies.industry, EXCLUDED.industry),
      description = COALESCE(companies.description, EXCLUDED.description),
      employee_count = COALESCE(companies.employee_count, EXCLUDED.employee_count),
      employee_range = COALESCE(companies.employee_range, EXCLUDED.employee_range),
      founded_year = COALESCE(companies.founded_year, EXCLUDED.founded_year),
      recent_job_postings = COALESCE(companies.recent_job_postings, EXCLUDED.recent_job_postings),
      company_type = COALESCE(companies.company_type, EXCLUDED.company_type),
      hq_city = COALESCE(companies.hq_city, EXCLUDED.hq_city),
      hq_country = COALESCE(companies.hq_country, EXCLUDED.hq_country),
      updated_at = now()
    RETURNING id, domain, (xmax = 0) AS inserted
  `;

  const companiesNew = companyResults.filter((r) => r.inserted).length;
  const companiesUpdated = companyResults.length - companiesNew;

  let postingsInserted = 0;
  if (postings.length > 0) {
    const postingRows = postings.map(
      (p) =>
        Prisma.sql`(${randomUUID()}::text, ${p.datablistJobId}::text, ${p.companyDomain}::text, ${p.title}::text, ${p.description}::text, ${p.url}::text, ${p.source}::text, ${p.jobType}::text, ${p.workplaceType}::text, ${p.seniority}::text, ${p.salary}::text, ${p.location}::text, ${p.country}::text, ${p.datePosted}::timestamptz, ${p.contactName}::text, ${p.contactRole}::text, ${p.contactLinkedin}::text)`
    );

    const postingResults = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO job_postings (id, datablist_job_id, company_id, title, description, url, source, job_type, workplace_type, seniority, salary, location, country, date_posted, contact_name, contact_role, contact_linkedin)
      SELECT v.id, v.datablist_job_id, c.id, v.title, v.description, v.url, v.source, v.job_type, v.workplace_type, v.seniority, v.salary, v.location, v.country, v.date_posted, v.contact_name, v.contact_role, v.contact_linkedin
      FROM (VALUES ${Prisma.join(postingRows)}) AS v(id, datablist_job_id, domain, title, description, url, source, job_type, workplace_type, seniority, salary, location, country, date_posted, contact_name, contact_role, contact_linkedin)
      JOIN companies c ON c.domain = v.domain
      ON CONFLICT (datablist_job_id) DO NOTHING
      RETURNING id
    `;
    postingsInserted = postingResults.length;
  }

  await prisma.$executeRaw`
    INSERT INTO leads (id, company_id, updated_at)
    SELECT gen_random_uuid()::text, id, now() FROM companies WHERE domain = ANY(${domains}::text[])
    ON CONFLICT (company_id) DO NOTHING
  `;

  return { companiesNew, companiesUpdated, postingsInserted };
}
