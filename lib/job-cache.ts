"use client";

/** Cache de análisis en el navegador para sobrevivir 404 de serverless en Vercel. */
const prefix = "smid:job:";

export function cacheJob(job: unknown) {
  if (typeof window === "undefined" || !job || typeof job !== "object") return;
  const id = (job as { id?: string }).id;
  if (!id) return;
  try {
    sessionStorage.setItem(`${prefix}${id}`, JSON.stringify(job));
  } catch {
    // quota / private mode
  }
}

export function readCachedJob<T>(id: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`${prefix}${id}`);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
