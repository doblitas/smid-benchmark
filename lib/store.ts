import { promises as fs } from "fs";
import path from "path";
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

function dataFile() {
  return path.join(process.cwd(), ".data", "jobs.json");
}

async function readDisk(): Promise<Record<string, AnalysisJob>> {
  try {
    const raw = await fs.readFile(dataFile(), "utf8");
    return JSON.parse(raw) as Record<string, AnalysisJob>;
  } catch {
    return {};
  }
}

async function writeDisk(all: Record<string, AnalysisJob>) {
  const dir = path.dirname(dataFile());
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(dataFile(), JSON.stringify(all, null, 2), "utf8");
}

async function getKvStoreId(): Promise<string | null> {
  if (!hasApifyToken()) return null;
  if (globalStore.__smidKvStoreId) return globalStore.__smidKvStoreId;
  try {
    const client = getApifyClient();
    const store = await client.keyValueStores().getOrCreate(KV_STORE_NAME);
    globalStore.__smidKvStoreId = store.id;
    return store.id;
  } catch {
    return null;
  }
}

async function saveToKv(job: AnalysisJob) {
  const storeId = await getKvStoreId();
  if (!storeId) return;
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
    // index is best-effort
  }
}

async function getFromKv(id: string): Promise<AnalysisJob | null> {
  const storeId = await getKvStoreId();
  if (!storeId) return null;
  try {
    const record = await getApifyClient().keyValueStore(storeId).getRecord(id);
    if (!record?.value || typeof record.value !== "object") return null;
    return record.value as AnalysisJob;
  } catch {
    return null;
  }
}

async function listFromKv(): Promise<AnalysisJob[]> {
  const storeId = await getKvStoreId();
  if (!storeId) return [];
  try {
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

  // Persistencia durable en Vercel (KV remoto). Local también escribe disco.
  await saveToKv(job).catch(() => undefined);

  try {
    const all = await readDisk();
    all[job.id] = job;
    await writeDisk(all);
  } catch {
    // En Vercel el filesystem es efímero; KV/memoria cubren el caso.
  }
}

export async function getJob(id: string): Promise<AnalysisJob | null> {
  const fromMemory = memoryMap().get(id);
  if (fromMemory) return fromMemory;

  const fromKv = await getFromKv(id);
  if (fromKv) {
    memoryMap().set(id, fromKv);
    return fromKv;
  }

  const all = await readDisk();
  const job = all[id];
  if (job) {
    memoryMap().set(id, job);
    return job;
  }
  return null;
}

export async function listJobs(): Promise<AnalysisJob[]> {
  const fromKv = await listFromKv();
  for (const job of fromKv) {
    memoryMap().set(job.id, job);
  }

  const all = await readDisk();
  for (const job of Object.values(all)) {
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
