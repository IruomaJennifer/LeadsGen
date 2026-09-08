-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "website" TEXT,
    "linkedin_url" TEXT,
    "industry" TEXT,
    "description" TEXT,
    "employee_count" INTEGER,
    "employee_range" TEXT,
    "founded_year" INTEGER,
    "recent_job_postings" INTEGER,
    "company_type" TEXT,
    "hq_city" TEXT,
    "hq_country" TEXT,
    "phone" TEXT,
    "phone_source" TEXT,
    "email" TEXT,
    "email_source" TEXT,
    "places_place_id" TEXT,
    "places_looked_up_at" TIMESTAMP(3),
    "places_match_status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_postings" (
    "id" TEXT NOT NULL,
    "datablist_job_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "url" TEXT,
    "source" TEXT,
    "job_type" TEXT,
    "workplace_type" TEXT,
    "seniority" TEXT,
    "salary" TEXT,
    "location" TEXT,
    "country" TEXT,
    "date_posted" TIMESTAMP(3),
    "contact_name" TEXT,
    "contact_role" TEXT,
    "contact_linkedin" TEXT,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_postings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "assigned_to" TEXT,
    "last_contacted_at" TIMESTAMP(3),
    "next_action_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_log" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "lead_id" TEXT,
    "type" TEXT NOT NULL,
    "channel" TEXT,
    "channel_detail" TEXT,
    "from_status" TEXT,
    "to_status" TEXT,
    "outcome" TEXT,
    "notes" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_runs" (
    "id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "status" TEXT,
    "watermark_from" TIMESTAMP(3),
    "watermark_to" TIMESTAMP(3),
    "jobs_pulled" INTEGER NOT NULL DEFAULT 0,
    "companies_new" INTEGER NOT NULL DEFAULT 0,
    "companies_updated" INTEGER NOT NULL DEFAULT 0,
    "places_lookups" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,

    CONSTRAINT "pipeline_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_domain_key" ON "companies"("domain");

-- CreateIndex
CREATE INDEX "companies_places_place_id_idx" ON "companies"("places_place_id");

-- CreateIndex
CREATE INDEX "companies_places_looked_up_at_idx" ON "companies"("places_looked_up_at");

-- CreateIndex
CREATE UNIQUE INDEX "job_postings_datablist_job_id_key" ON "job_postings"("datablist_job_id");

-- CreateIndex
CREATE INDEX "job_postings_company_id_idx" ON "job_postings"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "leads_company_id_key" ON "leads"("company_id");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "leads_created_at_idx" ON "leads"("created_at");

-- CreateIndex
CREATE INDEX "activity_log_company_id_idx" ON "activity_log"("company_id");

-- AddForeignKey
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
