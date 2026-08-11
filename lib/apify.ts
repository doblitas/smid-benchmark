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

const DEFAULT_ACTORS: Record<SourceKey, string> = {
  meta: process.env.APIFY_META_ACTOR_ID || "apify/facebook-ads-scraper",
  google:
    process.env.APIFY_GOOGLE_ACTOR_ID ||
    "curious_coder/google-ads-transparency-scraper",
  press: process.env.APIFY_PRESS_ACTOR_ID || "apify/website-content-crawler",
};

function brandsForInput(input: AnalysisInput) {
  return [input.clientBrand, ...input.competitors].map((b) => b.trim());
}

function buildActorInput(source: SourceKey, input: AnalysisInput) {
  const brands = brandsForInput(input);
  const country = input.country || "Bolivia";

  if (source === "meta") {
    return {
      // Inputs flexibles: distintos actors de Meta Ad Library aceptan variantes.
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

  const media =
    input.pressMedia.length > 0
      ? input.pressMedia
      : [
          "https://eldeber.com.bo/",
          "https://www.lostiempos.com/",
          "https://www.la-razon.com/",
          "https://www.opinion.com.bo/",
        ];

  return {
    startUrls: media.map((url) => ({ url })),
    maxCrawlPages: Math.min(media.length * 2, 20),
    maxRequestsPerCrawl: Math.min(media.length * 2, 20),
  };
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
        memory: 1024,
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
        error: error instanceof Error ? error.message : "No se pudo iniciar el Actor",
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
