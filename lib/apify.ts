import { ApifyClient } from "apify-client";
import type { AnalysisInput, ActorRunRef, SourceKey } from "./types";
import { pressMediaUrls } from "./press";
import { humanizeCaptureError } from "./errors";

export function hasApifyToken() {
  return Boolean(process.env.APIFY_TOKEN?.trim());
}

export function getApifyClient() {
  const token = process.env.APIFY_TOKEN?.trim();
  if (!token) {
    throw new Error("APIFY_TOKEN no configurado");
  }
  return new ApifyClient({ token });
}

/**
 * Defaults orientados a SMID:
 * - Meta / Google: Actors especializados de Ad Library / Transparency.
 * - Prensa vía Apify solo si PRESS_CAPTURE_MODE=apify (default es escaneo nativo en lib/press.ts).
 *   cheerio-scraper evita Playwright/OOM del website-content-crawler.
 */
const DEFAULT_ACTORS: Record<SourceKey, string> = {
  meta: process.env.APIFY_META_ACTOR_ID || "apify/facebook-ads-scraper",
  google:
    process.env.APIFY_GOOGLE_ACTOR_ID ||
    "curious_coder/google-ads-transparency-scraper",
  press: process.env.APIFY_PRESS_ACTOR_ID || "apify/cheerio-scraper",
};

function brandsForInput(input: AnalysisInput) {
  return [input.clientBrand, ...input.competitors].map((b) => b.trim()).filter(Boolean);
}

function buildPressPageFunction(brands: string[]) {
  const brandsJson = JSON.stringify(brands);
  return `async function pageFunction(context) {
  const { $, request, log } = context;
  const brands = ${brandsJson};
  const url = request.url;
  const title = $('title').first().text().trim();
  const bodyText = $('body').text().replace(/\\s+/g, ' ').trim();
  const html = $.html() || '';

  const brandHits = brands.map((brand) => {
    const re = new RegExp(brand.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&'), 'i');
    const inTitle = re.test(title);
    const inText = re.test(bodyText);
    const inHtml = re.test(html);
    const linkMatches = $('a[href], img[alt], img[src]')
      .toArray()
      .filter((el) => {
        const href = ($(el).attr('href') || '') + ' ' + ($(el).attr('src') || '') + ' ' + ($(el).attr('alt') || '') + ' ' + ($(el).text() || '');
        return re.test(href);
      }).length;

    return {
      brand,
      mentioned: inTitle || inText || inHtml || linkMatches > 0,
      inTitle,
      inText,
      inHtml,
      linkOrImageHits: linkMatches,
    };
  }).filter((h) => h.mentioned);

  const adSignals = {
    iframeCount: $('iframe').length,
    adsenseLike: html.toLowerCase().includes('googlesyndication') || html.toLowerCase().includes('doubleclick'),
    dataAdSlots: $('[data-ad], [id*="ad-"], [class*="ad-"], [class*="banner"]').length,
  };

  log.info('Press page scanned', { url, brandHits: brandHits.length, adSignals });

  return {
    platform: 'prensa',
    url,
    title,
    brandHits,
    adSignals,
    capturedAt: new Date().toISOString(),
  };
}`;
}

function buildActorInput(source: SourceKey, input: AnalysisInput) {
  const brands = brandsForInput(input);
  const country = input.country || "Bolivia";

  if (source === "meta") {
    return {
      country,
      countries: ["BO", country],
      searchTerms: brands,
      urls: brands.map(
        (brand) =>
          `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BO&q=${encodeURIComponent(brand)}&search_type=keyword_unordered`,
      ),
      startUrls: brands.map(
        (brand) =>
          `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BO&q=${encodeURIComponent(brand)}&search_type=keyword_unordered`,
      ),
      maxItems: 40,
      maxAds: 40,
      resultsLimit: 40,
      scrapeAdDetails: true,
    };
  }

  if (source === "google") {
    return {
      queries: brands,
      advertisers: brands,
      searchTerms: brands,
      region: "BO",
      country: "BO",
      countries: ["BO"],
      maxItems: 40,
      resultsLimit: 40,
      maxAds: 40,
    };
  }

  const media = pressMediaUrls(input);
  const pressActor = DEFAULT_ACTORS.press;

  // Compatibilidad si alguien fuerza website-content-crawler por env.
  if (pressActor.includes("website-content-crawler")) {
    return {
      startUrls: media.map((url) => ({ url })),
      maxCrawlPages: media.length,
      maxRequestsPerCrawl: media.length,
      maxCrawlDepth: 0,
      crawlerType: "cheerio",
      initialConcurrency: 1,
      maxConcurrency: 1,
      maxScrollHeightPixels: 0,
      saveFiles: false,
      saveScreenshots: false,
    };
  }

  // cheerio-scraper — liviano, sin browser.
  return {
    startUrls: media.map((url) => ({ url })),
    keepUrlFragments: false,
    linkSelector: "",
    globs: [],
    pseudoUrls: [],
    pageFunction: buildPressPageFunction(brands),
    proxyConfiguration: { useApifyProxy: true },
    initialConcurrency: 1,
    maxConcurrency: 2,
    maxRequestRetries: 2,
    maxPagesPerCrawl: media.length,
    maxRequestsPerCrawl: media.length,
    pageFunctionTimeoutSecs: 60,
  };
}

