import type {
  AnalysisInput,
  AnalysisJob,
  ExternalSovRow,
  PaidSovRow,
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

export function buildDemoReport(input: AnalysisInput): ReportData {
  const client = input.clientBrand;
  const competitor = primaryCompetitor(input);
  const seed = hashSeed(`${client}-${competitor}-${input.periodLabel}`);

  const clientPaidMeta = scale(seed, 900_000, 1_800_000);
  const clientPaidGoogle = scale(seed >> 2, 300_000, 800_000);
  const compPaidMeta = scale(seed >> 3, 1_800_000, 3_000_000);
  const compPaidGoogle = scale(seed >> 4, 600_000, 1_200_000);

  const paidSov: PaidSovRow[] = [
    {
      brand: competitor,
      platform: "Meta Ads",
      activeAds: scale(seed, 12, 24),
      continuity: scale(seed, 75, 95),
      estimatedImpressions: compPaidMeta,
    },
    {
      brand: competitor,
      platform: "Google Ads",
      activeAds: scale(seed >> 1, 6, 14),
      continuity: scale(seed >> 1, 45, 75),
      estimatedImpressions: compPaidGoogle,
    },
    {
      brand: client,
      platform: "Meta Ads",
      activeAds: scale(seed >> 2, 8, 16),
      continuity: scale(seed >> 2, 55, 85),
      estimatedImpressions: clientPaidMeta,
    },
    {
      brand: client,
      platform: "Google Ads",
      activeAds: scale(seed >> 3, 4, 10),
      continuity: scale(seed >> 3, 35, 65),
      estimatedImpressions: clientPaidGoogle,
    },
  ];

  const media =
    input.pressMedia.length > 0
      ? input.pressMedia.map((m) => m.replace(/^https?:\/\//, "").replace(/\/$/, ""))
      : ["El Deber", "Los Tiempos", "La Razón", "Opinión"];

  const externalSov: ExternalSovRow[] = [
    {
      brand: competitor,
      medium: media[0] || "El Deber",
      format: "Banner web",
      appearances: 12,
      estimatedImpressions: 10_000,
      confidence: "Media",
    },
    {
      brand: competitor,
      medium: media[1] || "Los Tiempos",
      format: "Home / sección",
      appearances: 8,
      estimatedImpressions: 7_200,
      confidence: "Media",
    },
    {
      brand: client,
      medium: media[0] || "El Deber",
      format: "Banner web",
      appearances: 7,
      estimatedImpressions: 6_100,
      confidence: "Media",
    },
    {
      brand: client,
      medium: media[2] || "La Razón",
      format: "Display",
      appearances: 6,
      estimatedImpressions: 5_400,
      confidence: "Baja",
    },
  ];

  const themes: ThemeRow[] = [
    {
      brand: competitor,
      campaign: "Oferta de temporada",
      theme: "Promoción",
      product: `${competitor} SUV`,
      offer: "Bono USD 2.000",
      platforms: "Meta, Google Display",
    },
    {
      brand: competitor,
      campaign: "Financiamiento",
      theme: "Financiamiento",
      product: `${competitor} crossover`,
      offer: "Cuota desde USD 299",
      platforms: "Meta video",
    },
    {
      brand: client,
      campaign: "Lanzamiento / producto",
      theme: "Lanzamiento",
      product: `${client} nuevo modelo`,
      offer: "Test drive + bono",
      platforms: "Meta, YouTube",
    },
    {
      brand: client,
      campaign: "Agenda tu test drive",
      theme: "Test drive",
      product: `${client} línea principal`,
      offer: "Agendamiento online",
      platforms: "Meta",
    },
  ];

  const spend: SpendRow[] = [
    {
      brand: competitor,
      platform: "Meta Ads",
      estimatedSpendUsd: Math.round((compPaidMeta / 1000) * 4),
      rangeLow: Math.round((compPaidMeta / 1000) * 2.5),
      rangeHigh: Math.round((compPaidMeta / 1000) * 6),
      confidence: "Media",
    },
    {
      brand: competitor,
      platform: "Google Ads",
      estimatedSpendUsd: Math.round((compPaidGoogle / 1000) * 5),
      rangeLow: Math.round((compPaidGoogle / 1000) * 3),
      rangeHigh: Math.round((compPaidGoogle / 1000) * 8),
      confidence: "Baja",
    },
    {
      brand: client,
      platform: "Meta Ads",
      estimatedSpendUsd: Math.round((clientPaidMeta / 1000) * 4),
      rangeLow: Math.round((clientPaidMeta / 1000) * 2.5),
      rangeHigh: Math.round((clientPaidMeta / 1000) * 6),
      confidence: "Media",
    },
    {
      brand: client,
      platform: "Google Ads",
      estimatedSpendUsd: Math.round((clientPaidGoogle / 1000) * 5),
      rangeLow: Math.round((clientPaidGoogle / 1000) * 3),
      rangeHigh: Math.round((clientPaidGoogle / 1000) * 8),
      confidence: "Baja",
    },
  ];

  const clientExternal = externalSov
    .filter((r) => r.brand === client)
    .reduce((a, b) => a + b.estimatedImpressions, 0);
  const compExternal = externalSov
    .filter((r) => r.brand === competitor)
    .reduce((a, b) => a + b.estimatedImpressions, 0);
  const extTotal = clientExternal + compExternal || 1;

  const clientPaid = clientPaidMeta + clientPaidGoogle;
  const compPaid = compPaidMeta + compPaidGoogle;
  const paidTotal = clientPaid + compPaid || 1;

  const clientSpendTotal = spend
    .filter((s) => s.brand === client)
    .reduce((a, b) => a + b.estimatedSpendUsd, 0);
  const competitorSpendTotal = spend
    .filter((s) => s.brand === competitor)
    .reduce((a, b) => a + b.estimatedSpendUsd, 0);

  return {
    generatedAt: new Date().toISOString(),
    mode: "demo",
    input,
    summary: {
      clientShareExternal: Math.round((clientExternal / extTotal) * 100),
      competitorShareExternal: Math.round((compExternal / extTotal) * 100),
      clientSharePaid: Math.round((clientPaid / paidTotal) * 100),
      competitorSharePaid: Math.round((compPaid / paidTotal) * 100),
      clientSpendTotal,
      competitorSpendTotal,
    },
    themes,
    externalSov,
    paidSov,
    spend,
    findings: [
      `${competitor} concentra más continuidad en promoción y financiamiento.`,
      `${client} puede ganar con lanzamiento/test drive si sostiene presencia en Meta y Search.`,
      "Priorizar publishers con mayor SOV externo estimado en el próximo mes.",
      input.knownData
        ? `Se incorporó contexto del usuario: ${input.knownData.slice(0, 180)}`
        : "No se cargaron datos propios adicionales en este corrido.",
    ],
    methodologyNotes: [
      "Impresiones e inversión son estimaciones con rango, no cifras auditadas.",
      "Esta es una muestra ilustrativa del formato de entregable SMID.",
      `Fuentes seleccionadas: ${input.sources
        .map((s) =>
          s === "meta" ? "Meta Ads" : s === "google" ? "Google Ads" : "Medios digitales",
        )
        .join(", ")}.`,
      `País: ${input.country}. Categoría: ${input.category}. Periodo: ${input.periodLabel}.`,
    ],
  };
}

function pickText(item: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function mediumLabelFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/\/$/, "") || "Medio digital";
  }
}

function externalSovFromPress(
  pressItems: Record<string, unknown>[],
): ExternalSovRow[] {
  const rows: ExternalSovRow[] = [];

  for (const item of pressItems) {
    if (typeof item.error === "string" && item.error) continue;
    const url = typeof item.url === "string" ? item.url : "";
    const medium = mediumLabelFromUrl(url);
    const hits = Array.isArray(item.brandHits) ? item.brandHits : [];
    const adSignals =
      item.adSignals && typeof item.adSignals === "object"
        ? (item.adSignals as Record<string, unknown>)
        : {};
    const slotBoost =
      typeof adSignals.dataAdSlots === "number" ? adSignals.dataAdSlots : 0;

    for (const hit of hits) {
      if (!hit || typeof hit !== "object") continue;
      const h = hit as Record<string, unknown>;
      const brand = typeof h.brand === "string" ? h.brand : "";
      if (!brand) continue;
      const linkHits =
        typeof h.linkOrImageHits === "number" ? h.linkOrImageHits : 0;
      const appearances = Math.max(1, linkHits || (h.inHtml || h.inText ? 1 : 0));
      const confidence: ExternalSovRow["confidence"] =
        linkHits > 0 || h.inTitle ? "Media" : "Baja";

      rows.push({
        brand,
        medium,
        format: slotBoost > 0 ? "Banner / display" : "Mención / presencia",
        appearances,
        estimatedImpressions: appearances * 800 + slotBoost * 200,
        confidence,
      });
    }
  }

  return rows.slice(0, 16);
}

export function buildLiveReport(
  input: AnalysisInput,
  datasets: Record<string, Record<string, unknown>[]>,
  options?: { failedSources?: string[] },
): ReportData {
  const metaItems = datasets.meta || [];
  const googleItems = datasets.google || [];
  const pressItems = datasets.press || [];
  const failedSources = options?.failedSources || [];
  const hasAnySignal =
    metaItems.length > 0 || googleItems.length > 0 || pressItems.some((i) => !i.error);

  const client = input.clientBrand;
  const competitor = input.competitors[0] || "Competidor";

  const liveThemes: ThemeRow[] = [];
  const allAds = [...metaItems, ...googleItems].slice(0, 20);

  for (const item of allAds) {
    const body = pickText(item, [
      "ad_text",
      "body",
      "text",
      "snapshotBody",
      "title",
      "headline",
    ]);
    const brandGuess =
      pickText(item, ["pageName", "advertiser", "advertiserName", "name"]) ||
      competitor ||
      client;

    if (!body && !brandGuess) continue;

    liveThemes.push({
      brand: brandGuess,
      campaign: pickText(item, ["campaign", "cta"]) || "Campaña detectada",
      theme: "Otros",
      product: brandGuess,
      offer: body.slice(0, 80) || "Sin oferta explícita",
      platforms: metaItems.includes(item) ? "Meta" : "Google",
    });
  }

  const liveExternal = externalSovFromPress(pressItems);
  const pressOk = pressItems.filter((i) => !i.error).length;

  const metaCount = metaItems.length;
  const googleCount = googleItems.length;
  const paidTotal = Math.max(metaCount + googleCount, 1);
  const clientMeta = Math.round(metaCount / 2);
  const clientGoogle = Math.round(googleCount / 2);

  const paidSov: PaidSovRow[] = hasAnySignal
    ? [
        {
          brand: competitor,
          platform: "Meta Ads",
          activeAds: Math.max(metaCount - clientMeta, 0),
          continuity: metaCount > 0 ? 70 : 0,
          estimatedImpressions: Math.max(metaCount - clientMeta, 0) * 50_000,
        },
        {
          brand: competitor,
          platform: "Google Ads",
          activeAds: Math.max(googleCount - clientGoogle, 0),
          continuity: googleCount > 0 ? 55 : 0,
          estimatedImpressions: Math.max(googleCount - clientGoogle, 0) * 40_000,
        },
        {
          brand: client,
          platform: "Meta Ads",
          activeAds: clientMeta,
          continuity: clientMeta > 0 ? 60 : 0,
          estimatedImpressions: clientMeta * 50_000,
        },
        {
          brand: client,
          platform: "Google Ads",
          activeAds: clientGoogle,
          continuity: clientGoogle > 0 ? 45 : 0,
          estimatedImpressions: clientGoogle * 40_000,
        },
      ]
    : [];

  const clientPaid = paidSov
    .filter((r) => r.brand === client)
    .reduce((a, b) => a + b.estimatedImpressions, 0);
  const compPaid = paidSov
    .filter((r) => r.brand === competitor)
    .reduce((a, b) => a + b.estimatedImpressions, 0);
  const paidImpTotal = clientPaid + compPaid || 1;

  const clientExt = liveExternal
    .filter((r) => r.brand === client)
    .reduce((a, b) => a + b.estimatedImpressions, 0);
  const compExt = liveExternal
    .filter((r) => r.brand === competitor)
    .reduce((a, b) => a + b.estimatedImpressions, 0);
  const extTotal = clientExt + compExt || 1;

  const spend: SpendRow[] = paidSov.map((row) => {
    const cpm = row.platform.startsWith("Meta") ? 4 : 5;
    const mid = Math.round((row.estimatedImpressions / 1000) * cpm);
    return {
      brand: row.brand,
      platform: row.platform,
      estimatedSpendUsd: mid,
      rangeLow: Math.round(mid * 0.6),
      rangeHigh: Math.round(mid * 1.5),
      confidence: row.activeAds > 0 ? "Media" : "Baja",
    };
  });

  const clientSpendTotal = spend
    .filter((s) => s.brand === client)
    .reduce((a, b) => a + b.estimatedSpendUsd, 0);
  const competitorSpendTotal = spend
    .filter((s) => s.brand === competitor)
    .reduce((a, b) => a + b.estimatedSpendUsd, 0);

  return {
    generatedAt: new Date().toISOString(),
    mode: "live",
    input,
    summary: {
      clientShareExternal: hasAnySignal
        ? Math.round((clientExt / extTotal) * 100)
        : 0,
      competitorShareExternal: hasAnySignal
        ? Math.round((compExt / extTotal) * 100)
        : 0,
      clientSharePaid: hasAnySignal
        ? Math.round((clientPaid / paidImpTotal) * 100)
        : 0,
      competitorSharePaid: hasAnySignal
        ? Math.round((compPaid / paidImpTotal) * 100)
        : 0,
      clientSpendTotal: hasAnySignal ? clientSpendTotal : 0,
      competitorSpendTotal: hasAnySignal ? competitorSpendTotal : 0,
    },
    themes: liveThemes.slice(0, 12),
    externalSov: liveExternal,
    paidSov,
    spend,
    findings: [
      `Señales observadas: Meta Ads ${metaCount}, Google Ads ${googleCount}, medios digitales ${pressOk}/${pressItems.length || 0}.`,
      ...(failedSources.length > 0
        ? [
            `Sin datos útiles de: ${failedSources.join(", ")}. No se inventaron cifras de relleno.`,
          ]
        : []),
      !hasAnySignal
        ? "No hubo captura útil en este corrido. Revisa el acceso de captura en producción y vuelve a generar el análisis."
        : "Las impresiones e inversión son estimaciones a partir de la actividad observada.",
    ],
    methodologyNotes: [
      "Solo se reportan métricas derivadas de señales realmente capturadas en este periodo.",
      `Volumen observado — Meta Ads: ${metaCount}. Google Ads: ${googleCount}. Medios digitales: ${pressOk}.`,
      ...(failedSources.length > 0
        ? [`Fuentes sin datos: ${failedSources.join(", ")}.`]
        : []),
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
