import type { ReportData } from "@/lib/types";

function money(n: number) {
  return `USD ${Math.round(n).toLocaleString("es-BO")}`;
}

function num(n: number) {
  return n.toLocaleString("es-BO");
}

export function ReportView({ report }: { report: ReportData }) {
  const client = report.input.clientBrand;
  const competitor = report.input.competitors[0] || "Competidor";
  const s = report.summary;

  return (
    <div className="space-y-8">
      <div className="border-l-4 border-amber-700 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        El reporte separa <strong>actividad observada</strong> (anuncios, menciones) de{" "}
        <strong>estimaciones</strong> (impresiones e inversión). Las estimaciones usan el
        modelo piloto Bolivia y rangos; no son cifras auditadas de Meta/Google.
        {report.mode === "demo" ? " Este reporte es solo una muestra de formato." : ""}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label={`Inversión est. ${client}`}
          value={s.hasSpendEstimate ? money(s.clientSpendTotal) : "Sin base"}
          hint={s.hasSpendEstimate ? "Rango en tabla §4" : "Sin anuncios útiles"}
        />
        <Kpi
          label={`Inversión est. ${competitor}`}
          value={s.hasSpendEstimate ? money(s.competitorSpendTotal) : "Sin base"}
          hint={s.hasSpendEstimate ? "Rango en tabla §4" : "Sin anuncios útiles"}
        />
        <Kpi
          label="SOV est. medios externos"
          value={
            s.hasExternalEstimate
              ? `${s.clientShareExternal}% / ${s.competitorShareExternal}%`
              : "Sin base"
          }
          hint={`${client} / ${competitor}`}
        />
        <Kpi
          label="SOV est. paid (impresiones)"
          value={
            s.hasPaidEstimate
              ? `${s.clientSharePaid}% / ${s.competitorSharePaid}%`
              : "Sin base"
          }
          hint={`Actividad anuncios: ${s.clientActivitySharePaid}% / ${s.competitorActivitySharePaid}%`}
        />
      </div>

      {report.pressureIndex.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {report.pressureIndex.map((p) => (
            <div
              key={p.brand}
              className="border border-[var(--line)] bg-[var(--paper)] p-4"
            >
              <div className="text-xs text-[var(--muted)]">
                Índice de presión publicitaria · {p.brand}
              </div>
              <div className="mt-2 font-serif text-2xl text-[var(--ink)]">{p.score}</div>
              <div className="mt-1 text-xs text-[var(--muted)]">{p.label}</div>
            </div>
          ))}
        </div>
      )}

      <Section
        title="1. Temáticas de comunicación"
        empty={report.themes.length === 0}
        emptyText="No se detectaron creatividades con texto clasificable en este corrido."
      >
        <Table
          headers={[
            "Marca",
            "Campaña",
            "Tema",
            "Producto",
            "Oferta",
            "Plataformas",
            "Confianza",
          ]}
          rows={report.themes.map((t) => [
            t.brand,
            t.campaign,
            t.theme,
            t.product,
            t.offer,
            t.platforms,
            t.confidence || "—",
          ])}
        />
      </Section>

      <Section
        title="2. SOV impresiones · medios externos digitales"
        empty={report.externalSov.length === 0}
        emptyText="Sin menciones de marca en la muestra de portales. Amplía URLs o reintenta en otro horario."
      >
        <Table
          headers={[
            "Marca",
            "Medio",
            "Formato",
            "Apariciones",
            "Imp. est.",
            "Rango",
            "Confianza",
          ]}
          rows={report.externalSov.map((r) => [
            r.brand,
            r.medium,
            r.format,
            String(r.appearances),
            num(r.estimatedImpressions),
            `${num(r.rangeLow)} – ${num(r.rangeHigh)}`,
            r.confidence,
          ])}
        />
        {report.externalSov.some((r) => r.note) && (
          <p className="mt-3 text-xs text-[var(--muted)]">
            Nota: las menciones editoriales no equivalen a banners pagados confirmados; el
            modelo lo marca con confianza Baja cuando aplica.
          </p>
        )}
      </Section>

      <Section
        title="3. SOV · medios propios de pago (Meta / Google)"
        empty={report.paidSov.length === 0}
        emptyText="Sin anuncios útiles en Meta Ad Library o Google Transparency para estas marcas."
      >
        <Table
          headers={[
            "Marca",
            "Plataforma",
            "Anuncios",
            "Continuidad*",
            "SOV actividad",
            "Imp. est.",
            "Rango",
            "Confianza",
          ]}
          rows={report.paidSov.map((r) => [
            r.brand,
            r.platform,
            String(r.activeAds),
            `${r.continuity}%`,
            `${r.activitySharePct}%`,
            num(r.estimatedImpressions),
            `${num(r.rangeLow)} – ${num(r.rangeHigh)}`,
            r.confidence,
          ])}
        />
        <p className="mt-3 text-xs text-[var(--muted)]">
          *Continuidad es un proxy hasta tener capturas diarias del mes. SOV actividad =
          share de anuncios observados (capa A). Impresiones = estimación (capa B).
        </p>
      </Section>

      <Section
        title="4. Inversión estimada · Meta Ads y Google Ads"
        empty={report.spend.length === 0}
        emptyText="Sin base para estimar inversión (faltan anuncios observados)."
      >
        <Table
          headers={["Marca", "Plataforma", "Estimado", "Rango", "CPM usado", "Confianza"]}
          rows={report.spend.map((r) => [
            r.brand,
            r.platform,
            money(r.estimatedSpendUsd),
            `${money(r.rangeLow)} – ${money(r.rangeHigh)}`,
            `USD ${r.cpmUsed}`,
            r.confidence,
          ])}
        />
      </Section>

      <Section title="Hallazgos">
        <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--muted)]">
          {report.findings.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </Section>

      <Section title="Metodología">
        <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--muted)]">
          {report.methodologyNotes.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="border border-[var(--line)] bg-[var(--paper)] p-4">
      <div className="text-xs text-[var(--muted)]">{label}</div>
      <div className="mt-2 font-serif text-2xl text-[var(--ink)]">{value}</div>
      {hint && <div className="mt-1 text-xs text-[var(--muted)]">{hint}</div>}
    </div>
  );
}

function Section({
  title,
  children,
  empty,
  emptyText,
}: {
  title: string;
  children: React.ReactNode;
  empty?: boolean;
  emptyText?: string;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-serif text-2xl text-[var(--ink)]">{title}</h2>
      <div className="border border-[var(--line)] bg-[var(--paper)] p-4">
        {empty ? (
          <p className="text-sm text-[var(--muted)]">{emptyText || "Sin datos"}</p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="border-b border-[var(--line)] px-2 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={`${row[0]}-${idx}`}>
              {row.map((cell, cellIdx) => (
                <td
                  key={`${idx}-${cellIdx}`}
                  className="border-b border-[var(--line)] px-2 py-2 align-top"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
