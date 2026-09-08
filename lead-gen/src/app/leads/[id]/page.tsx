"use client";

import { use, useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ContactLogger } from "../../ContactLogger";
import { ChevronLeft, PencilIcon } from "../../icons";
import { LogoutButton } from "../../LogoutButton";
import { CopyButton } from "../../CopyButton";
import { ensureProtocol } from "@/lib/url";
import { colorForStatus } from "@/lib/chartColors";

interface Company {
  id: string;
  name: string;
  website: string | null;
  linkedinUrl: string | null;
  industry: string | null;
  description: string | null;
  employeeRange: string | null;
  hqCity: string | null;
  hqCountry: string | null;
  phone: string | null;
  email: string | null;
}

interface JobPosting {
  id: string;
  title: string | null;
  location: string | null;
  workplaceType: string | null;
  seniority: string | null;
  salary: string | null;
  url: string | null;
  datePosted: string | null;
  contactName: string | null;
  contactRole: string | null;
  contactLinkedin: string | null;
}

interface ActivityLogEntry {
  id: string;
  type: string;
  channel: string | null;
  channelDetail: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  notes: string | null;
  createdAt: string;
}

interface LeadDetail {
  lead: { id: string; status: string; assignedTo: string | null };
  company: Company;
  jobPostings: JobPosting[];
  activityLog: ActivityLogEntry[];
}

const infoRow: CSSProperties = { display: "flex", gap: "1rem", padding: "0.4rem 0", borderBottom: "1px solid var(--border)" };
const infoLabel: CSSProperties = { width: "8rem", flexShrink: 0, color: "var(--text-muted)", fontSize: "0.85rem" };

function activityDescription(a: ActivityLogEntry): string {
  if (a.type === "status_change") return `Status changed: ${a.fromStatus} → ${a.toStatus}`;
  if (a.type === "contact") {
    const parts = [`Contacted via ${a.channel?.replace(/_/g, " ")}${a.channelDetail ? ` (${a.channelDetail})` : ""}`];
    if (a.toStatus) parts.push(`outcome: ${a.toStatus}`);
    if (a.notes) parts.push(`"${a.notes}"`);
    return parts.join(" — ");
  }
  if (a.type === "note") return a.notes ?? "Note";
  return a.type;
}

