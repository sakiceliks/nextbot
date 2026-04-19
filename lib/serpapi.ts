const SERP_API_ENDPOINT = "https://serpapi.com/search";

export function normalizeImageUrl(imageUrl = "") {
  const raw = String(imageUrl || "").trim();
  if (!raw) {
    return "";
  }

  try {
    return new URL(raw).toString();
  } catch {
    return "";
  }
}

type FetchGoogleLensOptions = {
  country?: string;
  hl?: string;
  timeoutMs?: number;
};

export async function fetchGoogleLens(imageUrl: string, options: FetchGoogleLensOptions = {}) {
  const normalizedUrl = normalizeImageUrl(imageUrl);
  if (!normalizedUrl) {
    throw new Error("Gecerli bir gorsel URL zorunludur.");
  }

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    throw new Error("SERPAPI_KEY tanimli degil.");
  }

  const params = new URLSearchParams({
    engine: "google_lens",
    url: normalizedUrl,
    country: options.country || "tr",
    hl: options.hl || "tr",
    api_key: apiKey
  });

  const timeoutMs = Number(options.timeoutMs || 60_000);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error("SerpAPI request timeout")), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${SERP_API_ENDPOINT}?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }

  let payload: Record<string, unknown> | null = null;
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = String(payload?.error || `SerpAPI HTTP ${response.status}`);
    if (message.includes("Google Lens hasn't returned any results for this query")) {
      return { visual_matches: [] };
    }

    throw new Error(message);
  }

  if (payload?.error) {
    const message = String(payload.error);
    if (message.includes("Google Lens hasn't returned any results for this query")) {
      return { visual_matches: [] };
    }

    throw new Error(message);
  }

  return payload || {};
}
