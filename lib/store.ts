import { getApifyClient, hasApifyToken } from "./apify";
import type { AnalysisJob } from "./types";

const KV_STORE_NAME = "smid-benchmark-jobs";
const INDEX_KEY = "__index";

type GlobalStore = {
  __smidJobs?: Map<string, AnalysisJob>;
  __smidKvStoreId?: string;
};

const globalStore = globalThis as typeof globalThis & GlobalStore;

function memoryMap() {
  if (!globalStore.__smidJobs) {
    globalStore.__smidJobs = new Map<string, AnalysisJob>();
  }
  return globalStore.__smidJobs;
}

async function getKvStoreId(): Promise<string> {
  if (!hasApifyToken()) {
    throw new Error(
      "APIFY_TOKEN no está configurado en el entorno de producción.",
    );
  }
  if (globalStore.__smidKvStoreId) return globalStore.__smidKvStoreId;
  const client = getApifyClient();
  const store = await client.keyValueStores().getOrCreate(KV_STORE_NAME);
  globalStore.__smidKvStoreId = store.id;
  return store.id;
}

async function saveToKv(job: AnalysisJob) {
  const storeId = await getKvStoreId();
  const client = getApifyClient();
  const kv = client.keyValueStore(storeId);
  await kv.setRecord({ key: job.id, value: job, contentType: "application/json" });

  try {
    const indexRecord = await kv.getRecord(INDEX_KEY);
    const prev = Array.isArray(indexRecord?.value)
      ? (indexRecord.value as string[])
      : [];
    const next = [job.id, ...prev.filter((id) => id !== job.id)].slice(0, 50);
    await kv.setRecord({
      key: INDEX_KEY,
      value: next,
      contentType: "application/json",
    });
  } catch {
    // index best-effort
  }
}

async function getFromKv(id: string): Promise<AnalysisJob | null> {
  try {
    const storeId = await getKvStoreId();
    const record = await getApifyClient().keyValueStore(storeId).getRecord(id);
    if (!record?.value || typeof record.value !== "object") return null;
    return record.value as AnalysisJob;
  } catch {
    return null;
  }
}

async function listFromKv(): Promise<AnalysisJob[]> {
  try {
    const storeId = await getKvStoreId();
    const kv = getApifyClient().keyValueStore(storeId);
    const indexRecord = await kv.getRecord(INDEX_KEY);
    const ids = Array.isArray(indexRecord?.value)
      ? (indexRecord.value as string[])
      : [];
    const jobs: AnalysisJob[] = [];
    for (const id of ids.slice(0, 20)) {
      const job = await getFromKv(id);
      if (job) jobs.push(job);
    }
    return jobs;
  } catch {
    return [];
  }
}

export async function saveJob(job: AnalysisJob) {
  memoryMap().set(job.id, job);
  await saveToKv(job);
}

export async function getJob(id: string): Promise<AnalysisJob | null> {
  const fromMemory = memoryMap().get(id);
  if (fromMemory) return fromMemory;

  const fromKv = await getFromKv(id);
  if (fromKv) {
    memoryMap().set(id, fromKv);
    return fromKv;
  }
  return null;
}

export async function listJobs(): Promise<AnalysisJob[]> {
  const fromKv = await listFromKv();
  for (const job of fromKv) {
    memoryMap().set(job.id, job);
  }
  return Array.from(memoryMap().values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export async function updateJob(
  id: string,
  patch: Partial<AnalysisJob>,
): Promise<AnalysisJob | null> {
  const current = await getJob(id);
  if (!current) return null;
  const next: AnalysisJob = {
    ...current,
    ...patch,
    id: current.id,
    updatedAt: new Date().toISOString(),
  };
  await saveJob(next);
  return next;
}
