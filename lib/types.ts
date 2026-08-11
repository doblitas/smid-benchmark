export type AnalysisStatus =
  | "queued"
  | "running"
  | "building_report"
  | "completed"
  | "failed";

export type SourceKey = "meta" | "google" | "press";

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

export type ThemeRow = {
  brand: string;
  campaign: string;
  theme: string;
  product: string;
  offer: string;
  platforms: string;
};

export type ExternalSovRow = {
  brand: string;
  medium: string;
  format: string;
  appearances: number;
  estimatedImpressions: number;
  confidence: "Alta" | "Media" | "Baja";
};

export type PaidSovRow = {
  brand: string;
  platform: string;
  activeAds: number;
  continuity: number;
  estimatedImpressions: number;
};

export type SpendRow = {
  brand: string;
  platform: string;
  estimatedSpendUsd: number;
  rangeLow: number;
  rangeHigh: number;
  confidence: "Alta" | "Media" | "Baja";
};

export type ReportData = {
  generatedAt: string;
  mode: "demo" | "live";
  input: AnalysisInput;
  summary: {
    clientShareExternal: number;
    competitorShareExternal: number;
    clientSharePaid: number;
    competitorSharePaid: number;
    clientSpendTotal: number;
    competitorSpendTotal: number;
  };
  themes: ThemeRow[];
  externalSov: ExternalSovRow[];
  paidSov: PaidSovRow[];
  spend: SpendRow[];
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
