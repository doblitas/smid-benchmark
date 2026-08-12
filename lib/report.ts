import { classifyThemes } from "./classify";
import {
  cpmFor,
  daysInPeriod,
  estimateContinuity,
  estimateExternalImpressions,
  estimatePaidImpressions,
  estimateSpendFromImpressions,
  parseKnownPriors,
  pressureIndex,
  publisherHost,
  publisherMonthlyVisits,
  confidenceForPaid,
} from "./estimates";
import { brandUniverse, normalizeAdDatasets } from "./normalize";
import type {
  AnalysisInput,
  AnalysisJob,
  ExternalSovRow,
  PaidSovRow,
  PressureIndexRow,
  ReportData,
  SpendRow,
  ThemeRow,
} from "./types";

function primaryCompetitor(input: AnalysisInput) {
  return input.competitors[0] || "Competidor";
}

function hashSeed(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) {
    h = (h << 5) - h + text.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function scale(seed: number, min: number, max: number) {
  return min + (seed % (max - min + 1));
}

/** Solo muestra de formato — no usar en producción. */
export function buildDemoReport(input: AnalysisInput): ReportData {
  const client = input.clientBrand;
  const competitor = primaryCompetitor(input);
  const seed = hashSeed(`${client}|${competitor}|${input.periodLabel}`);
  const clientAds = scale(seed, 8, 18);
  const compAds = scale(seed >> 2, 12, 28);
  const days = daysInPeriod(input.periodLabel);

  const themes: ThemeRow[] = [
    {
      brand: competitor,
      campaign: "Financiamiento Creta",
      theme: "Financiamiento",
      product: "Creta",
      offer: "Cuota desde USD 299",
      platforms: "Meta",
      confidence: "Media",
    },
    {
      brand: competitor,
      campaign: "Promoción · Bono USD 2.000",
      theme: "Promoción",
      product: "Tucson",
      offer: "Bono USD 2.000",
      platforms: "Meta, Google",
      confidence: "Media",
    },
    {
      brand: client,
      campaign: "Test drive Sportage",
      theme: "Test drive",
      product: "Sportage",
      offer: "Agendamiento online",
      platforms: "Meta",
      confidence: "Media",
    },
  ];

  const externalSov: ExternalSovRow[] = [
    {
      brand: competitor,
      medium: "eldeber.com.bo",
      format: "Señal digital / mención",
      appearances: 3,
      estimatedImpressions: 180_000,
      rangeLow: 100_000,
      rangeHigh: 280_000,
      confidence: "Baja",
      note: "Muestra ilustrativa",
    },
    {
      brand: client,
      medium: "lostiempos.com",
      format: "Señal digital / mención",
      appearances: 2,
      estimatedImpressions: 95_000,
      rangeLow: 50_000,
      rangeHigh: 150_000,
      confidence: "Baja",
      note: "Muestra ilustrativa",
    },
  ];

  const paidSov: PaidSovRow[] = [
    {
      brand: competitor,
      platform: "Meta Ads",
      activeAds: compAds,
      continuity: 78,
      activitySharePct: Math.round((compAds / (compAds + clientAds)) * 100),
      estimatedImpressions: 2_200_000,
      rangeLow: 1_300_000,
      rangeHigh: 3_400_000,
      confidence: "Baja",
    },
    {
      brand: client,
      platform: "Meta Ads",
      activeAds: clientAds,
      continuity: 65,
      activitySharePct: Math.round((clientAds / (compAds + clientAds)) * 100),
      estimatedImpressions: 1_400_000,
      rangeLow: 800_000,
      rangeHigh: 2_200_000,
      confidence: "Baja",
    },
  ];

  const spend: SpendRow[] = [
    {
      brand: competitor,
      platform: "Meta Ads",
      estimatedSpendUsd: 9_500,
      rangeLow: 5_500,
      rangeHigh: 14_500,
      cpmUsed: 3,
      confidence: "Baja",
    },
    {
      brand: client,
      platform: "Meta Ads",
      estimatedSpendUsd: 5_800,
      rangeLow: 3_200,
      rangeHigh: 9_000,
      cpmUsed: 3,
      confidence: "Baja",
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    mode: "demo",
    input,
    summary: {
      clientShareExternal: 35,
      competitorShareExternal: 65,
      clientSharePaid: 39,
      competitorSharePaid: 61,
      clientActivitySharePaid: Math.round((clientAds / (compAds + clientAds)) * 100),
      competitorActivitySharePaid: Math.round(
        (compAds / (compAds + clientAds)) * 100,
      ),
      clientSpendTotal: 5_800,
      competitorSpendTotal: 9_500,
      clientPressure: 48,
      competitorPressure: 72,
      hasSpendEstimate: true,
      hasExternalEstimate: true,
      hasPaidEstimate: true,
    },
    themes,
    externalSov,
    paidSov,
    spend,
    pressureIndex: [
      { brand: competitor, score: 72, label: "Alta presión observada" },
      { brand: client, score: 48, label: "Presión media observada" },
    ],
    findings: [
      "Muestra ilustrativa del formato SMID — no usar para decisiones.",
      `${days} días de periodo de referencia en el modelo.`,
    ],
    methodologyNotes: [
      "Este modo demo no refleja captura real.",
      "En producción se usa actividad observada + estimaciones documentadas.",
    ],
  };
}

function externalSovFromPress(
  pressItems: Record<string, unknown>[],
  brands: string[],
): ExternalSovRow[] {
  const rows: ExternalSovRow[] = [];

  for (const item of pressItems) {
    if (typeof item.error === "string" && item.error) continue;
    const url = typeof item.url === "string" ? item.url : "";
    const medium = publisherHost(url);
    const hits = Array.isArray(item.brandHits) ? item.brandHits : [];
    const adSignals =
      item.adSignals && typeof item.adSignals === "object"
        ? (item.adSignals as Record<string, unknown>)
        : {};
    const adLike =
      Boolean(adSignals.adsenseLike) ||
      (typeof adSignals.dataAdSlots === "number" && adSignals.dataAdSlots > 2) ||
      (typeof adSignals.iframeCount === "number" && adSignals.iframeCount > 0);

    const relevantHits = hits.filter((hit) => {
      if (!hit || typeof hit !== "object") return false;
      const brand = typeof (hit as { brand?: string }).brand === "string"
        ? (hit as { brand: string }).brand
        : "";
      return brands.some((b) => b.toLowerCase() === brand.toLowerCase());
    });

    const competitiveOnMedium = relevantHits.length;

    for (const hit of relevantHits) {
      const h = hit as Record<string, unknown>;
      const brand = String(h.brand || "");
      const linkHits = typeof h.linkOrImageHits === "number" ? h.linkOrImageHits : 0;
      const appearances = Math.max(1, linkHits || 1);
      const inTitle = Boolean(h.inTitle);
      const est = estimateExternalImpressions({
        monthlyVisits: publisherMonthlyVisits(url || medium),
        brandAppearances: appearances,
        competitiveAppearancesOnMedium: Math.max(competitiveOnMedium, 1),
        adLike,
        inTitle,
      });

      rows.push({
        brand,
        medium,
        format: adLike
          ? "Señal publicitaria / inventario digital"
          : inTitle
            ? "Titular / home"
            : "Mención en página",
        appearances,
        estimatedImpressions: est.mid,
        rangeLow: est.low,
        rangeHigh: est.high,
        confidence: est.confidence,
        note: adLike
          ? "Proxy con señales de inventario publicitario en el HTML"
          : "Mención de marca (puede ser editorial; no equivale a banner pagado confirmado)",
      });
    }
  }

  // Agregar por marca+medio
  const merged = new Map<string, ExternalSovRow>();
  for (const row of rows) {
    const key = `${row.brand}|${row.medium}`;
    const prev = merged.get(key);
    if (!prev) {
      merged.set(key, row);
      continue;
    }
    merged.set(key, {
      ...prev,
      appearances: prev.appearances + row.appearances,
      estimatedImpressions: prev.estimatedImpressions + row.estimatedImpressions,
      rangeLow: prev.rangeLow + row.rangeLow,
      rangeHigh: prev.rangeHigh + row.rangeHigh,
      format: prev.format.includes("publicitaria") ? prev.format : row.format,
      confidence:
        prev.confidence === "Media" || row.confidence === "Media"
          ? "Media"
          : "Baja",
    });
  }

  return [...merged.values()]
    .sort((a, b) => b.estimatedImpressions - a.estimatedImpressions)
    .slice(0, 20);
}

function sharePct(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

/**
 * Reporte SMID en vivo:
 * - Capa A observada: anuncios, temáticas, apariciones en medios
 * - Capa B estimada: impresiones e inversión con modelo BO documentado
 * Nunca rellena cifras si no hay señales útiles.
 */
export function buildLiveReport(
  input: AnalysisInput,
  datasets: Record<string, Record<string, unknown>[]>,
  options?: { failedSources?: string[] },
): ReportData {
  const failedSources = options?.failedSources || [];
  const brands = brandUniverse(input);
  const client = input.clientBrand;
  const competitor = primaryCompetitor(input);
  const days = daysInPeriod(input.periodLabel);
  const priors = parseKnownPriors(input.knownData);

  const { meta, google, all } = normalizeAdDatasets(input, datasets);
  const pressItems = datasets.press || [];
  const themes = classifyThemes(all);
  const externalSov = externalSovFromPress(pressItems, brands);

  const countAds = (platform: "Meta" | "Google", brand: string) =>
    all.filter(
      (a) =>
        a.platform === platform &&
        a.brand.toLowerCase() === brand.toLowerCase(),
    ).length;

  const focusBrands = [client, competitor].filter(Boolean);
  const paidSov: PaidSovRow[] = [];
  const spend: SpendRow[] = [];

  for (const brand of focusBrands) {
    for (const platform of ["Meta Ads", "Google Ads"] as const) {
      const key = platform.startsWith("Meta") ? "meta" : "google";
      const activeAds = countAds(platform.startsWith("Meta") ? "Meta" : "Google", brand);
      if (activeAds <= 0) continue;

      const continuity = estimateContinuity(activeAds, days);
      const impressions = estimatePaidImpressions({
        activeAds,
        continuityPct: continuity,
        days,
        platform: key,
      });
      const { band, confidenceBoost } = cpmFor(key, input);
      const money = estimateSpendFromImpressions(impressions, band);
      const conf = confidenceForPaid(activeAds, confidenceBoost);

      paidSov.push({
        brand,
        platform,
        activeAds,
        continuity,
        activitySharePct: 0, // se completa abajo
        estimatedImpressions: impressions.mid,
        rangeLow: impressions.low,
        rangeHigh: impressions.high,
        confidence: conf,
      });

      spend.push({
        brand,
        platform,
        estimatedSpendUsd: money.mid,
        rangeLow: money.low,
        rangeHigh: money.high,
        cpmUsed: band.mid,
        confidence: conf,
      });
    }
  }

  const totalActive = paidSov.reduce((a, r) => a + r.activeAds, 0) || 1;
  for (const row of paidSov) {
    row.activitySharePct = sharePct(row.activeAds, totalActive);
  }

  const clientPaidImp = paidSov
    .filter((r) => r.brand === client)
    .reduce((a, b) => a + b.estimatedImpressions, 0);
  const compPaidImp = paidSov
    .filter((r) => r.brand === competitor)
    .reduce((a, b) => a + b.estimatedImpressions, 0);
  const paidImpTotal = clientPaidImp + compPaidImp;

  const clientExtImp = externalSov
    .filter((r) => r.brand.toLowerCase() === client.toLowerCase())
    .reduce((a, b) => a + b.estimatedImpressions, 0);
  const compExtImp = externalSov
    .filter((r) => r.brand.toLowerCase() === competitor.toLowerCase())
    .reduce((a, b) => a + b.estimatedImpressions, 0);
  const extTotal = clientExtImp + compExtImp;

  const clientAdsTotal = all.filter(
    (a) => a.brand.toLowerCase() === client.toLowerCase(),
  ).length;
  const compAdsTotal = all.filter(
    (a) => a.brand.toLowerCase() === competitor.toLowerCase(),
  ).length;
  const adsTotal = clientAdsTotal + compAdsTotal || 1;

  const clientExtShare = sharePct(clientExtImp, extTotal);
  const compExtShare = sharePct(compExtImp, extTotal);

  const clientThemes = new Set(
    themes.filter((t) => t.brand.toLowerCase() === client.toLowerCase()).map((t) => t.theme),
  ).size;
  const compThemes = new Set(
    themes
      .filter((t) => t.brand.toLowerCase() === competitor.toLowerCase())
      .map((t) => t.theme),
  ).size;

  const clientPressure = pressureIndex({
    adShare: sharePct(clientAdsTotal, adsTotal),
    continuity:
      paidSov
        .filter((r) => r.brand === client)
        .reduce((a, b) => Math.max(a, b.continuity), 0) || 0,
    creativeDiversity: Math.min(100, clientThemes * 22 + clientAdsTotal * 3),
    externalShare: clientExtShare,
  });
  const competitorPressure = pressureIndex({
    adShare: sharePct(compAdsTotal, adsTotal),
    continuity:
      paidSov
        .filter((r) => r.brand === competitor)
        .reduce((a, b) => Math.max(a, b.continuity), 0) || 0,
    creativeDiversity: Math.min(100, compThemes * 22 + compAdsTotal * 3),
    externalShare: compExtShare,
  });

  const pressureIndexRows: PressureIndexRow[] = [
    {
      brand: competitor,
      score: competitorPressure,
      label:
        competitorPressure >= 65
          ? "Alta presión publicitaria observada"
          : competitorPressure >= 40
            ? "Presión media observada"
            : "Presión baja / poca evidencia",
    },
    {
      brand: client,
      score: clientPressure,
      label:
        clientPressure >= 65
          ? "Alta presión publicitaria observada"
          : clientPressure >= 40
            ? "Presión media observada"
            : "Presión baja / poca evidencia",
    },
  ];

  const clientSpendTotal = spend
    .filter((s) => s.brand === client)
    .reduce((a, b) => a + b.estimatedSpendUsd, 0);
  const competitorSpendTotal = spend
    .filter((s) => s.brand === competitor)
    .reduce((a, b) => a + b.estimatedSpendUsd, 0);

  const hasPaidEstimate = paidSov.length > 0;
  const hasExternalEstimate = externalSov.length > 0;
  const hasSpendEstimate = spend.length > 0;
  const pressOk = pressItems.filter((i) => !i.error).length;

  const findings: string[] = [];

  if (compAdsTotal > clientAdsTotal && hasPaidEstimate) {
    findings.push(
      `${competitor} muestra más creatividades activas observadas (${compAdsTotal} vs ${clientAdsTotal} de ${client}) en Meta/Google.`,
    );
  } else if (clientAdsTotal > compAdsTotal && hasPaidEstimate) {
    findings.push(
      `${client} lidera en creatividades activas observadas (${clientAdsTotal} vs ${compAdsTotal} de ${competitor}).`,
    );
  }

  const topCompetitorTheme = themes.find(
    (t) => t.brand.toLowerCase() === competitor.toLowerCase(),
  );
  if (topCompetitorTheme) {
    findings.push(
      `${competitor} comunica principalmente “${topCompetitorTheme.theme}”` +
        (topCompetitorTheme.offer && topCompetitorTheme.offer !== "Sin oferta explícita"
          ? ` con oferta/ángulo: ${topCompetitorTheme.offer}.`
          : "."),
    );
  }

  if (hasExternalEstimate) {
    findings.push(
      `En medios digitales, SOV estimado de impresiones ${client}/${competitor}: ${clientExtShare}% / ${compExtShare}% (proxy con tráfico de publishers y muestra de home).`,
    );
  } else if (pressOk > 0) {
    findings.push(
      `Se escanearon ${pressOk} medios digitales sin menciones claras de ${client}/${competitor} en home. El SOV externo queda sin base en esta muestra.`,
    );
  }

  if (competitorPressure > clientPressure + 10) {
    findings.push(
      `Índice de presión publicitaria (actividad observada): ${competitor} ${competitorPressure} vs ${client} ${clientPressure}. No equivale a inversión real.`,
    );
  }

  if (failedSources.length > 0) {
    findings.push(
      `Sin datos útiles de: ${failedSources.join(", ")}. No se inventaron métricas de relleno.`,
    );
  }

  if (!hasPaidEstimate && !hasExternalEstimate) {
    findings.push(
      "No hubo señales publicitarias útiles en este corrido. Revisa Meta Ad Library / Transparency o amplía medios y vuelve a generar.",
    );
  } else {
    findings.push(
      "Impresiones e inversión son estimaciones del modelo piloto Bolivia (brief SMID). Úsalas como orden de magnitud, no como dato auditado.",
    );
  }

  if (priors.notes.length) {
    findings.push(...priors.notes);
  }

  return {
    generatedAt: new Date().toISOString(),
    mode: "live",
    input,
    summary: {
      clientShareExternal: hasExternalEstimate ? clientExtShare : 0,
      competitorShareExternal: hasExternalEstimate ? compExtShare : 0,
      clientSharePaid: hasPaidEstimate ? sharePct(clientPaidImp, paidImpTotal) : 0,
      competitorSharePaid: hasPaidEstimate ? sharePct(compPaidImp, paidImpTotal) : 0,
      clientActivitySharePaid: sharePct(clientAdsTotal, adsTotal),
      competitorActivitySharePaid: sharePct(compAdsTotal, adsTotal),
      clientSpendTotal: hasSpendEstimate ? clientSpendTotal : 0,
      competitorSpendTotal: hasSpendEstimate ? competitorSpendTotal : 0,
      clientPressure,
      competitorPressure,
      hasSpendEstimate,
      hasExternalEstimate,
      hasPaidEstimate,
    },
    themes,
    externalSov,
    paidSov,
    spend,
    pressureIndex: pressureIndexRows,
    findings,
    methodologyNotes: [
      "Capa observada: anuncios activos (Meta Ad Library / Google Transparency) + apariciones/menciones en portales.",
      "Capa estimada paid: anuncios × continuidad proxy × impresiones/día por anuncio (hipótesis BO automotriz) × CPM local.",
      "Capa estimada externa: visitas/mes proxy del publisher × cobertura de muestra homepage × share de marca × factor de formato.",
      `Periodo modelado: ${days} días (${input.periodLabel || "mensual"}). País: ${input.country}.`,
      `Señales útiles — Meta: ${meta.length}. Google: ${google.length}. Medios con mención: ${externalSov.length} filas / ${pressOk} páginas OK.`,
      "El índice de presión es actividad observada (0–100), no presupuesto.",
      ...(failedSources.length
        ? [`Fuentes incompletas: ${failedSources.join(", ")}.`]
        : []),
      ...(input.knownData
        ? ["Se incorporaron priors del briefing cuando fue posible parsear CPM."]
        : ["Sin CPM propio en el briefing → se usaron bandas piloto Meta 1.5–5 / Google 2.5–9 USD."]),
    ],
  };
}

export function appendLog(job: AnalysisJob, message: string): AnalysisJob {
  return {
    ...job,
    logs: [...job.logs, `${new Date().toISOString()} · ${message}`].slice(-40),
    updatedAt: new Date().toISOString(),
  };
}
