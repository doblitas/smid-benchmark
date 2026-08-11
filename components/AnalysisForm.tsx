"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const DEFAULT_MEDIA = [
  "https://eldeber.com.bo/",
  "https://www.lostiempos.com/",
  "https://www.la-razon.com/",
  "https://www.opinion.com.bo/",
  "https://www.unitel.bo/",
  "https://correodelsur.com/",
];

type SourceKey = "meta" | "google" | "press";

export function AnalysisForm({ captureReady }: { captureReady: boolean }) {
  const router = useRouter();
  const [clientBrand, setClientBrand] = useState("KIA");
  const [competitors, setCompetitors] = useState("HYUNDAI");
  const [country, setCountry] = useState("Bolivia");
  const [category, setCategory] = useState("Automóviles");
  const [periodLabel, setPeriodLabel] = useState("Mensual · Julio 2026");
  const [knownData, setKnownData] = useState("");
  const [notes, setNotes] = useState("");
  const [sources, setSources] = useState<SourceKey[]>(["meta", "google", "press"]);
  const [pressMedia, setPressMedia] = useState(DEFAULT_MEDIA.join("\n"));
  const [sampleOnly, setSampleOnly] = useState(!captureReady);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => clientBrand.trim() && competitors.trim() && sources.length > 0 && !loading,
    [clientBrand, competitors, sources, loading],
  );

  function toggleSource(source: SourceKey) {
    setSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source],
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        clientBrand: clientBrand.trim(),
        competitors: competitors
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
        country: country.trim(),
        category: category.trim(),
        periodLabel: periodLabel.trim(),
        knownData: knownData.trim(),
        notes: notes.trim(),
        sources,
        pressMedia: pressMedia
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        forceDemo: sampleOnly,
      };

      const res = await fetch("/api/analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo iniciar el análisis");
      }
      router.push(`/analisis/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2">
        <Field label="Empresa cliente" hint="Marca a la que entregas el benchmark">
          <input
            className="input"
            value={clientBrand}
            onChange={(e) => setClientBrand(e.target.value)}
            placeholder="KIA"
            required
          />
        </Field>
        <Field label="Competencia" hint="Separa varias marcas con coma">
          <input
            className="input"
            value={competitors}
            onChange={(e) => setCompetitors(e.target.value)}
            placeholder="HYUNDAI, Toyota"
            required
          />
        </Field>
        <Field label="País">
          <input className="input" value={country} onChange={(e) => setCountry(e.target.value)} />
        </Field>
        <Field label="Categoría">
          <input
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </Field>
        <Field label="Periodo de análisis" hint="Ej. Mensual · Julio 2026">
          <input
            className="input"
            value={periodLabel}
            onChange={(e) => setPeriodLabel(e.target.value)}
          />
        </Field>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl text-[var(--ink)]">Fuentes del análisis</h2>
        <p className="text-sm text-[var(--muted)]">
          Elige dónde observar la actividad publicitaria de la competencia.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <SourceCard
            active={sources.includes("meta")}
            title="Meta Ads"
            description="Creatividades y campañas de pago en Facebook e Instagram"
            onClick={() => toggleSource("meta")}
          />
          <SourceCard
            active={sources.includes("google")}
            title="Google Ads"
            description="Search, Display y YouTube de los anunciantes"
            onClick={() => toggleSource("google")}
          />
          <SourceCard
            active={sources.includes("press")}
            title="Medios digitales"
            description="Portales y prensa digital · banners y apariciones"
            onClick={() => toggleSource("press")}
          />
        </div>
      </section>

      {sources.includes("press") && (
        <Field
          label="Medios digitales a monitorear"
          hint="Una URL por línea. Se usan para el SOV en medios externos."
        >
          <textarea
            className="input min-h-32 font-mono text-sm"
            value={pressMedia}
            onChange={(e) => setPressMedia(e.target.value)}
          />
        </Field>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <Field
          label="Datos que ya tienes"
          hint="CPM locales, presupuesto propio, Auction Insights, notas de agencia…"
        >
          <textarea
            className="input min-h-28"
            value={knownData}
            onChange={(e) => setKnownData(e.target.value)}
            placeholder="Ej. CPM Meta Bolivia ~USD 3–5; KIA invirtió X en junio…"
          />
        </Field>
        <Field label="Notas del briefing" hint="Contexto comercial opcional">
          <textarea
            className="input min-h-28"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Objetivo del cliente, hipótesis, restricciones…"
          />
        </Field>
      </section>

      <section className="rounded-sm border border-[var(--line)] bg-[var(--paper)] p-4">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={sampleOnly}
            onChange={(e) => setSampleOnly(e.target.checked)}
          />
          <span>
            <strong className="text-[var(--ink)]">
              Generar muestra ilustrativa (sin captura en vivo)
            </strong>
            <span className="mt-1 block text-[var(--muted)]">
              Ideal para revisar el formato del reporte SMID con datos de ejemplo.
              {captureReady
                ? " Desmárcalo para analizar señales publicitarias reales del periodo."
                : " La captura en vivo se habilita cuando el entorno de producción esté configurado."}
            </span>
          </span>
        </label>
      </section>

      {error && (
        <p className="border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!canSubmit}
          className="bg-[var(--ink)] px-5 py-3 text-sm font-semibold text-[var(--bg)] disabled:opacity-40"
        >
          {loading ? "Iniciando análisis…" : "Generar reporte SMID"}
        </button>
        <p className="text-sm text-[var(--muted)]">
          Briefing → análisis competitivo → reporte entregable
        </p>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="block text-sm font-semibold text-[var(--ink)]">{label}</span>
      {hint && <span className="block text-xs text-[var(--muted)]">{hint}</span>}
      {children}
    </label>
  );
}

function SourceCard({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border p-4 text-left transition ${
        active
          ? "border-[var(--ink)] bg-[var(--paper)]"
          : "border-[var(--line)] bg-transparent opacity-70"
      }`}
    >
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-xs text-[var(--muted)]">{description}</div>
    </button>
  );
}
