import type { DatablistItem } from "./datablist";
import { normalizeDomain } from "./domain";

export interface MappedCompany {
  domain: string;
  name: string;
  website: string | null;
  linkedinUrl: string | null;
  companyType: string | null;
  description: string | null;
  employeeCount: number | null;
  employeeRange: string | null;
  industry: string | null;
  foundedYear: number | null;
  hqCity: string | null;
  hqCountry: string | null;
  recentJobPostings: number | null;
}

export interface MappedPosting {
  datablistJobId: string;
  companyDomain: string; // used to join to the company row at write time
  title: string | null;
  description: string | null;
  url: string | null;
  source: string | null;
  jobType: string | null;
  location: string | null;
  country: string | null;
  workplaceType: string | null;
  seniority: string | null;
  salary: string | null;
  datePosted: Date | null;
  contactName: string | null;
  contactRole: string | null;
  contactLinkedin: string | null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function date(v: unknown): Date | null {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function mapCompany(item: DatablistItem): MappedCompany {
  const website = str(item.jobCompanyWebsite);
  const name = str(item.jobCompanyName) ?? "Unknown";
  const hqCountry = str(item.jobCompanyCountry);
  return {
    domain: normalizeDomain(website, name, hqCountry),
    name,
    website,
    linkedinUrl: str(item.jobCompanyLinkedinUrl),
    companyType: str(item.jobCompanyType),
    description: str(item.jobCompanyDescription),
    employeeCount: num(item.jobCompanyEmployeeCount),
    employeeRange: str(item.jobCompanyStaffRange),
    industry: str(item.jobCompanyIndustry),
    foundedYear: num(item.jobCompanyFounded),
    hqCity: str(item.jobCompanyCity),
    hqCountry,
    recentJobPostings: num(item.jobCompanyNumJobsLastMonth),
  };
}

export function mapPosting(item: DatablistItem, companyDomain: string): MappedPosting {
  return {
    datablistJobId: String(item.jobOfferId),
    companyDomain,
    title: str(item.jobTitle),
    description: str(item.jobDescription),
    url: str(item.jobUrl),
    source: str(item.jobSourceUrl),
    jobType: str(item.jobType),
    location: str(item.jobLocation),
    country: str(item.jobCountry),
    workplaceType: str(item.jobWorkplaceType),
    seniority: str(item.jobSeniority),
    salary: str(item.jobSalary),
    datePosted: date(item.jobDatePosted),
    contactName: str(item.jobContactName),
    contactRole: str(item.jobContactRole),
    contactLinkedin: str(item.jobContactLinkedIn),
  };
}