function memoryForSource(source: SourceKey) {
  if (source === "press") {
    const pressActor = DEFAULT_ACTORS.press;
    const defaultMb = pressActor.includes("website-content-crawler") ? 4096 : 1024;
    return Number(process.env.APIFY_PRESS_MEMORY_MB || defaultMb);
  }
  if (source === "meta") {
    return Number(process.env.APIFY_META_MEMORY_MB || 2048);
  }
  return Number(process.env.APIFY_GOOGLE_MEMORY_MB || 2048);
}

const TERMINAL = new Set(["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"]);

export function isTerminalRunStatus(status: string) {
  return TERMINAL.has(status);
}

export async function startSourceRuns(
  input: AnalysisInput,
  sources: SourceKey[],
): Promise<ActorRunRef[]> {
  const client = getApifyClient();

  const started = await Promise.all(
    sources.map(async (source): Promise<ActorRunRef> => {
      const actorId = DEFAULT_ACTORS[source];
      try {
        const run = await client.actor(actorId).start(buildActorInput(source, input), {
          memory: memoryForSource(source),
          timeout: 600,
        });
        return {
          source,
          actorId,
          runId: run.id,
          status: run.status || "READY",
          datasetId: run.defaultDatasetId,
        };
      } catch (error) {
        const raw =
          error instanceof Error ? error.message : "No se pudo iniciar la fuente";
        return {
          source,
          actorId,
          runId: "",
          status: "FAILED",
          error: humanizeCaptureError(source, raw),
        };
      }
    }),
  );

  return started;
}

export async function refreshRuns(runs: ActorRunRef[]): Promise<ActorRunRef[]> {
  if (!hasApifyToken()) return runs;
  const client = getApifyClient();

  return Promise.all(
    runs.map(async (run) => {
      // Runs nativos o ya fallidos al iniciar no se consultan en Apify.
      if (!run.runId || run.runId === "native" || run.status === "FAILED") return run;
      try {
        const fresh = await client.run(run.runId).get();
        if (!fresh) return run;

        let itemCount = run.itemCount;
        if (fresh.defaultDatasetId && fresh.status === "SUCCEEDED") {
          try {
            const dataset = await client.dataset(fresh.defaultDatasetId).get();
            if (dataset && typeof dataset.itemCount === "number") {
              itemCount = dataset.itemCount;
            }
          } catch {
            // Conteo opcional: no tumbar el refresh.
          }
        }

        return {
          ...run,
          status: fresh.status || run.status,
          datasetId: fresh.defaultDatasetId || run.datasetId,
          itemCount,
          error:
            fresh.status === "FAILED" ||
            fresh.status === "ABORTED" ||
            fresh.status === "TIMED-OUT"
              ? humanizeCaptureError(
                  run.source,
                  (fresh as { statusMessage?: string }).statusMessage || run.error,
                )
              : run.error,
        };
      } catch (error) {
        return {
          ...run,
          error: error instanceof Error ? error.message : "Error al consultar run",
        };
      }
    }),
  );
}

export async function fetchDatasetItems(datasetId: string, limit = 100) {
  const client = getApifyClient();
  const { items } = await client.dataset(datasetId).listItems({ limit });
  return items as Record<string, unknown>[];
}

/** Descarga por fuente; fallo de una no afecta a las demás. */
export async function fetchRunDatasets(
  runs: ActorRunRef[],
): Promise<Record<string, Record<string, unknown>[]>> {
  const datasets: Record<string, Record<string, unknown>[]> = {};

  await Promise.all(
    runs.map(async (run) => {
      if (run.status !== "SUCCEEDED" || !run.datasetId || run.runId === "native") {
        if (!(run.source in datasets)) datasets[run.source] = [];
        return;
      }
      try {
        datasets[run.source] = await fetchDatasetItems(run.datasetId, 100);
      } catch {
        datasets[run.source] = [];
      }
    }),
  );

  return datasets;
}
