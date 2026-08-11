import { ApifyClient } from "apify-client";
import type { AnalysisInput, ActorRunRef, SourceKey } from "./types";

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
 * website-content-crawler NO es ideal para SMID prensa:
 * - Está pensado para extraer texto a LLMs/RAG, no para detectar banners.
 * - Por defecto usa Playwright y pide ~8 GB; con poca RAM muere ("Killed").
 *
 * Para el piloto de medios externos usamos cheerio-scraper (HTTP liviano)
 * y buscamos menciones de marca / señales publicitarias en el HTML.
 */
const DEFAULT_ACTORS: Record<SourceKey, string> = {
  meta: process.env.APIFY_META_ACTOR_ID || "apify/facebook-ads-scraper",
  google:
    process.env.APIFY_GOOGLE_ACTOR_ID ||
    "curious_coder/google-ads-transparency-scraper",
  press: process.env.APIFY_PRESS_ACTOR_ID || "apify/cheerio-scraper",
};

function brandsForInput(input: AnalysisInput) {
  return [input.clientBrand, ...input.competitors].map((b) => b.trim());
}

function buildPressPageFunction(brands: string[]) {
  // pageFunction se envía como string al Actor Cheerio Scraper.
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
      countries: [country],
      searchTerms: brands,
      urls: brands.map(
        (brand) =>
          `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BO&q=${encodeURIComponent(brand)}&search_type=keyword_unordered`,
      ),
      maxItems: 50,
      maxAds: 50,
    };
  }

  if (source === "google") {
    return {
      queries: brands,
      advertisers: brands,
      region: country,
      country,
      maxItems: 50,
    };
  }

  const media = (
    input.pressMedia.length > 0
      ? input.pressMedia
      : [
          "https://eldeber.com.bo/",
          "https://www.lostiempos.com/",
          "https://www.la-razon.com/",
          "https://www.opinion.com.bo/",
        ]
  ).slice(0, 4);

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

  // Default: cheerio-scraper — liviano, sin browser, ~1024 MB alcanza.
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
    // Cheerio: 1024 basta. Si vuelven a WCC+Playwright, subir a 8192.
    return Number(process.env.APIFY_PRESS_MEMORY_MB || 1024);
  }
  if (source === "meta") {
    return Number(process.env.APIFY_META_MEMORY_MB || 2048);
  }
  return Number(process.env.APIFY_GOOGLE_MEMORY_MB || 2048);
}

export async function startSourceRuns(
  input: AnalysisInput,
  sources: SourceKey[],
): Promise<ActorRunRef[]> {
  const client = getApifyClient();
  const refs: ActorRunRef[] = [];

  for (const source of sources) {
    const actorId = DEFAULT_ACTORS[source];
    try {
      const run = await client.actor(actorId).start(buildActorInput(source, input), {
        memory: memoryForSource(source),
        timeout: 600,
      });
      refs.push({
        source,
        actorId,
        runId: run.id,
        status: run.status || "READY",
        datasetId: run.defaultDatasetId,
      });
    } catch (error) {
      refs.push({
        source,
        actorId,
        runId: "",
        status: "FAILED",
        error: error instanceof Error ? error.message : "No se pudo iniciar la fuente",
      });
    }
  }

  return refs;
}

export async function refreshRuns(runs: ActorRunRef[]): Promise<ActorRunRef[]> {
  if (!hasApifyToken()) return runs;
  const client = getApifyClient();

  return Promise.all(
    runs.map(async (run) => {
      if (!run.runId || run.status === "FAILED") return run;
      try {
        const fresh = await client.run(run.runId).get();
        if (!fresh) return run;

        let itemCount = run.itemCount;
        if (fresh.defaultDatasetId && fresh.status === "SUCCEEDED") {
          const dataset = await client.dataset(fresh.defaultDatasetId).get();
          if (dataset && typeof dataset.itemCount === "number") {
            itemCount = dataset.itemCount;
          }
        }

        return {
          ...run,
          status: fresh.status || run.status,
          datasetId: fresh.defaultDatasetId || run.datasetId,
          itemCount,
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
