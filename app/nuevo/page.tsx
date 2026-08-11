import { AnalysisForm } from "@/components/AnalysisForm";
import { hasApifyToken } from "@/lib/apify";

export const dynamic = "force-dynamic";

export default function NuevoPage() {
  const apifyConfigured = hasApifyToken();

  return (
    <div className="space-y-8">
      <div className="max-w-2xl space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          Paso 1 · Inputs
        </p>
        <h1 className="font-serif text-4xl leading-none text-[var(--ink)]">
          Qué quieres evaluar
        </h1>
        <p className="text-[var(--muted)]">
          Completa empresa, competencia, datos disponibles y fuentes. Al enviar,
          se dispara la captura y se construye el reporte SMID.
        </p>
      </div>
      <AnalysisForm apifyConfigured={apifyConfigured} />
    </div>
  );
}
