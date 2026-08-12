export type AnalysisStatus =
  | "queued"
  | "running"
  | "building_report"
  | "completed"
  | "failed";

export type SourceKey = "meta" | "google" | "press";

export type Confidence = "Alta" | "Media" | "Baja" | "No disponible";

export type AnalysisInput = {
  clientBrand: string;
  competitors: string[];
  country: string;
  category: string;
  periodLabel: string;
  notes: string;
  knownData: string;
  sources: SourceKey[];
  pressMedia: string[];
  forceDemo: boolean;
};

export type ActorRunRef = {
  source: SourceKey;
  actorId: string;
  runId: string;
  status: string;
  datasetId?: string;
  itemCount?: number;
  error?: string;
};

/** Anuncio normalizado (capa observada). */
export type AdSignal = {
  id: string;
  brand: string;
  platform: "Meta" | "Google";
  body: string;
  headline: string;
  cta: string;
  landingUrl: string;
  format: string;
  startDate?: string;
  endDate?: string;
  evidence: string;
  rawUseful: boolean;
};

export type ThemeRow = {
  brand: string;
  campaign: string;
  theme: string;
  product: string;
  offer: string;
  platforms: string;
  evidence?: string;
  confidence?: Confidence;
};

export type ExternalSovRow = {
  brand: string;
  medium: string;
  format: string;
  /** Capa A: apariciones en la muestra */
  appearances: number;
  /** Capa B: impresiones estimadas del mes */
  estimatedImpressions: number;
  rangeLow: number;
  rangeHigh: number;
  confidence: Confidence;
  note?: string;
};

export type PaidSovRow = {
  brand: string;
  platform: string;
  activeAds: number;
  /** Proxy 0–100 hasta tener snapshots diarios */
  continuity: number;
  /** SOV de actividad (anuncios), no de impresiones reales */
  activitySharePct: number;
  estimatedImpressions: number;
  rangeLow: number;
  rangeHigh: number;
  confidence: Confidence;
};

export type SpendRow = {
  brand: string;
  platform: string;
  estimatedSpendUsd: number;
  rangeLow: number;
  rangeHigh: number;
  cpmUsed: number;
  confidence: Confidence;
};

export type PressureIndexRow = {
  brand: string;
  score: number;
  label: string;
};

export type ReportData = {
  generatedAt: string;
  mode: "demo" | "live";
  input: AnalysisInput;
  summary: {
    /** SOV impresiones estimadas · medios externos */
    clientShareExternal: number;
    competitorShareExternal: number;
    /** SOV impresiones estimadas · paid owned */
    clientSharePaid: number;
    competitorSharePaid: number;
    /** SOV actividad paid (anuncios observados) */
    clientActivitySharePaid: number;
    competitorActivitySharePaid: number;
    clientSpendTotal: number;
    competitorSpendTotal: number;
    clientPressure: number;
    competitorPressure: number;
    hasSpendEstimate: boolean;
    hasExternalEstimate: boolean;
    hasPaidEstimate: boolean;
  };
  themes: ThemeRow[];
  externalSov: ExternalSovRow[];
  paidSov: PaidSovRow[];
  spend: SpendRow[];
  pressureIndex: PressureIndexRow[];
  findings: string[];
  methodologyNotes: string[];
};

export type AnalysisJob = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: AnalysisStatus;
  input: AnalysisInput;
  mode: "demo" | "live";
  runs: ActorRunRef[];
  logs: string[];
  report?: ReportData;
  error?: string;
};
