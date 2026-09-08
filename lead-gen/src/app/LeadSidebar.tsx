"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ContactLogger } from "./ContactLogger";
import { ChevronRight, CloseIcon } from "./icons";
import { CopyButton } from "./CopyButton";
import { colorForStatus } from "@/lib/chartColors";

interface LeadSidebarDetail {
  lead: { id: string; status: string; assignedTo: string | null };
  company: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    hqCity: string | null;
    hqCountry: string | null;
  };
  jobPostings: { title: string | null }[];
}

export function LeadSidebar({
  leadId,
  onClose,
  onSaved,
}: {
  leadId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [detail, setDetail] = useState<LeadSidebarDetail | null>(null);

  useEffect(() => {
    if (!leadId) return;
    let active = true;
    fetch(`/api/leads/${leadId}`).then(async (res) => {
      if (!active || !res.ok) return;
      setDetail(await res.json());
    });
    return () => {
      active = false;
    };
  }, [leadId]);

  if (!leadId) return null;

  function handleLogged() {
    onSaved();
    // Refresh local detail (status/assignedTo may have just changed) so the
    // sidebar's own read-only summary stays in sync without closing it.
    fetch(`/api/leads/${leadId}`).then(async (res) => {
      if (res.ok) setDetail(await res.json());
    });
  }

  return (
    <>
      <div className="sidebar-overlay" onClick={onClose} />
      <aside className="sidebar">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
          <div>
            {detail && <h2 style={{ color: "var(--text-primary)", fontSize: "1.2rem", margin: 0 }}>{detail.company.name}</h2>}
            {detail && (
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: "0.25rem 0 0" }}>
                {detail.jobPostings[0]?.title ?? "No roles on file"}
                {(detail.company.hqCity || detail.company.hqCountry) &&
                  ` · ${[detail.company.hqCity, detail.company.hqCountry].filter(Boolean).join(", ")}`}
              </p>
            )}
          </div>
          <button type="button" className="secondary icon-button" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        {!detail ? (
          <p>Loading...</p>
        ) : (
          <>
            <div className="sidebar-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="status-pill" style={{ background: colorForStatus(detail.lead.status) }}>
                  {detail.lead.status}
                </span>
                <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
                  {detail.lead.assignedTo ? `Assigned: ${detail.lead.assignedTo}` : "Unassigned"}
                </span>
              </div>
              {detail.company.phone && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.6rem" }}>
                  <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>{detail.company.phone}</span>
                  <CopyButton value={detail.company.phone} />
                </div>
              )}
              <Link
                href={`/leads/${leadId}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  fontSize: "0.85rem",
                  marginTop: "0.6rem",
                }}
              >
                View full company details <ChevronRight size={14} />
              </Link>
            </div>

            <p className="sidebar-section-label">Log a contact</p>
            <ContactLogger key={detail.lead.id} leadId={detail.lead.id} currentStatus={detail.lead.status} onLogged={handleLogged} />
          </>
        )}
      </aside>
    </>
  );
}
