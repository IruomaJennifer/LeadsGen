const BASE = "https://places.googleapis.com/v1";

// Step A: free IDs-only Text Search (Essentials SKU).
export async function findPlaceId(key: string, query: string): Promise<string | null> {
  const res = await fetch(`${BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.id", // IDs only -> free/unlimited
    },
    body: JSON.stringify({ textQuery: query }),
  });
  if (!res.ok) throw new Error(`searchText ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.places?.[0]?.id ?? null;
}

// Step B: Place Details for phone (Enterprise SKU).
// Field-mask hygiene is cost-critical: never add reviews/photos/ratings here —
// one such field re-prices the whole call at the Atmosphere tier (~$40/1k).
export async function getPhone(key: string, placeId: string): Promise<string | null> {
  const res = await fetch(`${BASE}/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "nationalPhoneNumber",
    },
  });
  if (!res.ok) throw new Error(`placeDetails ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.nationalPhoneNumber ?? null;
}
