"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LeadRow, type Lead } from "./LeadRow";
import { LeadSidebar } from "./LeadSidebar";
import { LogoutButton } from "./LogoutButton";
import { ChevronLeft, ChevronRight } from "./icons";

const STATUSES = ["new", "contacted", "warm", "cold", "won", "lost", "dnc"];
const TRI_STATE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Any" },
  { value: "yes", label: "Has it" },
  { value: "no", label: "Missing" },
];

interface LeadsResponse {
  data: Lead[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function WorklistPage() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [hasPhone, setHasPhone] = useState("");
  const [hasEmail, setHasEmail] = useState("");
  const [contactedFrom, setContactedFrom] = useState("");
  const [contactedTo, setContactedTo] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [assignees, setAssignees] = useState<{ id: string; label: string }[]>([]);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<LeadsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((body) => setAssignees(body.data));
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((body) => setIsAdmin(body.user?.role === "admin"));
  }, []);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    if (hasPhone) params.set("hasPhone", hasPhone);
    if (hasEmail) params.set("hasEmail", hasEmail);
    if (contactedFrom) params.set("contactedFrom", contactedFrom);
    if (contactedTo) params.set("contactedTo", contactedTo);
    if (createdFrom) params.set("createdFrom", createdFrom);
    if (createdTo) params.set("createdTo", createdTo);
    if (assignedTo) params.set("assignedTo", assignedTo);
    params.set("page", String(page));

    fetch(`/api/leads?${params.toString()}`).then(async (res) => {
      if (!active) return;
      if (res.ok) setResult(await res.json());
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [status, search, hasPhone, hasEmail, contactedFrom, contactedTo, createdFrom, createdTo, assignedTo, page, reloadKey]);

  function resetPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setPage(1);
      setter(v);
    };
  }

  const pager = result && (
    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
      <button className="icon-button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
        <ChevronLeft />
      </button>
      <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
        {result.page} / {result.totalPages}
      </span>
      <button
        className="icon-button"
        disabled={page >= result.totalPages}
        onClick={() => setPage((p) => p + 1)}
        aria-label="Next page"
      >
        <ChevronRight />
      </button>
    </div>
  );

  return (
    <main style={{ padding: "2rem", maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1>LeadsGen</h1>
        <div style={{ display: "flex", gap: "1.25rem" }}>
          {isAdmin && (
            <Link href="/admin/users" style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
              Team <ChevronRight size={14} />
            </Link>
          )}
          <Link href="/metrics" style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
            Metrics <ChevronRight size={14} />
          </Link>
          <LogoutButton />
        </div>
      </div>

      <section>
        <div className="filter-bar">
          <div>
            <label htmlFor="filter-status">Status</label>
            <select id="filter-status" value={status} onChange={(e) => resetPage(setStatus)(e.target.value)}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filter-phone">Phone</label>
            <select id="filter-phone" value={hasPhone} onChange={(e) => resetPage(setHasPhone)(e.target.value)}>
              {TRI_STATE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filter-email">Email</label>
            <select id="filter-email" value={hasEmail} onChange={(e) => resetPage(setHasEmail)(e.target.value)}>
              {TRI_STATE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filter-from">Last contacted from</label>
            <input
              id="filter-from"
              type="date"
              value={contactedFrom}
              onChange={(e) => resetPage(setContactedFrom)(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="filter-to">to</label>
            <input id="filter-to" type="date" value={contactedTo} onChange={(e) => resetPage(setContactedTo)(e.target.value)} />
          </div>
          <div>
            <label htmlFor="filter-created-from">Added from</label>
            <input
              id="filter-created-from"
              type="date"
              value={createdFrom}
              onChange={(e) => resetPage(setCreatedFrom)(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="filter-created-to">to</label>
            <input
              id="filter-created-to"
              type="date"
              value={createdTo}
              onChange={(e) => resetPage(setCreatedTo)(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="filter-assigned">Assigned to</label>
            <select id="filter-assigned" value={assignedTo} onChange={(e) => resetPage(setAssignedTo)(e.target.value)}>
              <option value="">Anyone</option>
              <option value="__unassigned__">Unassigned</option>
              {assignees.map((a) => (
                <option key={a.id} value={a.label}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: "12rem" }}>
            <label htmlFor="filter-search">Search company</label>
            <input
              id="filter-search"
              type="text"
              placeholder="Search company..."
              value={search}
              onChange={(e) => resetPage(setSearch)(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>
          {result && <div>{pager}</div>}
        </div>
      </section>

      {loading && !result ? (
        <p>Loading...</p>
      ) : !result || result.data.length === 0 ? (
        <p>No leads found.</p>
      ) : (
        <section style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="worklist-table">
              <thead>
                <tr>
                  <th>S/N</th>
                  <th>Company</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Top role</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Assigned</th>
                  <th>Date added</th>
                  <th>Last contact</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((lead, i) => (
                  <LeadRow
                    key={lead.id}
                    lead={lead}
                    serialNumber={(result.page - 1) * result.pageSize + i + 1}
                    onSelect={setSelectedLeadId}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              padding: "0.75rem 1rem",
              borderTop: "1px solid var(--border)",
            }}
          >
            {pager}
          </div>
        </section>
      )}

      <LeadSidebar
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        onSaved={() => {
          reload();
        }}
      />
    </main>
  );
}
