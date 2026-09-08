"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CATEGORICAL_COLORS, CHART_INK, STATUS_ORDER, colorForIndex, colorForStatus } from "@/lib/chartColors";
import { ChevronLeft } from "../icons";
import { LogoutButton } from "../LogoutButton";

interface Summary {
  total: number;
  byStatus: Record<string, number>;
  uncalledQueueSize: number;
  warmRate: number | null;
  bySource: Record<string, number>;
}

interface DailySeries {
  data: { date: string; count: number }[];
}

interface WeeklyWarmCold {
  data: { date: string; warm: number; cold: number }[];
}

interface WeekdaySeries {
  data: { label: string; count: number }[];
}

function CategoryBarChart({ data }: { data: { label: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid vertical={false} stroke={CHART_INK.grid} />
        <XAxis dataKey="label" tick={{ fill: CHART_INK.muted, fontSize: 12 }} axisLine={{ stroke: CHART_INK.grid }} tickLine={false} />
        <YAxis tick={{ fill: CHART_INK.muted, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid var(--border)" }} />
        <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={40}>
          {data.map((entry, i) => (
            <Cell key={entry.label} fill={colorForIndex(i)} />
          ))}
          <LabelList dataKey="count" position="top" fill={CHART_INK.secondary} fontSize={12} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function DailyLineChart({ data, color }: { data: { date: string; count: number }[]; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid vertical={false} stroke={CHART_INK.grid} />
        <XAxis
          dataKey="date"
          tickFormatter={(d) => new Date(String(d)).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          tick={{ fill: CHART_INK.muted, fontSize: 12 }}
          axisLine={{ stroke: CHART_INK.grid }}
          tickLine={false}
        />
        <YAxis tick={{ fill: CHART_INK.muted, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
        <Tooltip
          labelFormatter={(d) => new Date(String(d)).toLocaleDateString()}
          contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid var(--border)" }}
        />
        <Line type="monotone" dataKey="count" stroke={color} strokeWidth={2.5} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Sequential single-hue heatmap: intensity (not hue) carries magnitude.
function WeekdayHeatmap({ data, color }: { data: { label: string; count: number }[]; color: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div style={{ display: "flex", gap: "0.5rem" }}>
      {data.map((d) => {
        const intensity = 0.15 + 0.85 * (d.count / max);
        return (
          <div key={d.label} style={{ flex: 1, textAlign: "center" }}>
            <div
              style={{
                background: hexToRgba(color, intensity),
                borderRadius: 10,
                padding: "1rem 0",
                fontWeight: 700,
                fontSize: "1.1rem",
                color: intensity > 0.55 ? "#ffffff" : "var(--text-primary)",
              }}
            >
              {d.count}
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: "0.78rem", margin: "0.4rem 0 0" }}>{d.label}</p>
          </div>
        );
      })}
    </div>
  );
}

function toEntries(record: Record<string, number>, order?: string[]): { label: string; count: number }[] {
  const keys = order ?? Object.keys(record).sort((a, b) => record[b] - record[a]);
  return keys.filter((k) => record[k] !== undefined).map((k) => ({ label: k, count: record[k] }));
}

function Ring({ percent, color }: { percent: number; color: string }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(Math.max(percent, 0), 1));
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" style={{ flexShrink: 0 }}>
      <circle cx="22" cy="22" r={radius} fill="none" stroke="var(--border)" strokeWidth="4" />
      <circle
        cx="22"
        cy="22"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 22 22)"
      />
    </svg>
  );
}

function StatTile({
  icon,
  tint,
  label,
  value,
  ring,
}: {
  icon: string;
  tint: string;
  label: string;
  value: string;
  ring?: { percent: number; color: string };
}) {
  return (
    <div className="stat-tile">
      <div>
        <p className="stat-tile-label">{label}</p>
        <p className="stat-tile-value">{value}</p>
      </div>
      {ring && ring.percent > 0 ? (
        <Ring percent={ring.percent} color={ring.color} />
      ) : (
        <div className="stat-tile-icon" style={{ background: tint }}>
          {icon}
        </div>
      )}
    </div>
  );
}

export default function MetricsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [leadsPerDay, setLeadsPerDay] = useState<DailySeries | null>(null);
  const [contactsPerDay, setContactsPerDay] = useState<DailySeries | null>(null);
  const [warmColdPerWeek, setWarmColdPerWeek] = useState<WeeklyWarmCold | null>(null);
  const [postingsByWeekday, setPostingsByWeekday] = useState<WeekdaySeries | null>(null);

  useEffect(() => {
    fetch("/api/metrics/summary").then((r) => r.json()).then(setSummary);
    fetch("/api/metrics/timeseries?metric=leads_created&range=30d").then((r) => r.json()).then(setLeadsPerDay);
    fetch("/api/metrics/timeseries?metric=contacts_logged&range=30d").then((r) => r.json()).then(setContactsPerDay);
    fetch("/api/metrics/timeseries?metric=warm_cold_per_week&range=84d").then((r) => r.json()).then(setWarmColdPerWeek);
    fetch("/api/metrics/timeseries?metric=postings_by_weekday").then((r) => r.json()).then(setPostingsByWeekday);
  }, []);

  if (!summary || !leadsPerDay || !contactsPerDay || !warmColdPerWeek || !postingsByWeekday) {
    return <main style={{ padding: "2rem" }}>Loading...</main>;
  }

  const statusData = toEntries(summary.byStatus, STATUS_ORDER);
  const warmColor = colorForStatus("warm");
  const coldColor = colorForStatus("cold");
  const sourceData = toEntries(summary.bySource);
  // The series only contains days that actually have data, so the *last*
  // entry is the most recent day with a contact logged — not necessarily
  // today. Match on today's actual calendar date, defaulting to 0.
  const todayLabel = new Date().toDateString();
  const contactsToday = contactsPerDay.data.find((d) => new Date(d.date).toDateString() === todayLabel)?.count ?? 0;

  return (
    <main style={{ padding: "2rem", maxWidth: 1320, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
            <ChevronLeft size={14} /> Back to worklist
          </Link>
          <h1 style={{ margin: "0.5rem 0 0" }}>Metrics</h1>
        </div>
        <LogoutButton />
      </div>

      <div className="stat-row">
        <StatTile icon="👥" tint="var(--brand-mint)" label="Total leads" value={String(summary.total)} />
        <StatTile icon="📞" tint="var(--brand-peach)" label="Uncalled queue" value={String(summary.uncalledQueueSize)} />
        <StatTile
          icon="🔥"
          tint="var(--brand-cream)"
          label="Warm rate"
          value={summary.warmRate !== null ? `${(summary.warmRate * 100).toFixed(0)}%` : "n/a"}
          ring={summary.warmRate !== null ? { percent: summary.warmRate, color: colorForStatus("warm") } : undefined}
        />
        <StatTile icon="✅" tint="var(--brand-sage)" label="Contacted today" value={String(contactsToday)} />
      </div>

      <div className="dashboard-grid">
        <section>
          <h2>Leads / day (last 30 days)</h2>
          <DailyLineChart data={leadsPerDay.data} color={CATEGORICAL_COLORS[0]} />
        </section>

        <section>
          <h2>Contacts logged / day (last 30 days)</h2>
          <DailyLineChart data={contactsPerDay.data} color={CATEGORICAL_COLORS[3]} />
        </section>

        <section>
          <h2>Status breakdown</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={statusData} dataKey="count" nameKey="label" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {statusData.map((entry) => (
                  <Cell key={entry.label} fill={colorForStatus(entry.label)} />
                ))}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 12, color: CHART_INK.secondary }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid var(--border)" }} />
            </PieChart>
          </ResponsiveContainer>
        </section>

        <section>
          <h2>Warm vs cold leads / week (last 12 weeks)</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={warmColdPerWeek.data} margin={{ top: 16, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid vertical={false} stroke={CHART_INK.grid} />
              <XAxis
                dataKey="date"
                tickFormatter={(d) => new Date(String(d)).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                tick={{ fill: CHART_INK.muted, fontSize: 12 }}
                axisLine={{ stroke: CHART_INK.grid }}
                tickLine={false}
              />
              <YAxis tick={{ fill: CHART_INK.muted, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
              <Tooltip
                labelFormatter={(d) => new Date(String(d)).toLocaleDateString()}
                contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid var(--border)" }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: CHART_INK.secondary }} />
              <Bar dataKey="warm" name="Warm" fill={warmColor} radius={[6, 6, 0, 0]} maxBarSize={28} />
              <Bar dataKey="cold" name="Cold" fill={coldColor} radius={[6, 6, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section>
          <h2>By job source</h2>
          <CategoryBarChart data={sourceData} />
        </section>

        <section>
          <h2>Companies by posting day of week</h2>
          <WeekdayHeatmap data={postingsByWeekday.data} color={CATEGORICAL_COLORS[0]} />
        </section>
      </div>
    </main>
  );
}
