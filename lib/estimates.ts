import type { AnalysisInput, Confidence } from "./types";

/** Días del periodo (proxy mensual). */
export function daysInPeriod(periodLabel: string): number {
  if (/quincen/i.test(periodLabel)) return 15;
  if (/semanal|semana/i.test(periodLabel)) return 7;
  return 30;
}

/**
 * Tráfico mensual estimado de publishers BO (proxy público / hipótesis piloto).
 * Declarar siempre como estimado — no es dato auditado del medio.
 */
export const PUBLISHER_MONTHLY_VISITS: Record<string, number> = {
  "eldeber.com.bo": 8_000_000,
  "lostiempos.com": 4_200_000,
  "la-razon.com": 3_200_000,
  "opinion.com.bo": 2_800_000,
  "unitel.bo": 2_400_000,
  "correodelsur.com": 1_600_000,
  "reduno.com.bo": 1_800_000,
  "paginasiete.bo": 1_200_000,
};

export function publisherHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/\/.*/, "");
  }
}

export function publisherMonthlyVisits(urlOrHost: string): number {
  const host = urlOrHost.includes("://")
    ? publisherHost(urlOrHost)
    : urlOrHost.replace(/^www\./, "");
  if (PUBLISHER_MONTHLY_VISITS[host]) return PUBLISHER_MONTHLY_VISITS[host];
  const hit = Object.entries(PUBLISHER_MONTHLY_VISITS).find(([k]) =>
    host.includes(k.replace(".com", "").split(".")[0] || k),
  );
  return hit?.[1] || 1_000_000;
}

/** CPM piloto Bolivia (brief §6.3) — calibrables vía knownData. */
export type CpmBand = { low: number; mid: number; high: number };

export const DEFAULT_CPM: Record<"meta" | "google", CpmBand> = {
  meta: { low: 1.5, mid: 3.0, high: 5.0 },
  google: { low: 2.5, mid: 5.0, high: 9.0 },
};

/**
 * Extrae CPM / presupuesto propio del campo libre "knownData".
 * Ej.: "CPM Meta Bolivia 3-5", "CPM Google ~6", "KIA Meta junio USD 8000"
 */
export function parseKnownPriors(knownData: string): {
  metaCpm?: CpmBand;
  googleCpm?: CpmBand;
  notes: string[];
} {
  const notes: string[] = [];
  const text = knownData || "";
  let metaCpm: CpmBand | undefined;
  let googleCpm: CpmBand | undefined;

  const metaMatch = text.match(
    /cpm\s*(?:meta|facebook|fb|ig)?[^0-9]{0,20}(\d+(?:[.,]\d+)?)\s*(?:-|–|a|~)?\s*(\d+(?:[.,]\d+)?)?/i,
  );
  if (/meta|facebook|fb|instagram/i.test(text) && metaMatch) {
    const a = Number(metaMatch[1].replace(",", "."));
    const b = metaMatch[2] ? Number(metaMatch[2].replace(",", ".")) : a * 1.4;
    if (Number.isFinite(a)) {
      metaCpm = { low: Math.min(a, b) * 0.85, mid: (a + b) / 2, high: Math.max(a, b) * 1.1 };
      notes.push(`CPM Meta calibrado desde datos del briefing (${metaCpm.mid.toFixed(1)}).`);
    }
  }

  const googleMatch = text.match(
    /cpm\s*(?:google|search|display|youtube)?[^0-9]{0,20}(\d+(?:[.,]\d+)?)\s*(?:-|–|a|~)?\s*(\d+(?:[.,]\d+)?)?/i,
  );
  if (/google|search|youtube|display/i.test(text) && googleMatch) {
    const a = Number(googleMatch[1].replace(",", "."));
    const b = googleMatch[2] ? Number(googleMatch[2].replace(",", ".")) : a * 1.4;
    if (Number.isFinite(a)) {
      googleCpm = {
        low: Math.min(a, b) * 0.85,
        mid: (a + b) / 2,
        high: Math.max(a, b) * 1.1,
      };
      notes.push(`CPM Google calibrado desde datos del briefing (${googleCpm.mid.toFixed(1)}).`);
    }
  }

  return { metaCpm, googleCpm, notes };
}

export function cpmFor(
  platform: "meta" | "google",
  input: AnalysisInput,
): { band: CpmBand; confidenceBoost: boolean } {
  const priors = parseKnownPriors(input.knownData);
  if (platform === "meta" && priors.metaCpm) {
    return { band: priors.metaCpm, confidenceBoost: true };
  }
  if (platform === "google" && priors.googleCpm) {
    return { band: priors.googleCpm, confidenceBoost: true };
  }
  return { band: DEFAULT_CPM[platform], confidenceBoost: false };
}

