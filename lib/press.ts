import type { AnalysisInput } from "./types";

export type PressScanItem = {
  platform: "prensa";
  url: string;
  title: string;
  brandHits: Array<{
    brand: string;
    mentioned: boolean;
    inTitle: boolean;
    inText: boolean;
    inHtml: boolean;
    linkOrImageHits: number;
  }>;
  adSignals: {
    iframeCount: number;
    adsenseLike: boolean;
    dataAdSlots: number;
  };
  capturedAt: string;
  error?: string;
};

const DEFAULT_MEDIA = [
  "https://eldeber.com.bo/",
  "https://eldeber.com.bo/automotores",
  "https://www.lostiempos.com/",
  "https://www.la-razon.com/",
  "https://www.opinion.com.bo/",
  "https://www.unitel.bo/",
  "https://correodelsur.com/",
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripTags(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.replace(/\s+/g, " ").trim() || "";
}

function countAttrHits(html: string, re: RegExp) {
  let hits = 0;
  const attrRe =
    /(?:href|src|alt)\s*=\s*["']([^"']*)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(html)) !== null) {
    if (re.test(m[1])) hits += 1;
  }
  return hits;
}

function analyzeHtml(url: string, html: string, brands: string[]): PressScanItem {
  const clipped = html.slice(0, 500_000);
  const title = extractTitle(clipped);
  const bodyText = stripTags(clipped).slice(0, 200_000);
  const lowerHtml = clipped.toLowerCase();

  const brandHits = brands
    .map((brand) => {
      const re = new RegExp(escapeRegExp(brand), "i");
      const inTitle = re.test(title);
      const inText = re.test(bodyText);
      const inHtml = re.test(clipped);
      const linkOrImageHits = countAttrHits(clipped, re);
      return {
        brand,
        mentioned: inTitle || inText || inHtml || linkOrImageHits > 0,
        inTitle,
        inText,
        inHtml,
        linkOrImageHits,
      };
    })
    .filter((h) => h.mentioned);

  const iframeCount = (clipped.match(/<iframe\b/gi) || []).length;
  const dataAdSlots = (
    clipped.match(/\bdata-ad\b|id=["'][^"']*ad-|class=["'][^"']*\b(ad-|banner)/gi) || []
  ).length;

  return {
    platform: "prensa",
    url,
    title,
    brandHits,
    adSignals: {
      iframeCount,
      adsenseLike:
        lowerHtml.includes("googlesyndication") || lowerHtml.includes("doubleclick"),
      dataAdSlots,
    },
    capturedAt: new Date().toISOString(),
  };
}

export function pressMediaUrls(input: AnalysisInput) {
  const media =
    input.pressMedia.length > 0 ? input.pressMedia : DEFAULT_MEDIA;
  return media
    .map((u) => u.trim())
    .filter(Boolean)
    .slice(0, 8);
}

/**
 * Escaneo liviano de portales (HTTP + parseo local).
 * Evita Actors de browser/OOM: solo homepage, timeout corto, HTML truncado.
 * Un medio fallido no tumba el resto.
 */
export async function scanPressMedia(
  input: AnalysisInput,
): Promise<PressScanItem[]> {
  const brands = [input.clientBrand, ...input.competitors]
    .map((b) => b.trim())
    .filter(Boolean);
  const urls = pressMediaUrls(input);

  const settled = await Promise.all(
    urls.map(async (url): Promise<PressScanItem> => {
      try {
        const res = await fetch(url, {
          redirect: "follow",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "es-BO,es;q=0.9,en;q=0.8",
          },
          signal: AbortSignal.timeout(20_000),
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const html = await res.text();
        return analyzeHtml(url, html, brands);
      } catch (error) {
        return {
          platform: "prensa",
          url,
          title: "",
          brandHits: [],
          adSignals: { iframeCount: 0, adsenseLike: false, dataAdSlots: 0 },
          capturedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : "No se pudo leer el medio",
        };
      }
    }),
  );

  return settled;
}

/** En producción las 3 fuentes van a captura remota. Solo `native` fuerza HTTP desde Vercel. */
export function useNativePressCapture() {
  const mode = (process.env.PRESS_CAPTURE_MODE || "apify").trim().toLowerCase();
  return mode === "native";
}
