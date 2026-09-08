import { test } from "node:test";
import assert from "node:assert/strict";
import { mapCompany, mapPosting } from "./mapper";
import type { DatablistItem } from "./datablist";

const sampleItem: DatablistItem = {
  "@id": "item123",
  "@type": "JobOffer",
  createdAt: "2026-08-30T12:00:00.000Z",
  updatedAt: "2026-08-30T12:00:00.000Z",
  jobOfferId: "job-abc-123",
  jobTitle: "Virtual Assistant",
  jobDescription: "Support the founder with scheduling and inbox management.",
  jobUrl: "https://example.com/jobs/123",
  jobSourceUrl: "Indeed",
  jobType: "full_time",
  jobLocation: "Remote, US",
  jobCountry: "United States",
  jobWorkplaceType: "remote",
  jobSeniority: "junior",
  jobSalary: "$40,000 - $50,000",
  jobDatePosted: "2026-08-25T00:00:00.000Z",
  jobContactName: "Jane Doe",
  jobContactRole: "Founder",
  jobContactLinkedIn: "https://linkedin.com/in/janedoe",
  jobCompanyName: "Acme Co",
  jobCompanyWebsite: "https://www.Acme.com/careers",
  jobCompanyType: "direct_employer",
  jobCompanyLinkedinUrl: "https://linkedin.com/company/acme",
  jobCompanyDescription: "A small consulting firm.",
  jobCompanyEmployeeCount: 12,
  jobCompanyStaffRange: "11-50",
  jobCompanyIndustry: "Consumer Services",
  jobCompanyFounded: 2015,
  jobCompanyCity: "Austin",
  jobCompanyCountry: "United States",
  jobCompanyNumJobsLastMonth: 3,
  // fields we intentionally ignore
  jobClosedAt: null,
  jobCompanyFundingStage: "seed",
  jobCompanyRevenue: "1000000",
  jobCompanyNumJobs: 5,
  jobCompanyCountryCode: "US",
};

test("mapCompany converts every mapped field and normalizes the domain", () => {
  const company = mapCompany(sampleItem);
  assert.deepEqual(company, {
    domain: "acme.com",
    name: "Acme Co",
    website: "https://www.Acme.com/careers",
    linkedinUrl: "https://linkedin.com/company/acme",
    companyType: "direct_employer",
    description: "A small consulting firm.",
    employeeCount: 12,
    employeeRange: "11-50",
    industry: "Consumer Services",
    foundedYear: 2015,
    hqCity: "Austin",
    hqCountry: "United States",
    recentJobPostings: 3,
  });
});

test("mapPosting converts every mapped field", () => {
  const posting = mapPosting(sampleItem, "acme.com");
  assert.deepEqual(posting, {
    datablistJobId: "job-abc-123",
    companyDomain: "acme.com",
    title: "Virtual Assistant",
    description: "Support the founder with scheduling and inbox management.",
    url: "https://example.com/jobs/123",
    source: "Indeed",
    jobType: "full_time",
    location: "Remote, US",
    country: "United States",
    workplaceType: "remote",
    seniority: "junior",
    salary: "$40,000 - $50,000",
    datePosted: new Date("2026-08-25T00:00:00.000Z"),
    contactName: "Jane Doe",
    contactRole: "Founder",
    contactLinkedin: "https://linkedin.com/in/janedoe",
  });
});