// A value with a pencil icon to edit it in place — used for both email and
// phone, so a company missing either (Places enrichment found no phone, or
// Datablist had no email) can have it filled in manually.
function EditableField({
  value,
  type = "text",
  onSave,
}: {
  value: string | null;
  type?: string;
  onSave: (value: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);

  if (editing) {
    return (
      <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", flex: 1 }}>
        <input type={type} value={draft} onChange={(e) => setDraft(e.target.value)} style={{ flex: 1 }} autoFocus />
        <button
          type="button"
          onClick={async () => {
            setSaving(true);
            await onSave(draft);
            setSaving(false);
            setEditing(false);
          }}
          disabled={saving}
          style={{ padding: "0.3rem 0.7rem" }}
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setEditing(false);
            setDraft(value ?? "");
          }}
          style={{ padding: "0.3rem 0.7rem" }}
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
      {value}
      {value && <CopyButton value={value} />}
      <button
        type="button"
        className="secondary icon-button"
        onClick={() => setEditing(true)}
        aria-label="Edit"
        style={{ width: "1.6rem", height: "1.6rem" }}
      >
        <PencilIcon size={13} />
      </button>
    </span>
  );
}

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let active = true;
    fetch(`/api/leads/${id}`).then(async (res) => {
      if (!active || !res.ok) return;
      setDetail(await res.json());
    });
    return () => {
      active = false;
    };
  }, [id, reloadKey]);

  if (!detail) return <main style={{ padding: "2rem" }}>Loading...</main>;

  const { company, jobPostings, activityLog, lead } = detail;
  const hiringManager = jobPostings.find((p) => p.contactName);

  async function saveCompanyField(field: "email" | "phone", value: string) {
    const res = await fetch(`/api/companies/${company.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (res.ok) reload();
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
        <ChevronLeft size={14} /> Back to worklist
      </Link>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0.5rem 0 1.5rem" }}>
        <h1 style={{ margin: 0 }}>{company.name}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span className="status-pill" style={{ background: colorForStatus(lead.status) }}>
            {lead.status}
          </span>
          <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
            {lead.assignedTo ? `Assigned: ${lead.assignedTo}` : "Unassigned"}
          </span>
          <LogoutButton />
        </div>
      </div>

      <section>
        <h2>Company</h2>
        {company.description && <p style={{ color: "var(--text-secondary)" }}>{company.description}</p>}
        <div>
          <div style={infoRow}>
            <span style={infoLabel}>Industry</span>
            <span>{company.industry}</span>
          </div>
          <div style={infoRow}>
            <span style={infoLabel}>Size</span>
            <span>{company.employeeRange}</span>
          </div>
          <div style={infoRow}>
            <span style={infoLabel}>Location</span>
            <span>{[company.hqCity, company.hqCountry].filter(Boolean).join(", ")}</span>
          </div>
          <div style={infoRow}>
            <span style={infoLabel}>Phone</span>
            <EditableField value={company.phone} type="tel" onSave={(v) => saveCompanyField("phone", v)} />
          </div>
          <div style={infoRow}>
            <span style={infoLabel}>Email</span>
            <EditableField value={company.email} type="email" onSave={(v) => saveCompanyField("email", v)} />
          </div>
          <div style={infoRow}>
            <span style={infoLabel}>Website</span>
            {company.website && (
              <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <a href={ensureProtocol(company.website)} target="_blank" rel="noopener noreferrer">
                  {company.website}
                </a>
                <CopyButton value={company.website} />
              </span>
            )}
          </div>
          <div style={{ ...infoRow, borderBottom: "none" }}>
            <span style={infoLabel}>LinkedIn</span>
            {company.linkedinUrl && (
              <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <a href={ensureProtocol(company.linkedinUrl)} target="_blank" rel="noopener noreferrer">
                  {company.linkedinUrl}
                </a>
                <CopyButton value={company.linkedinUrl} />
              </span>
            )}
          </div>
        </div>
        {hiringManager && (
          <p style={{ marginTop: "1rem", fontSize: "0.9rem" }}>
            <strong>Hiring manager:</strong> {hiringManager.contactName} ({hiringManager.contactRole})
            {hiringManager.contactLinkedin && (
              <>
                {" — "}
                <a href={ensureProtocol(hiringManager.contactLinkedin)} target="_blank" rel="noopener noreferrer">
                  LinkedIn
                </a>
              </>
            )}
          </p>
        )}
      </section>

      <section>
        <h2>Roles ({jobPostings.length})</h2>
        {jobPostings.map((p) => (
          <div key={p.id} style={infoRow}>
            <div style={{ flex: 1 }}>
              {p.url ? (
                <a href={ensureProtocol(p.url)} target="_blank" rel="noopener noreferrer">
                  {p.title}
                </a>
              ) : (
                p.title
              )}
              <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                {p.location} · {p.workplaceType} · {p.seniority} · {p.salary ?? "n/a"} ·{" "}
                {p.datePosted ? new Date(p.datePosted).toLocaleDateString() : "n/a"}
              </div>
            </div>
          </div>
        ))}
      </section>

      <section>
        <h2>Log a contact</h2>
        <ContactLogger key={lead.id} leadId={lead.id} currentStatus={lead.status} onLogged={reload} />
      </section>

      <section>
        <h2>Activity</h2>
        {activityLog.length === 0 && <p style={{ color: "var(--text-muted)" }}>No activity yet.</p>}
        {activityLog.map((a) => (
          <div key={a.id} style={{ padding: "0.5rem 0", borderBottom: "1px solid var(--border)" }}>
            <div style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>{new Date(a.createdAt).toLocaleString()}</div>
            <div>{activityDescription(a)}</div>
          </div>
        ))}
      </section>
    </main>
  );
}
