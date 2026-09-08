const ACCOUNT = "https://account.datablist.com";
const API = "https://data.datablist.com";
const PAGE_SIZE = 200;

export interface DatablistItem {
  "@id": string;
  "@type"?: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export async function getDatablistToken(apiKey: string): Promise<string> {
  const res = await fetch(`${ACCOUNT}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ apiKey }),
  });
  if (!res.ok) throw new Error(`Datablist token failed: ${res.status}`);
  const data = await res.json();
  return data.access_token as string; // JWT, ~24h
}

// Every /collections/... endpoint is scoped under a workspace_id, which we don't
// have as a config value (only DATABLIST_COLLECTION_ID). Resolve it by listing
// workspaces and probing each one for the collection. Cheap: one call per
// workspace, and personal/Growth accounts typically have exactly one.
async function findWorkspaceIdForCollection(token: string, collectionId: string): Promise<string> {
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  const res = await fetch(API, { headers });
  if (!res.ok) throw new Error(`Datablist workspaces failed: ${res.status}`);
  const { data: workspaces } = await res.json();
  for (const workspace of workspaces as { "@id": string }[]) {
    const workspaceId = workspace["@id"];
    const check = await fetch(`${API}/${workspaceId}/collections/${collectionId}`, { headers });
    if (check.ok) return workspaceId;
  }
  throw new Error(`Datablist collection ${collectionId} not found in any workspace`);
}

// Pull all items created since `sinceIso`, oldest first. Pagination is cursor-based:
// `count` sets the page size and `start_after_document_id` (the previous page's last
// item @id) advances the cursor — there's no "next" URL in the response.
export async function fetchNewItems(
  token: string,
  collectionId: string,
  sinceIso: string
): Promise<DatablistItem[]> {
  const workspaceId = await findWorkspaceIdForCollection(token, collectionId);
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  const filter = encodeURIComponent(JSON.stringify([{ name: "createdAt", op: "ge", val: sinceIso }]));
  const base = `${API}/${workspaceId}/collections/${collectionId}/items?filter=${filter}&order_by=createdAt&count=${PAGE_SIZE}`;

  const items: DatablistItem[] = [];
  let cursor: string | null = null;
  while (true) {
    const url = cursor ? `${base}&start_after_document_id=${encodeURIComponent(cursor)}` : base;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Datablist items failed: ${res.status}`);
    const page = await res.json();
    const pageItems: DatablistItem[] = page.data ?? [];
    items.push(...pageItems);
    if (pageItems.length < PAGE_SIZE) break;
    cursor = pageItems[pageItems.length - 1]["@id"];
  }
  return items;
}
