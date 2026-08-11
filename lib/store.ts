import { promises as fs } from "fs";
import path from "path";
import type { AnalysisJob } from "./types";

type GlobalStore = {
  __smidJobs?: Map<string, AnalysisJob>;
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

export async function saveJob(job: AnalysisJob) {
  memoryMap().set(job.id, job);
  try {
    const all = await readDisk();
    all[job.id] = job;
    await writeDisk(all);
  } catch {
    // En Vercel el filesystem puede ser efímero; memoria alcanza para el request cycle + warm instance.
  }
}

export async function getJob(id: string): Promise<AnalysisJob | null> {
  const fromMemory = memoryMap().get(id);
  if (fromMemory) return fromMemory;

  const all = await readDisk();
  const job = all[id];
  if (job) {
    memoryMap().set(id, job);
    return job;
  }
  return null;
}

export async function listJobs(): Promise<AnalysisJob[]> {
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
