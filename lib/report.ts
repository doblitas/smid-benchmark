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
  const base = buildDemoReport(input);
  const metaItems = datasets.meta || [];
  const googleItems = datasets.google || [];
  const pressItems = datasets.press || [];
  const failedSources = options?.failedSources || [];

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
      input.competitors[0] ||
      input.clientBrand;

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

  const paidSov = base.paidSov.map((row) => {
    const count =
      row.platform.startsWith("Meta")
        ? Math.max(row.activeAds, Math.min(metaItems.length || row.activeAds, 40))
        : Math.max(row.activeAds, Math.min(googleItems.length || row.activeAds, 40));
    return { ...row, activeAds: count || row.activeAds };
  });

  const liveExternal = externalSovFromPress(pressItems);
  const pressOk = pressItems.filter((i) => !i.error).length;

  const findings = [
    `Señales observadas: Meta Ads ${metaItems.length}, Google Ads ${googleItems.length}, medios digitales ${pressOk}/${pressItems.length || 0}.`,
    ...(failedSources.length > 0
      ? [
          `Cobertura parcial: sin datos útiles de ${failedSources.join(", ")}. El resto del reporte se mantiene.`,
        ]
      : []),
    ...base.findings.slice(0, 3),
  ];

  return {
    ...base,
    mode: "live",
    themes: liveThemes.length > 0 ? liveThemes.slice(0, 12) : base.themes,
    externalSov: liveExternal.length > 0 ? liveExternal : base.externalSov,
    paidSov,
    findings,
    methodologyNotes: [
      "Análisis con captura del periodo. Las impresiones e inversión siguen siendo estimadas.",
      `Volumen observado — Meta Ads: ${metaItems.length}. Google Ads: ${googleItems.length}. Medios digitales: ${pressOk}.`,
      "Medios digitales: escaneo liviano de homepages (menciones de marca y señales de display), no inventario auditado.",
      "Si alguna fuente devolvió poco volumen, conviene ampliar el periodo o revisar los anunciantes locales.",
      ...(failedSources.length > 0
        ? [`Fuentes sin datos en este corrido: ${failedSources.join(", ")}.`]
        : []),
      ...base.methodologyNotes.filter((n) => !n.includes("muestra ilustrativa")),
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