/**
 * Continuidad proxy (0–100) hasta tener capturas diarias.
 * Brief: días con presencia / días del mes.
 */
export function estimateContinuity(activeAds: number, days: number): number {
  if (activeAds <= 0) return 0;
  // Hipótesis piloto: más creativas activas ⇒ mayor probabilidad de cobertura del mes.
  const raw = 35 + Math.min(activeAds, 25) * 2.2 + Math.min(days, 30) * 0.4;
  return Math.max(15, Math.min(95, Math.round(raw)));
}

/**
 * Impresiones/día por anuncio activo (hipótesis piloto BO automotriz).
 * Meta suele tener más alcance display/social; Google más selectivo.
 */
export function dailyImpressionsPerAd(
  platform: "meta" | "google",
): { low: number; mid: number; high: number } {
  if (platform === "meta") return { low: 600, mid: 1_400, high: 2_800 };
  return { low: 400, mid: 1_000, high: 2_200 };
}

export function estimatePaidImpressions(args: {
  activeAds: number;
  continuityPct: number;
  days: number;
  platform: "meta" | "google";
}): { mid: number; low: number; high: number } {
  const { activeAds, continuityPct, days, platform } = args;
  if (activeAds <= 0) return { mid: 0, low: 0, high: 0 };
  const intensity = dailyImpressionsPerAd(platform);
  const activeDays = days * (continuityPct / 100);
  // anuncios_efectivos ≈ raíz suave para no explotar con muchas variantes
  const effectiveAds = Math.sqrt(activeAds) * Math.min(activeAds, 12) ** 0.35;
  return {
    mid: Math.round(effectiveAds * activeDays * intensity.mid),
    low: Math.round(effectiveAds * activeDays * intensity.low),
    high: Math.round(effectiveAds * activeDays * intensity.high),
  };
}

export function estimateSpendFromImpressions(
  impressions: { mid: number; low: number; high: number },
  cpm: CpmBand,
): { mid: number; low: number; high: number } {
  return {
    mid: Math.round((impressions.mid / 1000) * cpm.mid),
    low: Math.round((impressions.low / 1000) * cpm.low),
    high: Math.round((impressions.high / 1000) * cpm.high),
  };
}

/**
 * Impresiones externas = tráfico_mes × cobertura_muestra × share_marca × factor_formato.
 * Con 1 visita homepage, cobertura es baja (piloto).
 */
export function estimateExternalImpressions(args: {
  monthlyVisits: number;
  brandAppearances: number;
  competitiveAppearancesOnMedium: number;
  adLike: boolean;
  inTitle: boolean;
}): { mid: number; low: number; high: number; confidence: Confidence } {
  const {
    monthlyVisits,
    brandAppearances,
    competitiveAppearancesOnMedium,
    adLike,
    inTitle,
  } = args;

  if (brandAppearances <= 0) {
    return { mid: 0, low: 0, high: 0, confidence: "No disponible" };
  }

  // Homepage-only sample ≈ 3–8% del inventario relevante del mes (hipótesis piloto).
  const sectionCoverage = adLike ? 0.06 : 0.035;
  const share =
    brandAppearances / Math.max(competitiveAppearancesOnMedium, brandAppearances);
  const formatFactor = adLike ? 1.15 : inTitle ? 0.7 : 0.45;
  const mid = Math.round(monthlyVisits * sectionCoverage * share * formatFactor);
  const low = Math.round(mid * 0.55);
  const high = Math.round(mid * 1.55);

  const confidence: Confidence = adLike
    ? "Media"
    : inTitle
      ? "Baja"
      : "Baja";

  return { mid, low, high, confidence };
}

export function pressureIndex(args: {
  adShare: number;
  continuity: number;
  creativeDiversity: number;
  externalShare: number;
}): number {
  const { adShare, continuity, creativeDiversity, externalShare } = args;
  return Math.round(
    0.35 * adShare +
      0.25 * continuity +
      0.2 * Math.min(100, creativeDiversity) +
      0.2 * externalShare,
  );
}

export function confidenceForPaid(
  activeAds: number,
  calibratedCpm: boolean,
): Confidence {
  if (activeAds <= 0) return "No disponible";
  if (calibratedCpm && activeAds >= 3) return "Media";
  if (activeAds >= 2) return "Baja";
  return "Baja";
}
