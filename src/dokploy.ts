const DOKPLOY_URL = process.env.DOKPLOY_URL || "";
const DOKPLOY_TOKEN = process.env.DOKPLOY_TOKEN || "";

export async function dokploy(procedure: string, input: Record<string, any>): Promise<any> {
  if (!DOKPLOY_URL) throw new Error("DOKPLOY_URL not configured");
  if (!DOKPLOY_TOKEN) throw new Error("DOKPLOY_TOKEN not configured");

  // Dokploy uses tRPC - queries use GET with input as JSON in query param
  // tRPC v10 GET expects input as JSON string in query param
  const url = `${DOKPLOY_URL}/api/trpc/${procedure}?input=${encodeURIComponent(JSON.stringify(input))}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Cookie: "", // tRPC auth might use cookies
      Authorization: `Bearer ${DOKPLOY_TOKEN}`,
      "x-api-key": DOKPLOY_TOKEN,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dokploy API error ${res.status}: ${text}`);
  }

  const json = await res.json();
  // tRPC wraps results in { result: { data: { json: ... } } }
  const data = json?.result?.data;
  return data?.json ?? data ?? json;
}
