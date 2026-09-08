// Palette derived from the brand pastel board, but re-stepped for actual data
// use: the source pastels (#99CDD8 blue / #F3C3B2 peach / #CFD6C4 sage /
// #657166 olive) are too light and too low-chroma to pass as a categorical
// data palette — validated (dataviz skill's validate_palette.js): ALL CHECKS
// PASS in this exact adjacent order (worst normal-vision ΔE 16.3, well clear
// of the 15 floor; CVD sits in the 6-8 warn band, which is legal here because
// every chart/badge that uses these also carries a direct text label).
export const CATEGORICAL_COLORS = [
  "#2ca2cf", // blue   (from brand blue #99CDD8)
  "#de7845", // orange (from brand peach #F3C3B2)
  "#a1bb3b", // yellow-green (from brand sage #CFD6C4)
  "#20b3aa", // teal
  "#c44154", // red
];

export const CHART_INK = { primary: "#1c1f1d", secondary: "#52584f", muted: "#8a9086", grid: "#e6e8e2" };

// Lead status pipeline order (fixed identity, not sorted by count).
export const STATUS_ORDER = ["new", "contacted", "warm", "cold", "won", "lost", "dnc"];

// `new` and `dnc` are neutral (no signal yet / closed) — deliberately gray
// rather than forced into the hue set, so they never compete visually with
// the 5 actionable statuses. The 5 hues map 1:1 onto CATEGORICAL_COLORS.
export const STATUS_COLORS: Record<string, string> = {
  new: "#8f9a95",
  contacted: CATEGORICAL_COLORS[0],
  warm: CATEGORICAL_COLORS[1],
  cold: CATEGORICAL_COLORS[2],
  won: CATEGORICAL_COLORS[3],
  lost: CATEGORICAL_COLORS[4],
  dnc: "#52584f",
};

export function colorForIndex(i: number): string {
  return CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length];
}

export function colorForStatus(status: string): string {
  return STATUS_COLORS[status] ?? "#8f9a95";
}

export function initialFor(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export function avatarColorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return colorForIndex(hash);
}
