import type { AdSignal, AnalysisInput } from "./types";

function looksLikeCodeOrJunk(text: string) {
  return /gbar_|\{CONFIG:|function\s*\(|window\.|document\.|googletag|;this\.|<\/?[a-z]|var\s+\w+\s*=/i.test(
    text,
  );
}

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function dig(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function pick(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    if (key.includes(".")) {
      const value = asString(dig(obj, key.split(".")));
      if (value && !looksLikeCodeOrJunk(value)) return value;
      continue;
    }
    const value = asString(obj[key]);
    if (value && !looksLikeCodeOrJunk(value)) return value;
  }
  return "";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function brandUniverse(input: AnalysisInput): string[] {
  return [input.clientBrand, ...input.competitors]
    .map((b) => b.trim())
    .filter(Boolean);
}

/** Asigna marca por pageName / URL / texto; sin split 50/50 artificial. */
export function matchBrand(
  blob: string,
  brands: string[],
  fallback = "",
): string {
  const scored = brands
    .map((brand) => {
      const re = new RegExp(`\\b${escapeRegExp(brand)}\\b`, "i");
      const hits = (blob.match(re) || []).length;
      return { brand, hits, len: brand.length };
    })
    .filter((s) => s.hits > 0)
    .sort((a, b) => b.hits - a.hits || b.len - a.len);
  return scored[0]?.brand || fallback;
}

function snapshotBody(item: Record<string, unknown>): string {
  const snapshot =
    item.snapshot && typeof item.snapshot === "object"
      ? (item.snapshot as Record<string, unknown>)
      : null;

  const parts: string[] = [];
  if (snapshot) {
    parts.push(
      pick(snapshot, ["body", "title", "caption", "link_description", "cta_text"]),
    );
    const cards = snapshot.cards;
    if (Array.isArray(cards)) {
      for (const card of cards.slice(0, 4)) {
        if (card && typeof card === "object") {
          parts.push(
            pick(card as Record<string, unknown>, [
              "body",
              "title",
              "link_description",
              "caption",
            ]),
          );
        }
      }
    }
  }

  parts.push(
    pick(item, [
      "ad_text",
      "adCreativeBody",
      "body",
      "text",
      "title",
      "headline",
      "snapshot.body",
      "snapshot.title",
    ]),
  );

  return parts.filter(Boolean).join(" · ").replace(/\s+/g, " ").trim();
}

function metaUseful(item: Record<string, unknown>, body: string): boolean {
  if (asString(item.error)) return false;
  if (body.length >= 12 && !looksLikeCodeOrJunk(body)) return true;
  return Boolean(
    item.adArchiveID ||
      item.ad_archive_id ||
      item.adid ||
      item.adId ||
      item.snapshot ||
      item.card ||
      item.cards,
  );
}

function normalizeMetaItem(
  item: Record<string, unknown>,
  brands: string[],
  index: number,
): AdSignal | null {
  const body = snapshotBody(item);
  const headline = pick(item, [
    "snapshot.title",
    "title",
    "headline",
    "pageName",
  ]);
  const pageName = pick(item, [
    "pageName",
    "page_name",
    "advertiserName",
    "advertiser",
    "name",
  ]);
  const brand = matchBrand(
    `${pageName} ${body} ${headline} ${asString(item.url)}`,
    brands,
    pageName || "",
  );
  if (!brand && !body) return null;
  if (!metaUseful(item, body)) return null;

  const id =
    asString(item.adArchiveID) ||
    asString(item.ad_archive_id) ||
    asString(item.adid) ||
    `meta-${index}`;

  const cta = pick(item, ["snapshot.cta_text", "cta", "cta_type", "callToAction"]);
  const landing = pick(item, [
    "snapshot.link_url",
    "link_url",
    "linkUrl",
    "url",
  ]);

  return {
    id,
    brand: brand || brands[0] || "Desconocida",
    platform: "Meta",
    body: body.slice(0, 600),
    headline: headline.slice(0, 160),
    cta,
    landingUrl: landing,
    format: pick(item, ["display_format", "format", "media_type"]) || "Meta Ad",
    startDate: pick(item, ["startDate", "ad_delivery_start_time", "start_date"]),
    endDate: pick(item, ["endDate", "ad_delivery_stop_time", "end_date"]),
    evidence: id,
    rawUseful: true,
  };
}

function normalizeGoogleItem(
  item: Record<string, unknown>,
  brands: string[],
  index: number,
): AdSignal | null {
  if (item.useful === false) return null;
  if (asString(item.error)) return null;

  const body = pick(item, ["body", "text", "ad_text", "creative", "description"]);
  const headline = pick(item, ["headline", "title", "advertiserName", "pageName"]);
  if ((!body || looksLikeCodeOrJunk(body)) && (!headline || looksLikeCodeOrJunk(headline))) {
    // Página Transparency sin creatividades parseables → no inventar anuncio.
    return null;
  }

  const brand = matchBrand(
    `${asString(item.advertiserName)} ${asString(item.pageName)} ${asString(item.url)} ${body} ${headline}`,
    brands,
    pick(item, ["advertiserName", "pageName", "advertiser"]) || "",
  );
  if (!brand) return null;

  return {
    id: asString(item.id) || `google-${index}`,
    brand,
    platform: "Google",
    body: body.slice(0, 600),
    headline: headline.slice(0, 160),
    cta: pick(item, ["cta", "callToAction"]),
    landingUrl: pick(item, ["url", "landingUrl", "destination"]),
    format: pick(item, ["format", "adFormat"]) || "Google Ads",
    evidence: asString(item.url) || `google-${index}`,
    rawUseful: true,
  };
}

function expandGoogleDataset(
  items: Record<string, unknown>[],
): Record<string, unknown>[] {
  const expanded: Record<string, unknown>[] = [];
  for (const item of items) {
    const creatives = item.creatives;
    if (Array.isArray(creatives) && creatives.length > 0) {
      creatives.forEach((text, idx) => {
        if (typeof text !== "string" || !text.trim()) return;
        expanded.push({
          ...item,
          body: text.trim(),
          text: text.trim(),
          headline: `${asString(item.advertiserName) || asString(item.pageName) || "Google"} · creatividad ${idx + 1}`,
          id: `${asString(item.advertiserName) || "g"}-${idx}`,
          useful: true,
          creatives: undefined,
        });
      });
      continue;
    }
    expanded.push(item);
  }
  return expanded;
}

export function normalizeAdDatasets(
  input: AnalysisInput,
  datasets: Record<string, Record<string, unknown>[]>,
): { meta: AdSignal[]; google: AdSignal[]; all: AdSignal[] } {
  const brands = brandUniverse(input);
  const meta = (datasets.meta || [])
    .map((item, i) => normalizeMetaItem(item, brands, i))
    .filter((x): x is AdSignal => Boolean(x));
  const google = expandGoogleDataset(datasets.google || [])
    .map((item, i) => normalizeGoogleItem(item, brands, i))
    .filter((x): x is AdSignal => Boolean(x));

  return { meta, google, all: [...meta, ...google] };
}
