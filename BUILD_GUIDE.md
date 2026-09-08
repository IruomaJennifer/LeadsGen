# Lead Generation Automation — Step-by-Step Build Guide

A sequential, self-contained implementation runbook for a staffing-business lead-generation system. Work through it top to bottom. Every step has a **Goal**, concrete **Actions**, and a **Verify** checkpoint you must pass before moving on. Code snippets are illustrative and target the recommended stack (TypeScript / Next.js / Prisma); adapt if you chose the alternative.

> **How to use with Claude Code:** feed this whole file as the project spec, or hand it one **Stage** at a time (Stage 1, then Stage 2, …). Do not skip the **Verify** checks — they are the definition of "done" for each step. Values marked **VERIFY** change at the provider and must be confirmed against the live source at build time.

---

## Table of Contents
- [Part A — Overview](#part-a--overview)
- [Part B — Stage 0: External Setup (manual, no code)](#part-b--stage-0-external-setup-manual-no-code)
- [Part C — Stage 1: Project & Database](#part-c--stage-1-project--database)
- [Part D — Stage 2: Datablist Ingestion](#part-d--stage-2-datablist-ingestion)
- [Part E — Stage 3: Google Places Enrichment](#part-e--stage-3-google-places-enrichment)
- [Part F — Stage 4: Dashboard API](#part-f--stage-4-dashboard-api)
- [Part G — Stage 5: Dashboard UI](#part-g--stage-5-dashboard-ui)
- [Part H — Stage 6: Deploy on Render](#part-h--stage-6-deploy-on-render)
- [Part I — Stage 7: Calling (Deferred)](#part-i--stage-7-calling-deferred)
- [Appendices](#appendices)

---

## Part A — Overview

### A.1 What the system does
Once per day it: (1) pulls fresh job postings matching our ICP from Datablist's job-board scraper, (2) stores them in Postgres deduplicated to one outreach record per company, (3) enriches each new company with a phone number via Google Places, (4) presents everything in a dashboard where the team tracks outreach status and views metrics.

### A.2 Ideal Customer Profile (ICP)
US-based **small businesses** posting **remote-capable** roles, which we pitch on offshore staffing. See the fill-in template in [Appendix E](#appendix-e--icp-configuration-template).

### A.3 Architecture (data flow)
```
[Datablist scraper]  ── scheduled DAILY in the Datablist UI (Data Source automation)
        │  writes ~100 new postings/day into a Datablist collection
        ▼
[Render Cron: daily pipeline]  ── auth + incremental pull (Datablist REST API)
        │                          dedup + upsert → Postgres
        │                          Google Places enrichment (net-new companies only)
        ▼
[Render Postgres]  ── companies / job_postings / leads / activity_log / pipeline_runs
        ▲
        │ reads + writes
[Render Web Service: dashboard]  ── metrics + lead worklist + status tracking
```

### A.4 Hard constraint — read this before Stage 2
The Datablist REST API is **CRUD-only** over `workspaces / collections / properties / items` and **cannot trigger a scrape**. The scrape is therefore scheduled **inside the Datablist UI**; our pipeline only **reads results out**. Do **not** build code that tries to start a scrape via the API.

### A.5 Recommended stack
TypeScript + **Next.js (App Router)** for the dashboard UI + API routes (one Render web service); **Prisma** for schema/migrations; **PostgreSQL** (Render managed); the daily pipeline as a standalone TS script run by a **Render Cron Job**; **Recharts** for charts. *Alternative:* Python (FastAPI + SQLAlchemy/Alembic) + React. Pick one language and stay consistent.

---

## Part B — Stage 0: External Setup (manual, no code)

Complete all of Stage 0 before writing code. Record the outputs (keys, IDs) in a password manager; you'll place them in env vars later.

### Step 0.1 — Datablist account, scheduled scraper, API key
**Goal:** a scheduled scraper producing ICP-matched postings, plus API credentials to read them.
**Actions:**
1. Subscribe to **Datablist Growth** (required for REST API + Data Source automation). *(**VERIFY** current price/credit allotment.)*
2. Create a collection and add the **Job Postings Scraper** data source.
3. Configure its filters to the ICP ([Appendix E](#appendix-e--icp-configuration-template)): `workplaceTypes=remote`, `companyCountries=US`, `minEmployeeCount`/`maxEmployeeCount`, exclude `recruiting_agency` via `companyType`, job-title/description keywords, `postedAge` ≤ 7 days.
4. Enable **scheduling** on the data source so it re-runs daily (Data Source automation).
5. Set the scraper **Limit** to the daily pull volume (see Volume blueprint below — default **65/day**).
6. Record the **collection ID**.
7. Account → API → create a **Personal API Key**; record it.

**Verify:** run the scraper once manually; confirm the collection fills with rows that have `jobCompanyCountryCode = US`, `jobWorkplaceType = remote`, and no recruiting-agency companies.

**Run a small test batch first.** Before committing to the daily schedule, pull ~50–100 rows once and eyeball them: check that the ICP filters held (US, remote, right role types), and watch the loose title keywords — **"Automation Specialist"** (can catch RPA/industrial roles) and **"Google Ads"** — for noise. Cut anything noisy before you turn on the daily run, so you're not paying credits for junk.

> **Volume blueprint (using September as the reference month).**
> Growth ≈ **240,000 credits/year** ÷ 10 credits per posting = **24,000 postings/year = 2,000/month** (a hard average).
> **Scheduler note:** Datablist's schedule offers only Monthly / Weekly / Daily / On demand — there is **no weekdays-only option.** "Daily" runs all 7 days, so the budget must be spread across ~30 days, not ~22 weekdays. September 2026 = 30 days. 2,000 ÷ 30 ≈ **65–67 postings/day**.
> - **Default — Frequency = Daily, Limit = 65/day:** 65 × 30 = 1,950 postings ≈ 19,500 credits/month → on budget, fully hands-off. **Use this.** (Trade-off: weekend postings are thinner — fewer companies post Sat/Sun — so some weekend pulls buy lower-quality leads.)
> - **Alternative — Limit = 90/day, Daily:** 90 × 30 = 2,700/month → ~7,000 credits/month over the plan share (~35% overage) → paid top-ups. Only worth it if the extra volume is genuinely useful to callers.
> - **Not recommended — "On demand" at 90/day, triggered weekdays only:** hits the original 22-weekday math but defeats the automation (you'd trigger it by hand each weekday).
>
> **Two caveats:** (1) a *posting* ≠ a *lead* — after dedup, ~65 postings/day may collapse to ~45–55 unique companies (companies are what you call). (2) The limit should ultimately be governed by **calling capacity**, not the credit ceiling — if the team can't work the daily fresh companies, you'll pay to scrape leads that go stale. **Recheck after the first week:** measure the actual posting→company dedup ratio, the weekend-quality drop-off, and your callers' daily throughput, then adjust the Limit (and consider Weekly-batch vs Daily) to match supply to capacity.
>
> **Datablist-side dedup:** scheduled imports can re-add the same posting. Your Postgres layer dedups on `datablist_job_id`/`domain` regardless, but to keep the Datablist collection itself clean, enable "Do not allow duplicate values" on the `jobOfferId` property.
>
> **Schedule timezone:** the run time is in your local zone (Africa/Lagos, GMT+1). Midnight local = evening US. Since jobs are filtered by posting *date* (not hour), this is harmless; only switch to US-Eastern if you later want to catch more of the same US day's fresh postings.

### Step 0.2 — Google Cloud, Places API (New), key + budget
**Goal:** a working Places API (New) key with a spending backstop.
**Actions:**
1. Create/choose a Google Cloud project; **enable billing** (see the billing note below).
2. Enable **Places API (New)** (not the legacy Places API) on that project. Enablement and key-restriction are two separate switches — do both.
3. Create an **API key** and restrict it in **two phases**:
   - **Now (API restriction):** restrict the key to **Places API (New)** only. Do this today. Confirm under Keys & Credentials → your key that "Places API (New)" is actually in the allowed list (if you restricted the key before enabling the API, it may have locked to the wrong thing).
   - **Later, at Stage 6 (application/IP restriction):** the "server IP" is your deployed **Render** backend's outbound IP — which doesn't exist yet. Leave Application restrictions = **None** for now; the unrestricted key works fine from your laptop during local dev (keep it in `.env`, never commit it). Add the IP lock once Render is live. Note: Render's cheaper tiers may not give a static outbound IP by default — if so, either enable a static-IP option or rely on the API restriction + budget cap instead.
4. In Billing, set a **budget + alert** (and, ideally, a **daily quota cap**). This is your real spending backstop — set it as soon as billing is active, before any Places calls.

**Verify:** a manual `places:searchText` call with `X-Goog-FieldMask: places.id` returns a `place_id` (see [Appendix C](#appendix-c--google-places-new-reference)).

> ⚠️ **BLOCKED-ITEM NOTE — billing verification (StaffBrigade specifics).** Google requires a small verification payment (~$10) to activate billing on a new account. On this account it is **stuck**, and the reason is known:
> - The card on the org workspace belongs to the **boss** (Visa ending 5262), and the payment triggers a **3-D Secure step-up** that texts a one-time passcode to **his** phone. Whoever runs the console can't complete it without that code.
> - Repeated failed attempts caused Google to **close the billing account** ("not in good standing" — cannot self-reopen).
>
> **Unblock steps, in order, for whoever returns to this:**
> 1. With the **boss present** (or on a screen-share), redo the ~$10 verification so he can read back the 3-D Secure passcode sent to phone …5262. (Alternatively, the boss completes the $10 himself on his own login.)
> 2. If the billing account still shows **closed** after the payment clears, a closed-for-standing account does **not** always auto-recover — contact **Google Cloud Billing Support** (Billing → Contact us; free-trial accounts still get billing support) and ask them to reopen / restore standing, referencing the now-successful payment.
> 3. Do **not** spin up a fresh workspace/console/billing account to dodge this — creating new billing accounts right after a closure worsens the automated risk flag. Reinstate this one.
> 4. Check the `admin@staffbrigade.com` inbox — Google usually emails the specific closure reason and a reinstatement link.
>
> **This does not block the build.** Places is Stage 3; Stages 1, 2, and 4 (schema, Datablist pull, dedup, dashboard scaffold) are entirely Google-free. Build those now and wire Places in last, once billing is restored.

### Step 0.3 — Render account
**Goal:** hosting ready.
**Actions:** create a Render account; confirm you can create a Postgres instance, a Web Service, and a Cron Job.
**Verify:** account dashboard shows those three resource types available.

### Step 0.4 — Local dev prerequisites
**Goal:** a machine that can build the stack.
**Actions:** install Node LTS (**VERIFY** the version Next.js currently requires) and a local Postgres (or use a Render dev DB). Confirm `node`, `npm`, and `psql` work.
**Verify:** `node -v` and `psql --version` succeed.

---

## Part C — Stage 1: Project & Database

### Step 1.1 — Scaffold the app
**Goal:** an empty, running Next.js + TS app.
**Actions:**
```bash
npx create-next-app@latest lead-gen --typescript --app --eslint
cd lead-gen
```
**Verify:** `npm run dev` serves the default page at `http://localhost:3000`.

### Step 1.2 — Add Prisma + Postgres
**Goal:** ORM wired to a database.
**Actions:**
```bash
npm install prisma @prisma/client
npx prisma init
```
Set `DATABASE_URL` in `.env` to your local/Render Postgres.
**Verify:** `npx prisma db pull` connects without error (empty schema is fine).

### Step 1.3 — Define the schema
**Goal:** all tables, keys, and indexes exist as code.
**Actions:** put the schema below in `prisma/schema.prisma`. (SQL-DDL equivalent is in [Appendix A](#appendix-a--full-sql-ddl) if you use the Python/SQL route.)

```prisma
model Company {
  id                 String    @id @default(uuid())
  name               String
  domain             String?   @unique          // normalized; primary dedup key
  website            String?
  linkedinUrl        String?
  industry           String?                     // jobCompanyIndustry
  description        String?                     // jobCompanyDescription
  employeeCount      Int?                        // jobCompanyEmployeeCount
  employeeRange      String?                     // jobCompanyStaffRange (e.g. 1-10, 11-50)
  foundedYear        Int?                        // jobCompanyFounded
  recentJobPostings  Int?                        // jobCompanyNumJobsLastMonth (buying signal)
  companyType        String?                     // jobCompanyType: direct_employer | recruiting_agency
  hqCity             String?                     // jobCompanyCity
  hqCountry          String?                     // jobCompanyCountry
  phone              String?                     // from Google Places (Stage 3)
  phoneSource        String?
  email              String?                     // user-maintained; editable in the dashboard (not from Datablist)
  emailSource        String?                     // e.g. manual
  placesPlaceId      String?
  placesLookedUpAt   DateTime?                   // set even on no-match (prevents re-billing)
  placesMatchStatus  String?                     // matched | no_match
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
  jobPostings        JobPosting[]
  lead               Lead?
  activity           ActivityLog[]
  @@index([placesPlaceId])
  @@index([placesLookedUpAt])
}

model JobPosting {
  id             String    @id @default(uuid())
  datablistJobId String    @unique               // dedup key for postings
  companyId      String
  company        Company   @relation(fields: [companyId], references: [id])
  title          String?                          // jobTitle
  description    String?                          // jobDescription
  url            String?                          // jobUrl
  source         String?                          // jobSourceUrl (Indeed | LinkedIn Jobs | ...)
  jobType        String?                          // jobType
  workplaceType  String?                          // jobWorkplaceType: on_site|hybrid|remote
  seniority      String?                          // jobSeniority: c_level|staff|senior|junior|mid_level
  salary         String?                          // jobSalary
  location       String?                          // jobLocation
  country        String?                          // jobCountry
  datePosted     DateTime?                        // jobDatePosted
  contactName    String?                          // jobContactName (hiring manager — high-value for outreach)
  contactRole    String?                          // jobContactRole
  contactLinkedin String?                         // jobContactLinkedIn
  importedAt     DateTime  @default(now())
  @@index([companyId])
}

model Lead {
  id               String    @id @default(uuid())
  companyId        String    @unique              // one lead per company
  company          Company   @relation(fields: [companyId], references: [id])
  status           String    @default("new")      // see "Lead status model" after this schema: new|contacted|warm|cold|won|lost|dnc
  assignedTo       String?
  lastContactedAt  DateTime?
  nextActionAt     DateTime?
  notes            String?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  activity         ActivityLog[]
  @@index([status])
  @@index([createdAt])
}

model ActivityLog {
  id         String   @id @default(uuid())
  companyId  String
  company    Company  @relation(fields: [companyId], references: [id])
  leadId     String?
  lead       Lead?    @relation(fields: [leadId], references: [id])
  type          String                            // status_change | note | contact | call(future)
  channel       String?                           // phone | email | phone_and_email | other  (for contact activity)
  channelDetail String?                           // free text describing how, required when channel = 'other'
  fromStatus    String?
  toStatus      String?
  outcome       String?
  notes         String?
  createdBy     String?
  createdAt     DateTime @default(now())
  @@index([companyId])
}

model PipelineRun {
  id                String    @id @default(uuid())
  startedAt         DateTime  @default(now())
  finishedAt        DateTime?
  status            String?                        // success | partial | failed
  watermarkFrom     DateTime?
  watermarkTo       DateTime?
  jobsPulled        Int       @default(0)
  companiesNew      Int       @default(0)
  companiesUpdated  Int       @default(0)
  placesLookups     Int       @default(0)
  errors            Json?
}
```

**Verify:** `npx prisma validate` passes.

#### Lead status model (definitions)
A lead is one company you're trying to convert. `status` is where that company sits in your outreach pipeline. Use exactly these values:

| Status | Meaning | Typical transition into it |
|---|---|---|
| `new` | Ingested, never contacted. The default for every freshly scraped company. | Set automatically by the pipeline. |
| `contacted` | At least one outreach attempt made — **by phone or email** — with no meaningful reply yet. Channel-agnostic on purpose. | Rep makes a call or sends an email. |
| `warm` | The prospect **responded with interest** or agreed to a next step (asked questions, requested info, booked a call). Actively progressing. | A positive reply/engagement comes back. |
| `cold` | Contacted, but outreach hasn't produced interest — either no response after your set number of attempts, or a soft "not right now." | Attempts exhausted, or a non-committal/no reply. |
| `won` | Converted — they became a client. | Deal closed. |
| `lost` | Explicitly declined or dead. | Hard "no". |
| `dnc` | Do-not-contact — asked to stop / opted out. Never contact again (compliance). | Opt-out request. |

**So what makes a lead warm vs cold?** The trigger is the **prospect's response, not your effort.** You reach out → the lead is `contacted`. If they answer with any genuine interest, it's `warm`. If they don't bite — silence after your attempt cap, or a polite brush-off — it's `cold`. `cold` isn't permanent: a cold lead can be re-worked later (move it back to `contacted`) or eventually marked `lost`. This is a team convention, so agree on your "attempt cap" (e.g. 3 tries before cold) and apply it consistently.

Typical flow: `new → contacted → warm → won/lost`, with `contacted → cold` when there's no traction, and `dnc` reachable from anywhere.

**Contact details:** `phone` (auto-filled by Google Places) and `email` (you fill/edit manually in the dashboard) both live on the `Company`. Each outreach is logged in `ActivityLog` with a `channel` of `phone`, `email`, `phone_and_email` (reached out both ways in one action), or `other` — and when it's `other`, the rep types how they reached out into `channelDetail` (e.g. "LinkedIn DM", "contact form").


### Step 1.4 — Run the first migration
**Goal:** tables exist in the database.
**Actions:** `npx prisma migrate dev --name init`
**Verify:** `psql $DATABASE_URL -c "\dt"` lists all five tables.

### Step 1.5 — Config & env loading
**Goal:** one place to read config safely.
**Actions:** create `src/lib/config.ts` that reads and validates env vars (fail fast if any required one is missing): `DATABASE_URL`, `DATABLIST_API_KEY`, `DATABLIST_COLLECTION_ID`, `GOOGLE_MAPS_API_KEY`, `PIPELINE_TIMEZONE`, and the optional `PLACES_ALERT_THRESHOLD`. See [Appendix D](#appendix-d--environment-variables).
**Verify:** app throws a clear error on a missing var and starts cleanly when all are present.

---

## Part D — Stage 2: Datablist Ingestion

Build the pipeline that pulls postings and lands deduped rows. No enrichment yet.

### Step 2.1 — Datablist auth client
**Goal:** exchange the Personal API Key for a short-lived access token.
**Actions:** create `src/lib/datablist.ts`:
```ts
const ACCOUNT = "https://account.datablist.com";
const API = "https://data.datablist.com";

export async function getDatablistToken(apiKey: string): Promise<string> {
  const res = await fetch(`${ACCOUNT}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ apiKey }),
  });
  if (!res.ok) throw new Error(`Datablist token failed: ${res.status}`);
  const data = await res.json();
  return data.access_token as string; // JWT, ~24h
}
```
**Verify:** a script call returns a non-empty token.

### Step 2.2 — Incremental item fetch
**Goal:** pull only items created since the last successful run, with pagination.
**Actions:** add a fetch that filters on `createdAt >= watermark` and orders ascending.
```ts
// NOTE: confirm the exact items path + pagination params against the Items reference:
// https://developers.datablist.com/docs/api-reference/items
export async function fetchNewItems(token: string, collectionId: string, sinceIso: string) {
  const filter = encodeURIComponent(JSON.stringify([
    { name: "createdAt", op: "ge", val: sinceIso },
  ]));
  const url = `${API}/collections/${collectionId}/items?filter=${filter}&order_by=createdAt`;
  const items: any[] = [];
  let next: string | null = url;
  while (next) {
    const res = await fetch(next, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    if (!res.ok) throw new Error(`Datablist items failed: ${res.status}`);
    const page = await res.json();
    items.push(...(page.data ?? []));
    next = page.next ?? null; // adjust to actual pagination field
  }
  return items;
}
```
**Verify:** with a recent `sinceIso`, the call returns the postings you saw in Step 0.1. Filter operators available: `eq`, `ge`, `in`, `not-in`, `array_contains` ([Appendix B](#appendix-b--datablist-api-cheat-sheet)).

### Step 2.3 — Field mapping
**Goal:** map every Datablist scraper output field to our models — nothing dropped, nothing guessed. This table is the authoritative source-of-truth (verified against the scraper's documented outputs).

**Posting fields → `JobPosting`:**
| Datablist output (key) | Model field |
|---|---|
| `jobOfferId` | `datablistJobId` (unique — dedup key) |
| `jobTitle` | `title` |
| `jobDescription` | `description` |
| `jobUrl` | `url` |
| `jobSourceUrl` | `source` |
| `jobType` | `jobType` |
| `jobLocation` | `location` |
| `jobCountry` | `country` |
| `jobWorkplaceType` | `workplaceType` |
| `jobSeniority` | `seniority` |
| `jobSalary` | `salary` |
| `jobDatePosted` | `datePosted` |
| `jobContactName` | `contactName` (hiring manager) |
| `jobContactRole` | `contactRole` |
| `jobContactLinkedIn` | `contactLinkedin` |

**Company fields → `Company`** (deduped; fill-empty-only on upsert):
| Datablist output (key) | Model field |
|---|---|
| `jobCompanyName` | `name` |
| `jobCompanyWebsite` | `website` (+ derive `domain`) |
| `jobCompanyType` | `companyType` |
| `jobCompanyLinkedinUrl` | `linkedinUrl` |
| `jobCompanyDescription` | `description` |
| `jobCompanyEmployeeCount` | `employeeCount` |
| `jobCompanyStaffRange` | `employeeRange` |
| `jobCompanyIndustry` | `industry` |
| `jobCompanyFounded` | `foundedYear` |
| `jobCompanyCity` | `hqCity` |
| `jobCompanyCountry` | `hqCountry` |
| `jobCompanyNumJobsLastMonth` | `recentJobPostings` |
| *(not from Datablist)* | `email` — user-entered in the dashboard |

> **Watch-outs (verified against the live field list):** the employee-range key is `jobCompanyStaffRange`, **not** `jobCompanyEmployeeRange`. Hiring-manager LinkedIn is `jobContactLinkedIn` (capital `IN`). `phone` and `email` are **not** Datablist fields — `phone` comes from Google Places (Stage 3) and `email` is entered by the user in the dashboard. The hiring-manager trio is high-value: a named contact with a LinkedIn is a better outreach target than a generic company phone, so surface it on the lead. We intentionally do **not** store: `jobClosedAt` (only open roles are scraped), `jobCompanyFundingStage`, `jobCompanyRevenue`, `jobCompanyNumJobs`, `jobCompanyCountryCode` — ignore these keys in the response.

> **Where ICP filtering happens (important):** the ICP filters (remote / US HQ / small-business size / exclude recruiting agencies / keywords / recency) are applied **inside the Datablist scraper configuration** (Step 0.1), at scrape time. The collection therefore only ever contains ICP-matching rows. Our API pull does **not** re-filter for ICP; the only filter it sends is the incremental `createdAt >= watermark` (Step 2.2), applied **server-side by Datablist** so we download just the new rows, never fetch-then-discard.

**Verify:** a mapper unit test converts one sample scraper item into the expected `Company` + `JobPosting` shapes with every column above populated.

### Step 2.4 — Domain normalization
**Goal:** a stable dedup key from the company website.
**Actions:** `normalizeDomain(website)` → lowercase, strip protocol/`www.`, keep registrable domain. If no website, dedup fallback = `lower(name)+hqCountry`.
**Verify:** `https://www.Acme.com/careers` and `http://acme.com` both normalize to `acme.com`.

### Step 2.5 — Upsert + dedup (bulk, no pre-fetch)
**Goal:** idempotent writes with no duplicates — using a small, constant number of queries per run, **not** a database round-trip per row.

**You do NOT read the table first.** There's no "load all existing records, compare in memory, then decide." That would be slow and pointless. Instead you let Postgres enforce dedup at write time through the unique constraints (`companies.domain`, `job_postings.datablist_job_id`, `leads.company_id`) and use bulk `INSERT … ON CONFLICT` statements. The number of queries stays flat (≈3) whether the batch is 10 rows or 2,000.

**Actions (per run):**
1. **Deduplicate the batch in memory first.** A single pull can contain several postings from the same company, so collapse the fetched items to a unique-by-`domain` set of companies before writing (this just avoids duplicate keys inside one INSERT — it's cheap, in-memory, no DB calls).
2. **Bulk-upsert companies** in one statement:
   ```sql
   INSERT INTO companies (domain, name, website, ...)
   VALUES (...), (...), ...            -- the whole batch at once
   ON CONFLICT (domain) DO UPDATE
     SET name = COALESCE(companies.name, EXCLUDED.name),
         website = COALESCE(companies.website, EXCLUDED.website),
         ...                            -- fill-empty-only via COALESCE
   ;
   ```
   `COALESCE(existing, new)` keeps any value we already have and only fills blanks, so re-scrapes never clobber good data. `phone`/`email` aren't in this INSERT at all, so they're structurally safe. *(Simpler alternative if you don't care about back-filling firmographics: `ON CONFLICT (domain) DO NOTHING` — first write wins.)*
3. **Bulk-insert postings** in one statement: `INSERT … ON CONFLICT (datablist_job_id) DO NOTHING`. (Prisma: `createMany({ data, skipDuplicates: true })`.)
4. **Bulk-ensure leads** in one statement: insert a `leads` row for every company id that doesn't have one — `INSERT INTO leads (company_id) SELECT id FROM companies WHERE domain = ANY($batchDomains) ON CONFLICT (company_id) DO NOTHING`.

That's the whole write path: dedupe in memory → 3 bulk statements. No per-row existence checks, no full-table load.

**Verify:** run the pipeline twice on the same window → row counts are identical after the second run (no dupes), and the query count per run does not grow with batch size.

### Step 2.6 — Pipeline entrypoint + watermark
**Goal:** one script that runs the whole daily job and remembers where it stopped, so each run only pulls what's new.

**What a "watermark" is, simply.** Think of it as a bookmark in time. Datablist keeps adding rows to the collection every day. Rather than re-download the entire collection each run (wasteful, and it grows forever), we record the timestamp of the newest row we successfully processed. That saved timestamp is the watermark. Next run, we tell Datablist "only give me rows created *after* this timestamp." So run 1 might pull everything from the last 48h, save a watermark of, say, `Aug 30 06:00`; run 2 then asks only for rows created after `Aug 30 06:00`, gets the ~100 new ones, and saves a fresh watermark. We keep the watermark in the `pipeline_runs` table (`watermarkTo`).

**What the script does, in order:**
1. Create a new `pipeline_runs` row (marks the run "started").
2. Read the `watermarkTo` from the **last successful** run. If there isn't one (first ever run), default to "now minus 48 hours."
3. Get a Datablist token (Step 2.1).
4. Fetch items created after that watermark (Step 2.2).
5. Map + bulk-upsert them (Steps 2.3–2.5).
6. (Stage 3 will add enrichment here.)
7. Update the `pipeline_runs` row: set counts (`jobsPulled`, `companiesNew`, …), set the new `watermarkTo` to the newest `createdAt` seen this run, and set `status = success` (or `failed` if it threw).

Because step 2 always resumes from the last **successful** watermark, a failed run doesn't skip data — the next run re-covers the same window. Combined with the `ON CONFLICT` upserts from Step 2.5, re-covering is harmless (no duplicates).

**File:** `scripts/daily-pipeline.ts`.
**Verify:** `npx tsx scripts/daily-pipeline.ts` completes, inserts a `PipelineRun` row with sensible counts, and a second immediate run pulls ~0 new items (because the watermark advanced).

### Step 2.7 — Stage 2 acceptance
**Verify (all must pass):**
- New ICP-matching postings appear in `job_postings`.
- Companies are deduped (one row per domain).
- Every company has exactly one `lead` (status `new`).
- Re-running changes nothing.

---

## Part E — Stage 3: Google Places Enrichment

Add phone numbers for **net-new** companies only, using the two-step cost-optimized pattern with caching. No hard cap — enrichment always runs (see Step 3.3).

### Step 3.1 — Places two-step client
**Goal:** resolve a company to a phone as cheaply as possible.
**Actions:** create `src/lib/places.ts`:
```ts
const BASE = "https://places.googleapis.com/v1";

// Step A: free IDs-only Text Search (Essentials SKU)
export async function findPlaceId(key: string, query: string): Promise<string | null> {
  const res = await fetch(`${BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.id",           // IDs only → free/unlimited
    },
    body: JSON.stringify({ textQuery: query }),
  });
  if (!res.ok) throw new Error(`searchText ${res.status}`);
  const data = await res.json();
  return data.places?.[0]?.id ?? null;
}

// Step B: Place Details for phone (Enterprise SKU)
export async function getPhone(key: string, placeId: string): Promise<string | null> {
  const res = await fetch(`${BASE}/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "nationalPhoneNumber", // Enterprise; add displayName,formattedAddress to sanity-check (still Enterprise, no extra SKU)
    },
  });
  if (!res.ok) throw new Error(`placeDetails ${res.status}`);
  const data = await res.json();
  return data.nationalPhoneNumber ?? null;
}
```
> **Field-mask hygiene (cost-critical):** request only `places.id` in Step A and only the phone (+ optional name/address) in Step B. **Never** add reviews/photos/ratings — one such field re-prices the whole call at the Atmosphere tier (~$40/1k). **VERIFY** current SKU rates ([Appendix C](#appendix-c--google-places-new-reference)).

**Verify:** for a known local business, the two calls return a plausible phone.

### Step 3.2 — Net-new selection + cache writes
**Goal:** only ever look up companies never looked up before.
**Actions:** select companies where `phone IS NULL AND placesLookedUpAt IS NULL`. For each, build the query `"<name> <hqCity>"`, run Step A → Step B, then write `phone`, `placesPlaceId`, `placesMatchStatus` (`matched`/`no_match`) and **always** set `placesLookedUpAt = now()` even on no match.
**Verify:** after a run, net-new companies have `placesLookedUpAt` set; a second run selects **zero** companies to enrich.

### Step 3.3 — Cost visibility (no hard cap)
**Goal:** stay aware of spend without ever pausing enrichment.
**Why no cap:** two things already keep Places spend trivial — the two-step pattern (the search is free; only the phone lookup is billable) and caching (net-new companies only, so repeat posters are never re-looked-up). At ~2,000 listings/month, unique billable lookups are low and worst-case cost is a few dollars, so a hard "stop enriching" gate would do more harm (missing phones) than good.
**Actions:** don't gate enrichment. Just keep counting `placesLookups` per run for visibility, and **optionally** log a one-line warning if the running monthly total crosses a soft threshold (e.g. an env `PLACES_ALERT_THRESHOLD`, default off). The real spending backstop is the **Google Cloud budget alert** you set in Step 0.2 — that lives at the billing layer, not in app logic. Enrichment always proceeds.
**Verify:** a run logs its lookup count; setting a low `PLACES_ALERT_THRESHOLD` emits a warning **but enrichment still completes** (nothing is skipped).

### Step 3.4 — Wire into the pipeline
**Goal:** enrichment runs after ingestion each day.
**Actions:** call the enrichment step at the end of `daily-pipeline.ts`, after upserts; record `placesLookups` on the `PipelineRun`.
**Verify:** a full run ingests then enriches in one pass.

### Step 3.5 — Stage 3 acceptance
**Verify:** net-new companies get phones; re-runs perform **zero** new lookups; no-match companies are marked and not retried; enrichment is never blocked (only optionally logged).

---

## Part F — Stage 4: Dashboard API

### Step 4.1 — Leads list
`GET /api/leads?status=&search=&sort=&page=` → paginated leads joined to company (name, phone, website, location) + latest role. **Verify:** filtering by `status=new` and searching by company name work.

### Step 4.2 — Lead detail
`GET /api/leads/:id` → company profile + all its `job_postings` + `activity_log`. **Verify:** returns every posting for a multi-posting company.

### Step 4.3 — Status & contact-detail update
`PATCH /api/leads/:id` (status / assignedTo / notes) → updates `Lead` **and** writes an `ActivityLog` row (`type=status_change`, `fromStatus`, `toStatus`). `PATCH /api/companies/:id` (email) → lets the user add or edit the company's `email` (sets `emailSource='manual'`). `POST /api/leads/:id/activity` logs a note **or a contact attempt** (`type=contact`, `channel` = `phone` | `email` | `phone_and_email` | `other`; when `other`, require a non-empty `channelDetail`). **Verify:** a status change and a logged phone/email contact both appear in the lead's activity history, and an edited email persists.

### Step 4.4 — Metrics
`GET /api/metrics/summary` (counts by status, uncalled queue size, warm rate) and `GET /api/metrics/timeseries?metric=leads_created&range=30d`. **Verify:** numbers reconcile with raw SQL counts.

### Step 4.5 — Stage 4 acceptance
**Verify:** all endpoints return correct data and status changes are logged.

---

## Part G — Stage 5: Dashboard UI

### Step 5.1 — Auth
**Goal:** the dashboard is not publicly open.
**Actions:** add simple team auth (Auth.js/Clerk, or email+password with hashed creds, or env-based basic auth as a minimum). **Confirm choice** ([Appendix E](#appendix-e--icp-configuration-template) / §Open Decisions).
**Verify:** unauthenticated requests to dashboard pages/APIs are rejected.

### Step 5.2 — Worklist page
Filterable, sortable, paginated table of leads showing company, phone, email, top role(s), location, status — with inline actions to change status (new→contacted→warm/cold/won/lost/dnc), log a contact (channel: phone, email, both, or other-with-a-note), edit the email, add notes, and assign. **Verify:** changing a status persists and refreshes the row; logging an "other" contact requires the free-text detail; editing an email saves.

### Step 5.3 — Lead detail page
Company info (incl. editable `email` and any hiring-manager contact), all roles, activity timeline (status changes + phone/email contacts + notes), editable status/notes. **Verify:** edits persist and show in the timeline.

### Step 5.4 — Metrics page
Charts: leads/day, status breakdown, warm vs cold, source + state breakdown. **Verify:** charts match the metrics API.

### Step 5.5 — Stage 5 acceptance
**Verify:** a rep can log in, work the list, and a manager can read metrics — end to end against real ingested data.

---

## Part H — Stage 6: Deploy on Render

### Step 6.1 — Postgres
Create a Render PostgreSQL instance; copy its connection string to `DATABASE_URL`. **Verify:** `prisma migrate deploy` runs against it.

### Step 6.2 — Web service
Deploy the Next.js app as a Render Web Service. Build runs `prisma generate` + `prisma migrate deploy` then the Next build; start serves the app. Set all env vars ([Appendix D](#appendix-d--environment-variables)). **Verify:** the dashboard loads over HTTPS and reads the DB.

### Step 6.3 — Cron job
Create a Render Cron Job running the compiled pipeline (`node scripts/daily-pipeline.js`) on a daily schedule **after** the Datablist scrape completes (set time via `PIPELINE_TIMEZONE`). **Verify:** a manual trigger produces a `PipelineRun` row and new leads in prod.

### Step 6.4 — Secrets
All keys as Render env vars; nothing committed. **Verify:** repo contains no secrets; app reads them from the environment.

### Step 6.5 — Stage 6 acceptance
**Verify:** an end-to-end daily cycle runs unattended — scrape (Datablist) → pull+enrich (cron) → visible new leads with phones in the dashboard.

---

## Part I — Stage 7: Calling (Deferred)

Not built now. When added: a CPaaS (Twilio/Telnyx) click-to-call in the dashboard; call webhooks write `ActivityLog` rows with `type="call"` (duration, outcome, recording URL) and auto-advance lead status. The schema already supports this — **no migration required**. Keep this stage out of the current build.

---

## Appendices

### Appendix A — Full SQL DDL
*(ORM-agnostic equivalent of Step 1.3, for the Python/SQL route.)*
```sql
CREATE TABLE companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  domain text UNIQUE,
  website text, linkedin_url text, industry text, description text,
  employee_count int, employee_range text,
  founded_year int, recent_job_postings int,
  company_type text,
  hq_city text, hq_country text,
  phone text, phone_source text,
  email text, email_source text,
  places_place_id text, places_looked_up_at timestamptz, places_match_status text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE job_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  datablist_job_id text UNIQUE NOT NULL,
  company_id uuid REFERENCES companies(id),
  title text, description text, url text, source text,
  job_type text, workplace_type text, seniority text, salary text,
  location text, country text, date_posted timestamptz,
  contact_name text, contact_role text, contact_linkedin text,
  imported_at timestamptz DEFAULT now()
);
CREATE TABLE leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid UNIQUE REFERENCES companies(id),
  status text NOT NULL DEFAULT 'new',
  assigned_to text, last_contacted_at timestamptz, next_action_at timestamptz,
  notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id),
  lead_id uuid REFERENCES leads(id),
  type text, channel text, channel_detail text, from_status text, to_status text, outcome text, notes text,
  created_by text, created_at timestamptz DEFAULT now()
);
CREATE TABLE pipeline_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz DEFAULT now(), finished_at timestamptz, status text,
  watermark_from timestamptz, watermark_to timestamptz,
  jobs_pulled int DEFAULT 0, companies_new int DEFAULT 0,
  companies_updated int DEFAULT 0, places_lookups int DEFAULT 0, errors jsonb
);
CREATE UNIQUE INDEX ON companies(domain);
CREATE INDEX ON companies(places_place_id);
CREATE INDEX ON companies(places_looked_up_at);
CREATE INDEX ON job_postings(company_id);
CREATE INDEX ON leads(status);
CREATE INDEX ON leads(created_at);
```

### Appendix B — Datablist API cheat-sheet
- **Token:** `POST https://account.datablist.com/token` body `{"apiKey":"..."}` → `access_token` (JWT ~24h). Use `Authorization: Bearer <token>`.
- **Base:** `https://data.datablist.com`. Resources: `workspaces`, `collections`, `properties`, `items`. CRUD only — **no scrape-trigger endpoint**.
- **Filter:** `?filter=[{"name":"FIELD","op":"OP","val":"V"}]`; ops: `eq`, `ge`, `in`, `not-in`, `array_contains`.
- **Order:** `?order_by=FIELD` (prefix `-` for desc).
- **Bulk:** `{endpoint}/batch`; keep ≤ 20 concurrent requests × 200 ops.
- **API is Alpha / unversioned — confirm the exact items path + pagination against** `https://developers.datablist.com/docs/api-reference/items` **before trusting the Step 2.2 snippet.**

### Appendix C — Google Places (New) reference
- **Text Search (New):** `POST https://places.googleapis.com/v1/places:searchText`, header `X-Goog-FieldMask: places.id` (IDs-only = free/unlimited), body `{"textQuery":"..."}` → `places[0].id`.
- **Place Details (New):** `GET https://places.googleapis.com/v1/places/{PLACE_ID}`, header `X-Goog-FieldMask: nationalPhoneNumber` → phone. Phone/website are **Enterprise-tier** fields.
- **Free caps (per-SKU, monthly, don't pool):** Essentials 10,000 · Pro 5,000 · **Enterprise 1,000** — phone falls under Enterprise, so the first **1,000 lookups/month are free**, then ~$20/1,000. **VERIFY** on Google's live price list; billed at the **highest** field tier requested.
- **No app-level cap (by design):** at ~2,000 listings/month with net-new-only caching, worst-case spend is a few dollars, so enrichment is never blocked. The billing backstop is the Google Cloud **budget alert** (Step 0.2); the app only optionally logs a soft threshold (`PLACES_ALERT_THRESHOLD`).
- **Caching is the real cost lever:** enrich net-new companies only; the same SMBs repost constantly, so monthly unique lookups stay low.

### Appendix D — Environment variables
```
DATABASE_URL=              # Render Postgres connection string
DATABLIST_API_KEY=         # Personal API Key (Step 0.1)
DATABLIST_COLLECTION_ID=   # scraper collection (Step 0.1)
GOOGLE_MAPS_API_KEY=       # Places API (New) key (Step 0.2)
PLACES_ALERT_THRESHOLD=    # optional: log-only warning if monthly lookups exceed this (no blocking)
PIPELINE_TIMEZONE=America/New_York
APP_AUTH_SECRET=           # or auth-provider keys (Step 5.1)
```

### Appendix E — ICP configuration (settled)
The reference configuration confirmed with the team. Fill any remaining `___` before the first live run.

**Title filters (job side):**
```
Job Title Keywords:
Administrative Assistant,Virtual Assistant,Executive Assistant,Personal Assistant,Data Entry,
Bookkeeper,Accountant,Data Analyst,Power BI,Event Analyst,Customer Service,Customer Support,
Sales Development,SDR,Business Development Representative,BDR,Appointment Setter,Cold Caller,
Telemarketer,Lead Generation,Outbound Sales,Call Center,Google Ads,Automation Specialist,
Social Media,Content Writer
  (watch "Automation Specialist" and "Google Ads" for noise; cut if the test batch is dirty)

Exclude Job Title Keywords:
Medical,healthcare,Recruitment,Staffing,Recruiter,Talent Acquisition,Headhunter,Nurse,
Registered Nurse,Physician,Dental,Clinical,Therapist,Pharmacist,Attorney,Lawyer,Driver,
Warehouse,Electrician,Plumber,HVAC,Welder,Forklift,Delivery,Mechanic,Maintenance,Janitor,
Cleaner,Security Guard,Director,Vice President,Head of,Chief,Principal,Clearance,Intern
  (do NOT exclude bare "Senior/Lead/Manager" — over-cuts offshore-able roles)

Exclude Job DESCRIPTION Keywords (residency screen):
US only,U.S. only,United States only,US citizen,US citizens only,green card,security clearance,
US residents only,must reside in the United States,must be located in the United States,
must be based in the United States,no sponsorship
  (NEVER put a bare "US"/"USA"/"United States" here — whole-word match nukes almost everything)
```

**Job-side filters:**
```
Workplace type:     Remote
Job country:        United States
Job status:         Only Open Jobs (default)
Max age:            Last 7 days
```

**Company-side filters:**
```
Company HQ country:     United States   (Keep companies with unknown HQ: OFF here — HQ is required)
Company type:           Direct Employer  (excludes recruiting agencies)
Employee count:         min = 1   max = 1000   (defines "small business"; tune after test)
Company Funding Stage:  (leave BLANK — do not bias toward venture-backed firms)
Only companies w/ LinkedIn URL:  UNCHECKED (checking it silently drops small/older US SMBs)

Exclude Company Industries (exclude-not-include; unknown-industry companies are KEPT):
Administrative and Support Services > Facilities Services
Administrative and Support Services > Telephone Call Centers
Administrative and Support Services > Staffing and Recruiting
Professional Services > Business Consulting and Services > Human Resources Services
Professional Services > Business Consulting and Services > Outsourcing and Offshoring Consulting
Construction
Government Administration
Oil, Gas, and Mining
Farming, Ranching, Forestry
Utilities
  (optional add: Security and Investigations — low remote yield; title exclusions mostly cover it)
  (confirm sub-industries cascaded, e.g. Staffing → Executive Search, Temporary Help)
```

**Daily volume (September 2026 blueprint):**
```
Scheduler:       Frequency = Daily (runs all 7 days — no weekdays-only option exists)
Run days/month:  ~30 (Sep 2026 = 30 days)
Scraper Limit:   65 postings/day   (on-budget default; 65 × 30 ≈ 19,500 credits/month)
                 90/day Daily = ~35% over budget → top-ups (optional)
Timezone:        Africa/Lagos (GMT+1), Midnight — harmless (jobs filtered by date, not hour)
Datablist dedup: enable "Do not allow duplicate values" on jobOfferId property
Recheck week 1:  posting→company dedup ratio + weekend-quality drop-off + caller throughput;
                 retune Limit (and consider Weekly batch vs Daily) so supply matches capacity
```

### Appendix F — Glossary & VERIFY list
- **CPaaS:** communications platform (Twilio/Telnyx) — Stage 7 only.
- **Net-new company:** one never previously looked up (`placesLookedUpAt IS NULL`).
- **Watermark:** the `createdAt` cutoff for incremental Datablist pulls.
- **VERIFY at build time:** Datablist plan price/credits · Datablist items endpoint path + pagination · Places SKU rates + Enterprise free cap · Node version for Next.js.

### Open decisions to confirm (carry-over)
1. Final employee-count max (currently 1000 — tune after the test batch). 2. Datablist collection ID + confirmed Daily schedule + Limit (default 65/day for 7-day running). 3. Cron time/timezone. 4. Auth mechanism. 5. Stack confirmation (Next.js/TS default vs Python). 6. Live Places rate/field-tier re-check. 7. Caller daily capacity + weekend-quality check → retune scraper Limit after week 1. 8. **BLOCKED:** Google billing verification — needs boss's 3-D Secure passcode for the ~$10, then likely Billing Support to reopen (see Step 0.2). Does not block Stages 1–2, 4.
