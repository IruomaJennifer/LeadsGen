"use client";

import { useState } from "react";

const CHANNELS = ["phone", "email", "phone_and_email", "other"];
const STATUSES = ["new", "contacted", "warm", "cold", "won", "lost", "dnc"];

export interface ContactLoggerProps {
  leadId: string;
  currentStatus: string;
  onLogged: () => void;
}

// The one primary action on a lead: log what happened (channel + a note
// about the experience) and optionally the outcome (status), all as a
// single atomic event — a note is never a separate thing from the contact
// it describes.
export function ContactLogger({ leadId, currentStatus, onLogged }: ContactLoggerProps) {
  const [channel, setChannel] = useState("phone");
  const [channelDetail, setChannelDetail] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState(currentStatus);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function handleSubmit() {
    setError(null);
    if (channel === "other" && !channelDetail.trim()) {
      setError("Detail required when channel is 'other'");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          channelDetail: channel === "other" ? channelDetail : undefined,
          notes: note.trim() || undefined,
          status: status !== currentStatus ? status : undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed to log contact");

      setChannelDetail("");
      setNote("");
      setSavedAt(Date.now());
      onLogged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log contact");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div>
        <label htmlFor="log-channel">Channel</label>
        <select id="log-channel" value={channel} onChange={(e) => setChannel(e.target.value)} style={{ width: "100%" }}>
          {CHANNELS.map((c) => (
            <option key={c} value={c}>
              {c.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      {channel === "other" && (
        <div>
          <label htmlFor="log-detail">Detail</label>
          <input
            id="log-detail"
            type="text"
            placeholder="e.g. LinkedIn DM"
            value={channelDetail}
            onChange={(e) => setChannelDetail(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>
      )}

      <div>
        <label htmlFor="log-note">Note</label>
        <textarea
          id="log-note"
          placeholder="What happened?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          style={{ width: "100%" }}
        />
      </div>

      <div>
        <label htmlFor="log-status">Outcome / status</label>
        <select id="log-status" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: "100%" }}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="error-text">{error}</p>}
      {savedAt && !error && <p className="success-text">Logged.</p>}

      <button type="button" onClick={handleSubmit} disabled={saving}>
        {saving ? "Logging..." : "Log contact"}
      </button>
    </div>
  );
}
