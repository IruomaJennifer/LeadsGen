"use client";

import { avatarColorFor, colorForStatus, initialFor } from "@/lib/chartColors";
import { CopyButton } from "./CopyButton";
import { ensureProtocol } from "@/lib/url";

export interface Lead {
  id: string;
  status: string;
  assignedTo: string | null;
  notes: string | null;
  lastContactedAt: string | null;
  createdAt: string;
  company: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    hqCity: string | null;
    hqCountry: string | null;
  };
  latestRole: string | null;
  latestRoleUrl: string | null;
}

export function LeadRow({
  lead,
  serialNumber,
  onSelect,
}: {
  lead: Lead;
  serialNumber: number;
  onSelect: (id: string) => void;
}) {
  const location = [lead.company.hqCity, lead.company.hqCountry].filter(Boolean).join(", ");

  return (
    <tr className="clickable-row" onClick={() => onSelect(lead.id)}>
      <td style={{ color: "var(--text-muted)" }}>{serialNumber}</td>
      <td className="col-wrap">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span className="avatar" style={{ background: avatarColorFor(lead.company.name) }}>
            {initialFor(lead.company.name)}
          </span>
          <span style={{ fontWeight: 500 }}>{lead.company.name}</span>
        </div>
      </td>
      <td style={{ color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
        {lead.company.phone && (
          <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            {lead.company.phone}
            <CopyButton value={lead.company.phone} />
          </span>
        )}
      </td>
      <td style={{ color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{lead.company.email}</td>
      <td className="col-wrap" style={{ color: "var(--text-secondary)" }}>
        {lead.latestRoleUrl ? (
          <a
            href={ensureProtocol(lead.latestRoleUrl)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            {lead.latestRole}
          </a>
        ) : (
          lead.latestRole
        )}
      </td>
      <td style={{ color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{location}</td>
      <td>
        <span className="status-pill" style={{ background: colorForStatus(lead.status) }}>
          {lead.status}
        </span>
      </td>
      <td style={{ color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{lead.assignedTo}</td>
      <td style={{ color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
        {new Date(lead.createdAt).toLocaleDateString()}
      </td>
      <td style={{ color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
        {lead.lastContactedAt ? new Date(lead.lastContactedAt).toLocaleDateString() : "Never"}
      </td>
    </tr>
  );
}
